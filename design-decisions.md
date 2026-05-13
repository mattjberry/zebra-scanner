# Zebra Barcode — Design Decisions

This document is a record of the key architectural and implementation decisions
made throughout this project, including the reasoning behind each choice.
Intended as the in-depth companion to the README.

---

## Project Overview

The Zebra Barcode project is a novelty web application that accepts a photo of a
zebra, applies an image processing pipeline to interpret the animal's stripes as
a barcode, decodes that barcode into a UPC candidate, and looks up the nearest
matching product from a grocery database. The result is a surprise product — the
food item that the zebra most closely resembles.

---

## Origin

I thought of this project during an image processing class I took in my fourth
year at the University of Saskatchewan — CMPT487. The idea stuck with me and I
kept coming back to it. When I finally had some free time I decided to build it
properly, using it as an opportunity to learn Django and get more hands-on with
scikit-image and React.

---

## Core Concept

### Barcode → UPC Relationship

A UPC (Universal Product Code) is the numerical representation of a physical
barcode. The visual barcode (black and white stripes in the UPC-A symbology) is
simply an optical encoding of a 12-digit number. That number breaks down as:

- **Digits 1–6:** Manufacturer ID
- **Digits 7–11:** Product ID
- **Digit 12:** Check digit (mathematically derived from the first 11)

The check digit is computed using a weighted sum of the first 11 digits mod 10,
which means a randomly generated 11-digit string can always be made into a valid
UPC by computing and appending the correct check digit. This property is central
to the pipeline.

### Why Zebras

Zebra stripes are high-contrast, roughly parallel, and cover large areas of the
animal — making them a genuinely plausible source of barcode-like signal. The
image processing pipeline is designed to take advantage of these properties. The
result is also just inherently funny — finding out your zebra is a wheel of
Belgian cheese or a carton of chocolate milk is the entire payoff.

---

## Architecture Decisions

### Decision: React Frontend + Django REST API
**Chosen over:** Django full-stack with templates, or FastAPI backend.

The image processing pipeline has meaningful latency and produces multiple
intermediate visual outputs — thresholded image, cleaned binary, 1D signal plot
— that benefit from a rich interactive frontend. Django's templating system is
suited to server-rendered content pages and gets clunky when the UI needs to
update progressively without full page reloads.

Separating the frontend (React) from the backend (Django REST Framework) is also
the dominant pattern in professional Django projects today. It meant I could
learn DRF properly — the more transferable skill — while keeping concerns
cleanly separated. FastAPI was considered but Django was the deliberate choice
since learning it was part of the goal.

### Decision: Stateless Pipeline — No Database
**Chosen over:** PostgreSQL with image/result persistence, user accounts.

The core value of the app is a single comedic moment — discovering what product
a zebra maps to. There is no compelling reason for a user to come back and review
past results. Adding user accounts, sessions, and a database would introduce auth
flows, security considerations, and migration management that are pure complexity
for a novelty MVP.

Every request is fully self-contained: image in, result out, connection closed.
If persistence ever becomes genuinely useful, the Django ORM can be layered in
later without changing the pipeline architecture.

### Decision: No Celery, No Redis
**Chosen over:** Celery task queue with Redis broker for background processing.

Celery was included in the initial scaffold but removed once I decided to use
Server-Sent Events for pipeline progress. With SSE the HTTP connection
intentionally stays open while the pipeline runs, streaming results back
progressively. This eliminates the need for background task offloading entirely.
Celery would become relevant again if processing times grew long enough to
approach server timeout limits.

### Decision: Server-Sent Events for Pipeline Progress
**Chosen over:** Polling a task-status endpoint, WebSockets.

The pipeline produces a natural sequence of discrete steps, each yielding an
intermediate result. SSE is a perfect fit — native browser API, unidirectional,
works over standard HTTP with no extra protocol handshake. WebSockets were
considered but are bidirectional and require more setup (channels, ASGI) for
what is essentially a one-way stream.

