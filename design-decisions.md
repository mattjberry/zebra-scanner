# Zebra Barcode — Design Decisions

This document is a record of the key architectural and implementation decisions made during the design phase of this project, including the reasoning behind each choice. Intended as the in-depth companion to the README.

---

## Project Overview

The Zebra Barcode project is a novelty web application that accepts a photo of a
zebra, applies an image processing pipeline to interpret the animal's stripes as
a barcode, decodes that barcode into a UPC candidate, and looks up the nearest
matching product from a retail database. The result is a surprise product link —
the "product" that the zebra most closely resembles.

---

## Core Concept

I thought of this project idea during an Image Processing class I took during
the fourth year of my degree, CMPT487 at the University of Saskatchewan.
I ruminated on the idea for a while and when I finally had some free time I
whipped it up.

### Barcode → UPC Relationship
A UPC (Universal Product Code) is the numerical representation of a physical
barcode. The visual barcode (black and white stripes in the UPC-A symbology) is
simply an optical encoding of a 12-digit number. That number breaks down as:

- **Digits 1–6:** Manufacturer ID
- **Digits 7–11:** Product ID
- **Digit 12:** Check digit (mathematically derived from the first 11)

The check digit is computed using a weighted sum of the first 11 digits mod 10,
which means a randomly generated 11-digit string can always be made into a valid
UPC by computing and appending the correct check digit. This property is
exploited in the pipeline.

### Why Zebras
Zebra stripes are high-contrast, roughly parallel, and cover large areas of the
animal — making them a plausible source of barcode-like signal. The
image processing pipeline is designed to take advantage of these properties.

---

## Architecture Decisions

### Decision: React Frontend + Django REST API
**Chosen over:** Django full-stack with templates, or FastAPI backend.

**Reasoning:**
The image processing pipeline has meaningful latency and produces multiple
intermediate visual outputs (thresholded image, cleaned binary, 1D signal plot,
etc.) that benefit from a rich, interactive frontend. Django's built-in
templating system is optimised for server-rendered content pages and becomes
clunky when the UI needs to update progressively without full page reloads.

Separating the frontend (React) from the backend (Django REST Framework) is also
the dominant pattern in professional Django projects today. It teaches DRF, the
more transferable skill, and keeps concerns cleanly separated.

FastAPI was considered as an alternative backend. It would have been a slightly
better fit for a pure API given its native async support, but Django was chosen
because I wanted to get some experience with it.

### Decision: Stateless Pipeline — No Database
**Chosen over:** PostgreSQL with image/result persistence, user accounts.

**Reasoning:**
The core value of the application is a just the single comedic value of discovering
what product a zebra maps to. There is no compelling reason for a user to return
and review past results. Adding user accounts, sessions, and a database would
introduce auth flows, security considerations, migration management, and
operational overhead that are pure complexity for a novelty MVP.

The stateless design means every request is fully self-contained: image in,
result out, connection closed. This also makes the application easier to deploy,
scale, and reason about.

If the application gains enough traction that persistence becomes genuinely
useful, the Django ORM infrastructure can be layered in later without changing
the pipeline architecture.

### Decision: No Celery, No Redis
**Chosen over:** Celery task queue with Redis broker for background processing.

**Reasoning:**
Celery solves the problem of long-running tasks blocking HTTP connections. It was
included in the initial scaffold but removed after deciding to go forward with
Server-Sent Events (SSE) as the delivery mechanism for pipeline progress.

With SSE, the HTTP connection intentionally stays open while the pipeline runs,
streaming results back to the client progressively. This eliminates the need for
background task offloading entirely — the synchronous pipeline and the streaming
response serve the same purpose Celery would have, with less infrastructure.

Celery would become relevant again if processing times grew long enough to
approach server timeout limits, or if the app needed to queue work across
multiple requests.

### Decision: Server-Sent Events (SSE) for Pipeline Progress
**Chosen over:** Polling a task-status endpoint, WebSockets.

**Reasoning:**
The pipeline produces a natural sequence of discrete steps, each yielding an
intermediate result. SSE is well-suited to this pattern, it is a native browser
API, unidirectional (server → client), and works over standard HTTP without a
separate protocol handshake.

WebSockets were considered but are bidirectional and require more setup
(channels, ASGI server) for what is essentially a one-way data stream.

Polling via a Celery task-status endpoint was also considered, but it introduces
artificial latency between steps and requires the task queue infrastructure that
was otherwise removed.

With SSE, each completed pipeline step immediately yields a JSON event containing
a step label, description, progress percentage, and a base64-encoded preview
image. The frontend appends each event to a live progress display as it arrives.

### Decision: In-Memory Image Handling
**Chosen over:** Writing uploaded images to disk (Django MEDIA_ROOT).

**Reasoning:**
Since the application is stateless and has no database, writing uploaded images
to disk would be an anomaly, a temporary file that needs to be created, tracked,
and cleaned up within a single request lifecycle. This introduces failure modes
(cleanup on error, disk space management) without any benefit.

