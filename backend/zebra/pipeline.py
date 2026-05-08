# Main endpoint of the app, runs the image processing steps

import io
import json
import base64
import numpy as np
from skimage import io as skio, color, filters, morphology, transform, measure
from skimage.util import img_as_ubyte
import matplotlib
matplotlib.use('Agg')  # non-interactive backend, required in Docker
import matplotlib.pyplot as plt

from .lookup import find_nearest_product


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

def array_to_base64(image_array, cmap=None):
    """
    Convert a numpy image array to a base64-encoded PNG string
    suitable for embedding directly in JSON / an <img> src tag.
    """
    fig, ax = plt.subplots(figsize=(4, 3), dpi=80)
    ax.axis('off')

    if cmap:
        ax.imshow(image_array, cmap=cmap, aspect='auto')
    else:
        ax.imshow(image_array, aspect='auto')

    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')


def signal_to_base64(signal):
    """
    Convert a 1D numpy signal array to a base64-encoded plot image.
    """
    fig, ax = plt.subplots(figsize=(6, 2), dpi=80)
    ax.plot(signal, color='black', linewidth=0.8)
    ax.set_ylim(0, 1)
    ax.axis('off')

    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0.1)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')


def step_event(label, description, image_b64=None, progress=0, data=None):
    """
    Construct a pipeline step event dict for SSE transmission.
    """
    return {
        'step': label,
        'description': description,
        'image': image_b64,
        'progress': progress,
        **(data or {}),
    }


# ---------------------------------------------------------------
# Pipeline steps
# ---------------------------------------------------------------

def load_image(image_bytes):
    """Load image bytes into a numpy array."""
    image_bytes.seek(0)
    return skio.imread(image_bytes)


def to_grayscale(image):
    """Convert RGB image to grayscale."""
    if image.ndim == 3:
        return color.rgb2gray(image)
    return image


def threshold_image(gray):
    """
    Apply Otsu thresholding to produce a binary image.
    High contrast zebra stripes make Otsu a natural fit here.
    """
    thresh = filters.threshold_otsu(gray)
    return (gray > thresh).astype(np.uint8)


def clean_binary(binary):
    """
    Morphological cleanup — remove small noise objects that
    aren't part of the stripe pattern.
    """
    cleaned = morphology.remove_small_objects(
        binary.astype(bool),
        max_size=20
    )
    return cleaned.astype(np.uint8)


def align_stripes(binary):
    """
    Rotate the image so stripes run vertically.
    Uses the dominant orientation of connected region properties.
    If orientation detection fails, returns the image unrotated.
    """
    try:
        labeled = measure.label(binary)
        regions = measure.regionprops(labeled)

        if not regions:
            return binary

        # Use the orientation of the largest region
        largest = max(regions, key=lambda r: r.area)
        angle_rad = largest.orientation
        angle_deg = np.degrees(angle_rad)

        # regionprops orientation is measured from the horizontal axis
        # correct by 90 so stripes end up vertical for column projection
        rotated = transform.rotate(binary, angle_deg + 90, resize=True, preserve_range=True)
        return (rotated > 0.5).astype(np.uint8)

    except Exception:
        return binary


def project_to_signal(binary):
    """
    Collapse 2D stripe image to a 1D signal by averaging each column.
    A vertical stripe pattern becomes a waveform of alternating highs/lows.
    """
    signal = np.mean(binary, axis=0).astype(float)
    return signal


def normalize_signal(signal):
    """Normalize signal to 0-1 range."""
    min_val, max_val = signal.min(), signal.max()
    if max_val == min_val:
        return np.zeros_like(signal)
    return (signal - min_val) / (max_val - min_val)