One subtlety: `EventSource` only supports GET requests, but I need to POST a
file. So instead of using `EventSource` directly, the frontend uses `fetch()`
and reads the response body as a `ReadableStream`, manually parsing the
`data: {...}\n\n` SSE format from the byte stream.

Each pipeline step yields a JSON event containing a step label, description,
progress percentage, and a base64-encoded preview image. The frontend displays
each one as it arrives, giving the user a live view of the zebra transforming
into a barcode.

### Decision: In-Memory Image Handling
**Chosen over:** Writing uploaded images to disk.

Since the app is stateless and has no database, writing to disk would be an
anomaly — a temporary file that needs to be created, tracked, and cleaned up
within a single request. The uploaded image is instead read into a `BytesIO`
buffer on receipt. The scikit-image pipeline operates on this buffer and the
resulting numpy arrays entirely in memory. Nothing touches disk at any point.

### Decision: Open Food Facts as the Product Database
**Chosen over:** UPC ItemDB, Barcode Lookup API, Go-UPC.

I initially planned to use UPC ItemDB but switched to Open Food Facts for a few
reasons. OFF is completely free with no API key required and a rate limit of
100 requests per minute — generous enough that I never need to think about it.
It has a publicly downloadable full database export which enabled the local
index approach described below. The food-only constraint turned out to be a
feature rather than a limitation; grocery products make for funnier results than
electronics or hardware.

### Decision: Local UPC Index + Binary Search
**Chosen over:** Numeric walk outward from the generated UPC.

My initial approach was to try the generated UPC against the OFF API, and if it
missed, walk numerically outward — trying +1, -1, +2, -2 — until finding a hit.
This worked occasionally but was unreliable. UPC space is enormous (~100 billion
possible codes) and OFF covers roughly 3 million of them — about 0.003%. A
numeric walk could easily exhaust its radius without finding anything.

The better solution was to invert the problem. OFF publishes a full CSV export
of their database (~1.5GB compressed). I wrote a one-time data preparation
script (`build_upc_index.py`) that downloads this export, extracts all valid
12/13-digit codes, normalises them to EAN-13 format, and writes them to a sorted
flat file (~40MB). This file ships with the backend container.

At runtime, finding the nearest product is:
1. Load the sorted index into memory as a list of integers on first request
2. Binary search for the insertion point of the generated UPC — O(log n)
3. Check a small window around that point to find the numerically nearest code
4. Make a single API call to OFF for the winning code

This guarantees a hit on every input since all candidates are known to exist in
the database. The first candidate succeeds in almost all cases. The 40MB index
adds to the Docker build time once but has no meaningful runtime cost.

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend framework | React (Vite) | Component model suits progressive step display; Vite is faster than CRA |
| Backend framework | Django + Django REST Framework | Learning goal; DRF is the industry standard Django API layer |
| Image processing | scikit-image, NumPy | Familiarity; excellent 2D image manipulation primitives |
| Visualisation | Matplotlib (Agg backend) | Renders pipeline step plots to in-memory buffers for SSE transmission |
| Product database | Open Food Facts API | Free, no key required, 3M+ products, full export available |
| UPC index | Local sorted flat file + binary search | Guaranteed hits, single API call, no rate limit concerns |
| Containerisation | Docker + Docker Compose | Single `docker compose up` brings the full stack online |
| Inter-service transport | SSE over HTTP | No WebSocket infrastructure needed; native browser support |

---

## Frontend Architecture

The frontend is a single-page React app built with Vite. There is no router —
navigation is handled entirely by a state machine in `App.jsx` that swaps
between four views based on the current pipeline state.

### View State Machine

```
upload  →  processing  →  results
                       ↘  error
```

All shared state lives in `App.jsx` and is passed down as props. The four views
are:

- **UploadPage** — title, tagline, drag-and-drop or file picker, submit button
- **ProcessingPage** — connecting indicator, live pipeline image, step label,
  progress bar