The uploaded image is instead read into a `BytesIO` buffer immediately on
receipt. The scikit-image pipeline operates on this buffer and the resulting
numpy arrays in memory. Nothing touches disk at any point.

This is made possible by scikit-image's `io.imread()` accepting file-like objects
directly, and by Matplotlib's ability to render plots to `BytesIO` buffers for
base64 encoding.

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend framework | React (Vite) | Component model suits progressive step display; Vite is faster than CRA |
| Backend framework | Django + Django REST Framework | Developer learning goal; DRF is the industry standard Django API layer |
| Image processing | scikit-image, NumPy | Developer familiarity; excellent 2D image manipulation primitives |
| Visualisation | Matplotlib (Agg backend) | Renders pipeline step plots to in-memory buffers for SSE transmission |
| Barcode scanning | ZXing-js (frontend) | Handles both file upload and live camera scanning; open source |
| UPC lookup | UPC ItemDB API | Free tier; returns product metadata and retailer links by UPC |
| Nearest-neighbour UPC | Open Food Facts database dump | Provides a local UPC corpus for edit-distance matching when exact lookup fails |
| Containerisation | Docker + Docker Compose | Single `docker compose up` brings the full stack online |
| Inter-service transport | SSE over HTTP | No WebSocket infrastructure needed; native browser support |

---

## Image Processing Pipeline

The pipeline runs server-side in Python and consists of the following steps, each
yielding an SSE event with a preview image:

1. **Load** — Read the uploaded image from a `BytesIO` buffer into a numpy array.
2. **Grayscale** — Convert RGB to grayscale to isolate luminance information.
3. **Threshold** — Apply Otsu thresholding to produce a binary image. Otsu is
   well-suited to high-contrast stripe patterns as it automatically finds the
   optimal threshold value.
4. **Clean** — Morphological cleanup using `remove_small_objects` to eliminate
   noise that would corrupt the 1D signal.
5. **Align** — Detect dominant stripe orientation using connected region
   properties and rotate the image so stripes run vertically. This ensures the
   column-projection in the next step captures the stripe pattern correctly
   regardless of the zebra's pose.
6. **Project to signal** — Collapse the 2D binary image to a 1D waveform by
   averaging each column. Vertical stripes produce a waveform of alternating
   high and low values.
7. **Normalise** — Scale the signal to the 0–1 range.
8. **Decode to UPC** — Run-length encode the binarised signal, normalise run
   widths relative to the median run, and match each group of 4 runs to the
   closest UPC-A digit pattern. Compute the check digit from the resulting 11
   digits to produce a valid 12-digit UPC-A candidate.
9. **Lookup** — Query UPC ItemDB with the candidate UPC. If no exact match is
   found, find the nearest UPC in the Open Food Facts corpus by numeric or
   edit-distance proximity.

---

## UPC Translation Strategy

### Check Digit Validity
Rather than generating a random 12-digit string (most of which would fail the
check digit validation), the pipeline generates 11 digits from the stripe signal
and computes the mathematically correct 12th digit. This guarantees the produced
code is always a structurally valid UPC-A, even if it does not correspond to a
real product.

### Nearest-Neighbour Matching
When the generated UPC does not exist in any retail database, the nearest valid
UPC is found by searching a local corpus (Open Food Facts database dump) for the
UPC with the smallest numeric or Levenshtein edit distance. This "nearest zebra
barcode" concept is central to the novelty of the application, the result is
deterministic given the same image, but surprising in what it finds.

This was chosen over alternatives:
- **Force validity only** — would frequently return no product.
- **Perturb until hit** — non-deterministic, arbitrary results.
- **Nearest neighbour** — deterministic, semantically interesting, produces
  results for every input.

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
- No database container, no Redis container, no reverse proxy.
- Live code reloading is enabled in both containers via volume mounts, so changes
  on the host are reflected immediately without rebuilding.

---

## Decisions Deferred to Later Phases

- **Zebra verification (CNN):** An optional gate to reject non-zebra images before
  running the expensive pipeline. Likely to use a pretrained model via
  HuggingFace zero-shot classification rather than training from scratch.
- **UPC ItemDB integration:** The `lookup_nearest_upc()` function is currently
  stubbed. Full integration including API key management and fallback to the
  local nearest-neighbour search is a next phase task.
- **Production deployment:** The current Docker setup targets development.
  Production would add a WSGI server (Gunicorn), a reverse proxy (Nginx or
  Caddy), and tightened CORS/ALLOWED_HOSTS settings.
- **Rate limiting:** No protection against abuse is in place for the MVP. If
  deployed publicly, the image processing endpoint would need rate limiting given
  the CPU cost of the pipeline.
- **Error UX:** The frontend will need thoughtful handling of pipeline errors
  (non-zebra image, corrupt upload, lookup failure) that goes beyond the basic
  error event currently emitted by the backend.