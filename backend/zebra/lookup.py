import requests
import os
from .upc_index import find_nearest_upc

# ── Constants ────────────────────────────────────────────────────────────────

OFF_API_BASE = 'https://world.openfoodfacts.org/api/v2/product'

# OFF asks all API consumers to send a descriptive User-Agent so they can
# identify usage and contact you if your traffic causes any issues.
# Set USER_AGENT in your .env — e.g:
# USER_AGENT=ZebraBarcode/1.0 (github.com/your-username/zebra-barcode)
USER_AGENT = os.environ.get(
    'USER_AGENT',
    'ZebraBarcode/1.0 (contact@example.com)',  # fallback for local dev
)

# How many nearest UPCs to try before giving up.
# With a local index, even 3 is very likely to find a hit since all
# candidates are known to exist in the OFF database. Safeguards against
# the actual API DB changing since the local instance was created
MAX_CANDIDATES = 3
 

# Request only the fields we actually use — keeps payloads small
FIELDS = 'code,product_name,image_front_url'


# ── UPC helpers ──────────────────────────────────────────────────────────────

def compute_check_digit(eleven_digits: str) -> str:
    """
    Compute the UPC-A check digit from the first 11 digits.

    Algorithm: multiply odd-position digits by 3, even-position by 1,
    sum everything, subtract from the next multiple of 10.
    """
    total = sum(
        int(d) * (3 if i % 2 == 0 else 1)
        for i, d in enumerate(eleven_digits)
    )
    return str((10 - (total % 10)) % 10)


def make_valid_upc(eleven_digits: str) -> str:
    """Append the correct check digit to produce a valid 12-digit UPC-A."""
    return eleven_digits + compute_check_digit(eleven_digits)


def adjacent_upcs(upc: str, radius: int):
    """
    Generator that yields UPCs numerically adjacent to the given one,
    walking outward in alternating steps: +1, -1, +2, -2, ...

    The check digit is recomputed for each candidate so every yielded
    UPC is structurally valid, even if it does not exist in any database.

    Example for upc='01234567890X', radius=2:
        01234567891X, 01234567889X, 01234567892X, 01234567888X
    """
    base = int(upc[:11])  # operate on the first 11 digits only

    for step in range(1, radius + 1):
        for direction in (step, -step):
            candidate_base = base + direction

            if candidate_base < 0:
                continue

            eleven = str(candidate_base).zfill(11)

            if len(eleven) > 11:
                continue  # overflowed past 11 digits — stop walking upward

            yield make_valid_upc(eleven)


# ── Open Food Facts API call ──────────────────────────────────────────────────

def lookup_upc(upc: str) -> dict | None:
    """
    Look up a single UPC against the Open Food Facts API.

    Returns a normalised result dict on a hit, None on a miss or any error.
    Errors are swallowed intentionally — a failed lookup is treated the same
    as a miss so the walk continues rather than surfacing a transient error.
    """
    url = f'{OFF_API_BASE}/{upc}.json?fields={FIELDS}'

    try:
        response = requests.get(
            url,
            headers={'User-Agent': USER_AGENT},
            timeout=5,
        )
    except requests.exceptions.RequestException:
        return None

    # OFF returns 404 with a JSON body for missing products,
    # and 200 for found ones, accept both and let status field decide
    if response.status_code not in (200, 404):
        return None

    try:
        data = response.json()
    except ValueError:
        return None

    # OFF returns status=0 for not found, status=1 for found
    if data.get('status') != 1:
        return None

    product = data.get('product', {})
    name    = product.get('product_name', '').strip()

    # Skip entries with no usable name, common for incomplete OFF submissions
    if not name:
        return None

    return {
        'product': name,
        'upc':     data.get('code', upc),
        'image':   product.get('image_front_url') or None,
        'offers':  [],  # OFF is a nutrition DB, no retailer or pricing data
                        # left in case the database ever changes
    }


# ── Nearest neighbour search ──────────────────────────────────────────────────

def find_nearest_product(upc: str) -> dict | None:
    """
    Find the nearest product in Open Food Facts to the given UPC.
 
    Strategy:
      1. Use the local UPC index to find the nearest known codes via
         binary search — O(log n), no API calls needed for the search.
      2. Try each candidate against the OFF API until we get a hit.
 
    Because all candidates come from the index (known to exist in OFF),
    the first candidate almost always succeeds. MAX_CANDIDATES is a
    safety net for the rare case where a product has been removed from
    OFF since the index was built.
    """
    try:
        candidates = find_nearest_upc(upc, n_candidates=MAX_CANDIDATES)
    except FileNotFoundError as e:
        raise RuntimeError(
            'UPC index not found. Run build_upc_index.py first.'
        ) from e
 
    for candidate in candidates:
        result = lookup_upc(candidate)
        if result:
            return result
 
    return None