- **ResultsPage** — original zebra photo, rendered barcode SVG, product image
  and name, Open Food Facts link
- **ErrorPage** — dynamic error message, back button

### SSE Handling

The frontend drives the SSE stream manually using `fetch()` and a
`ReadableStream` reader rather than `EventSource`, since `EventSource` only
supports GET and the pipeline requires a POST with a file upload. The
`readSSEStream` async generator in `App.jsx` decodes the byte stream, splits on
`\n\n` delimiters, and parses each JSON event. State is updated on each event,
driving the live UI updates in `ProcessingPage`.

### Original Image Persistence

Since the backend is stateless the uploaded image is never stored server-side.
The frontend creates an object URL from the selected `File` immediately on
upload and holds it in state for the duration of the session. This is what
populates the "You gave:" panel on the results page without a second round-trip.
The object URL is revoked on reset to free memory.

### Barcode Rendering

The results page renders the zebra-derived UPC as an actual scannable barcode
using JsBarcode on an SVG element via `useEffect`. This is the UPC the zebra
became, not the product's own barcode — the two will usually differ since the
nearest-neighbour search finds a different code. If JsBarcode throws (e.g. the
generated UPC fails its own internal validation), the component falls back to
rendering the raw digit string.

### Styling

All styles live in `index.css` using BEM naming (`block__element--modifier`).
No CSS framework is used. Design tokens are defined as CSS custom properties on
`:root` and cover colours, typography, spacing, and transition timing. The
`app--{view}` modifier class on the root element allows per-view style overrides
without JavaScript.

---

## Image Processing Pipeline

The pipeline runs server-side in Python and consists of the following steps,
each yielding an SSE event with a preview image:

1. **Load** — Read the uploaded image from a `BytesIO` buffer into a numpy array.
2. **Grayscale** — Convert RGB to grayscale to isolate luminance.
3. **Threshold** — Apply Otsu thresholding to produce a binary image. Otsu is
   well-suited to high-contrast stripe patterns as it finds the optimal threshold
   automatically.
4. **Clean** — Morphological cleanup using `remove_small_objects` to eliminate
   noise that would corrupt the 1D signal.
5. **Align** — Detect dominant stripe orientation using connected region
   properties and rotate so stripes run vertically. This ensures the
   column-projection captures the stripe pattern correctly regardless of the
   zebra's pose.
6. **Project to signal** — Collapse the 2D binary image to a 1D waveform by
   averaging each column. Vertical stripes produce a waveform of alternating
   high and low values.
7. **Normalise** — Scale the signal to the 0–1 range, using the signal's own
   mean as the binarization threshold rather than a fixed 0.5.
8. **Decode to UPC** — Run-length encode the binarised signal, normalise run
   widths relative to the median run, and match each group of 4 runs to the
   closest UPC-A digit pattern. Compute the check digit from the resulting 11
   digits to produce a valid 12-digit UPC-A candidate.
9. **Lookup** — Binary search the local UPC index for the nearest known code,
   then make a single API call to Open Food Facts.

---

## Docker Architecture

Two containers, no orchestration overhead:

```
┌─────────────────────┐     HTTP / SSE      ┌──────────────────────┐
│   frontend          │ ◄─────────────────► │   backend            │
│   React + Vite      │                     │   Django + DRF       │
│   port 5173         │                     │   port 8000          │
└─────────────────────┘                     └──────────────────────┘
```

- The frontend container runs the Vite dev server with `--host` to expose it on
  the Docker network.
- The backend container runs Django's development server.
- No database container, no Redis, no reverse proxy.
- Live code reloading is enabled in both containers via volume mounts.
- The UPC index file (`backend/zebra/data/upc_index.txt`) is generated once by
  `build_upc_index.py` and committed to the repo so it ships inside the backend
  image at build time.

---

## Decisions Deferred to Later Phases

- **Zebra verification:** An optional CNN gate to reject non-zebra images before
  running the expensive pipeline. A pretrained HuggingFace zero-shot classifier
  would handle this without needing to train from scratch.