def signal_to_barcode_string(signal, num_digits=11):
    """
    Quantize the normalized 1D signal into a UPC digit candidate string.

    UPC-A encodes each digit as a pattern of 4 bars/spaces with widths
    summing to 7 modules. We map our signal's run-lengths to the closest
    matching UPC digit patterns.

    Returns an 11-digit string (the 12th check digit is computed separately).
    """
    # Binarize the signal based of the signal mean
    threshold = np.mean(signal)
    binary_signal = (signal > threshold).astype(int)

    # Get run-length encoding: (value, length) pairs
    runs = []
    current = binary_signal[0]
    count = 1
    for bit in binary_signal[1:]:
        if bit == current:
            count += 1
        else:
            runs.append((int(current), count))
            current = bit
            count = 1
    runs.append((int(current), count))

    # Normalize run lengths relative to the median run
    lengths = [r[1] for r in runs]
    if not lengths:
        return '0' * num_digits
    median_run = np.median(lengths)
    normalized_runs = [(v, max(1, round(l / median_run))) for v, l in runs]

    # UPC-A left-side digit patterns (7 modules each, odd parity)
    UPC_PATTERNS = {
        '0': (3, 2, 1, 1), '1': (2, 2, 2, 1), '2': (2, 1, 2, 2),
        '3': (1, 4, 1, 1), '4': (1, 1, 3, 2), '5': (1, 2, 3, 1),
        '6': (1, 1, 1, 4), '7': (1, 3, 1, 2), '8': (1, 2, 1, 3),
        '9': (3, 1, 1, 2),
    }

    def match_digit(run_group):
        """Find the UPC digit whose pattern most closely matches 4 runs."""
        if len(run_group) < 4:
            return '0'
        widths = tuple(r[1] for r in run_group[:4])
        best_digit = '0'
        best_score = float('inf')
        for digit, pattern in UPC_PATTERNS.items():
            score = sum(abs(w - p) for w, p in zip(widths, pattern))
            if score < best_score:
                best_score = score
                best_digit = digit
        return best_digit

    # Group runs into sets of 4 (each UPC digit = 4 alternating bars/spaces)
    digits = []
    i = 0
    while len(digits) < num_digits and i < len(normalized_runs) - 3:
        digits.append(match_digit(normalized_runs[i:i+4]))
        i += 4

    # Pad or truncate to exactly num_digits
    digits = (digits + ['0'] * num_digits)[:num_digits]
    return ''.join(digits)


def compute_check_digit(eleven_digits):
    """
    Compute the UPC-A check digit from the first 11 digits.
    Odd positions * 3, even positions * 1, sum mod 10, subtract from 10.
    """
    total = sum(
        int(d) * (3 if i % 2 == 0 else 1)
        for i, d in enumerate(eleven_digits)
    )
    return str((10 - (total % 10)) % 10)


def build_upc(eleven_digits):
    """Append check digit to produce a valid 12-digit UPC-A string."""
    check = compute_check_digit(eleven_digits)
    return eleven_digits + check



# ---------------------------------------------------------------
# Pipeline runner — generator that yields SSE-ready step dicts
# ---------------------------------------------------------------

def run_pipeline(image_bytes):
    """
    Main pipeline generator. Each yield sends one SSE event to the client
    with a label, description, progress %, and optional preview image.
    """

    # Step 1 — Load
    image = load_image(image_bytes)
    yield step_event(
        label='Loaded',
        description='Image received and loaded into memory.',
        image_b64=array_to_base64(image),
        progress=10,
    )

    # Step 2 — Grayscale
    gray = to_grayscale(image)
    yield step_event(
        label='Grayscale',
        description='Converted to grayscale to isolate luminance.',
        image_b64=array_to_base64(gray, cmap='gray'),
        progress=25,
    )

    # Step 3 — Threshold
    binary = threshold_image(gray)
    yield step_event(
        label='Threshold',
        description='Otsu thresholding applied — stripes separated from background.',
        image_b64=array_to_base64(binary, cmap='gray'),
        progress=40,
    )

    # Step 4 — Clean
    cleaned = clean_binary(binary)
    yield step_event(
        label='Cleaned',
        description='Morphological cleanup — noise and small regions removed.',
        image_b64=array_to_base64(cleaned, cmap='gray'),
        progress=55,
    )

    # Step 5 — Align
    aligned = align_stripes(cleaned)
    yield step_event(
        label='Aligned',
        description='Stripes rotated to vertical orientation for projection.',
        image_b64=array_to_base64(aligned, cmap='gray'),
        progress=65,
    )

    # Step 6 — Project to signal
    signal = project_to_signal(aligned)
    normalized = normalize_signal(signal)
    yield step_event(
        label='Signal',
        description='2D stripe pattern collapsed to 1D waveform via column projection.',
        image_b64=signal_to_base64(normalized),
        progress=75,
    )

    # Step 7 — Decode to UPC
    eleven_digits = signal_to_barcode_string(normalized)
    upc = build_upc(eleven_digits)
    yield step_event(
        label='Barcode',
        description=f'Signal quantized to UPC-A candidate: {upc}',
        progress=88,
        data={'upc_candidate': upc},
    )

    # Step 8 — Lookup
    yield step_event(
        label='Searching',
        description='Scanning Open Food Facts for the nearest product...',
        progress=90,
    )

    result = find_nearest_product(upc)

    if result is None:
        yield {
            'error': f'No product found near UPC {upc}. Try a different zebra.'
        }
        return

    yield step_event(
        label='Result',
        description=f'Found: {result["product"]}',
        progress=100,
        data={'result': result},
    )