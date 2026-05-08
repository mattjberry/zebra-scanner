"""
build_upc_index.py

One-time data preparation script. Run this on your host machine to generate
the UPC index file that ships with the backend container. This can be re-ran
to get the most recent data from OFF, in case codes have been removed or added.

Usage:
    python3 build_upc_index.py

Output:
    backend/zebra/data/upc_index.txt  — sorted list of valid UPC/EAN codes,
                                        one per line, ~50MB

Requirements:
    pip install requests

The OFF export is ~1.5GB compressed. The script streams it to avoid loading
the whole thing into memory, and discards it once the index is built.
The index file itself is ~50MB and is committed to the repo.

Runtime: roughly 2-5 minutes depending on your connection.
"""

import csv
import gzip
import io
import os
import requests
import sys

# ── Config ────────────────────────────────────────────────────────────────────

OFF_EXPORT_URL = (
    'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz'
)

OUTPUT_DIR  = os.path.join('backend', 'zebra', 'data')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'upc_index.txt')

# Only keep codes that look like valid UPC-A (12 digits) or EAN-13 (13 digits)
MIN_DIGITS = 12
MAX_DIGITS = 13


# ── Helpers ───────────────────────────────────────────────────────────────────

def is_valid_code(code: str) -> bool:
    """Return True if code is a numeric string of 12 or 13 digits."""
    return code.isdigit() and MIN_DIGITS <= len(code) <= MAX_DIGITS


def normalise_code(code: str) -> str:
    """
    Normalise to 13 digits (EAN-13) by zero-padding 12-digit UPC-A codes.
    Storing everything as 13 digits simplifies comparison.
    """
    return code.zfill(13)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    csv.field_size_limit(10 * 1024 * 1024)  # 10MB

    print(f'Downloading OFF export from {OFF_EXPORT_URL}')
    print('This is ~1.5GB — streaming to avoid loading into memory...\n')

    response = requests.get(
        OFF_EXPORT_URL,
        stream=True,
        timeout=60,
        headers={'User-Agent': 'ZebraBarcode/1.0 (build-script)'},
    )
    response.raise_for_status()

    total_rows  = 0
    valid_codes = set()

    # Stream the gzip response, decompress on the fly, parse as CSV
    with gzip.open(response.raw, mode='rt', encoding='utf-8', errors='replace') as gz:
        reader = csv.DictReader(gz, delimiter='\t')

        for i, row in enumerate(reader):
            if i % 100_000 == 0 and i > 0:
                print(f'  Processed {i:,} rows, {len(valid_codes):,} valid codes so far...')
                sys.stdout.flush()

            code = row.get('code', '').strip()
            if is_valid_code(code):
                valid_codes.add(normalise_code(code))

            total_rows = i + 1

    print(f'\nFinished processing {total_rows:,} rows')
    print(f'Found {len(valid_codes):,} valid UPC/EAN codes')

    # Sort numerically and write one code per line
    print(f'\nSorting and writing to {OUTPUT_FILE}...')
    sorted_codes = sorted(valid_codes)

    with open(OUTPUT_FILE, 'w') as f:
        f.write('\n'.join(sorted_codes))
        f.write('\n')

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f'Done — {OUTPUT_FILE} ({size_mb:.1f} MB, {len(sorted_codes):,} codes)')


if __name__ == '__main__':
    main()