- **Production deployment:** The current setup targets development. Production
  would add Gunicorn, a reverse proxy (Nginx or Caddy), tightened
  CORS/ALLOWED_HOSTS, and proper secret management.
- **Rate limiting:** The image processing endpoint has no abuse protection. The
  CPU cost of the pipeline makes it a reasonable target for rate limiting before
  any public deployment.
- **Pipeline robustness:** Some images still produce a degenerate all-zeros
  signal. Further work on the alignment step and signal binarization would
  improve reliability beyond the current level.


---

## Addendum — Decisions Made During Implementation

### Decision: YOLO for Zebra Detection
**Chosen over:** CLIP zero-shot classification, pretrained ImageNet classifiers.

Zebra is a native COCO dataset class (class ID 22), meaning YOLOv8 was literally trained on zebras without any adaptation. As an object detection model rather than a classifier, it handles partial and obscured subjects well — it finds a zebra wherever it appears in the frame rather than requiring it to dominate the composition. The nano model (yolov8n.pt) is only ~6MB compared to ~340MB for the smallest useful CLIP model, making it much more practical to ship in the Docker image.

The model weights are downloaded at Docker build time via a single RUN command in the Dockerfile, so the first request is never stalled by a download.

### Decision: Bounding Box Crop Before Pipeline
The YOLO detection returns a bounding box around the detected zebra. Rather than discarding this information after the gate check, the image is immediately cropped to the bounding box (with a small 5% padding margin) before any further processing. This means the Otsu thresholding, morphological cleanup, and 1D signal projection all operate on stripe data only, with background, sky, and other animals removed. Signal quality improved noticeably after this change.

### Decision: PIL for Image Encoding
The original pipeline used Matplotlib to render pipeline step images at `figsize=(4,3), dpi=80` — 320×240 pixels regardless of input image size. After increasing the display size in the frontend CSS, this resolution became visibly poor. Replacing Matplotlib with direct PIL encoding gives true lossless PNG output at the full resolution of whatever scikit-image is working with. Matplotlib is still used for the signal plot since that is an actual chart rather than an image array.

A subtle gotcha: binary uint8 arrays (output of thresholding and morphological steps) have values of 0 and 1 rather than 0–255. PIL renders these as black. The fix is a range check before encoding — if `image_array.max() <= 1`, the array is scaled by 255 before passing to PIL.

### Decision: Queue-Based Step Display in ProcessingPage
The initial approach preloaded each incoming image before displaying it, but cancelled the preload when the next step arrived. This worked until high-resolution images were introduced — large images took longer than the inter-step delay to decode, so every load was being cancelled before it finished.

The fix decouples step arrival from step display entirely. Incoming steps are pushed to a queue (`queueRef`). A `busyRef` flag prevents concurrent processing. Each step is shown only after its image has fully decoded, and is held for a minimum of `DISPLAY_MS` (1000ms) before the next step is processed. This gives every step a guaranteed minimum display time regardless of network timing or image decode speed.

### Decision: Separating Backend Sleep by Step Type
SSE events for image steps were initially sent with no delay between them. React 18's automatic batching groups synchronous `setState` calls from a single event loop tick into one render, which caused intermediate steps arriving in the same network chunk to be silently dropped — only the last step in a batch was ever pushed to the queue. Adding a 300ms sleep after image steps ensures each SSE event arrives as a separate network chunk and triggers its own React render cycle.

Imageless steps (Barcode, Searching) retain a longer 1.5s sleep since they have no image decode time to create natural visual pacing.

### Decision: Delayed Results Transition
When the Result SSE event arrived, App.jsx immediately transitioned to the results view, unmounting ProcessingPage before the Searching step's 1-second display timer had finished. The fix waits 1500ms after receiving the product result before transitioning — enough time for the Searching step to complete its display cycle plus a small buffer. The product data is already in state during this window, so the results page has everything it needs the moment it mounts.