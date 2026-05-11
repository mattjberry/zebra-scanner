import { useState, useCallback } from 'react'
import UploadPage from './components/UploadPage'
import ProcessingPage from './components/ProcessingPage'
import ResultsPage from './components/ResultsPage'
import ErrorPage from './components/ErrorPage'
import './index.css'

// Populated from .env — falls back to localhost for running outside Docker
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const INITIAL_STATE = {
  view: 'upload',         // 'upload' | 'processing' | 'results' | 'error'
  originalImage: null,    // object URL kept in memory — never hits disk
  connecting: false,      // true between upload submit and first SSE event
  step: {
    label: '',            // e.g. "Threshold"
    description: '',      // e.g. "Otsu thresholding applied..."
    image: null,          // base64 PNG of the current pipeline stage
  },
  confidence: null,
  progress: 0,            // 0–100 from pipeline events
  upc: null,              // 12-digit UPC-A candidate string
  product: null,          // { product, upc, image, offers[] } from lookup
  errorMessage: '',
}

// ─── SSE stream parser ────────────────────────────────────────────────────
// EventSource only supports GET, so we drive SSE manually over a POST fetch.
// Chunks arrive as raw bytes, we decode and split on the SSE \n\n delimiter.
async function* readSSEStream(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by double newlines
    const chunks = buffer.split('\n\n')

    // The last element may be an incomplete chunk, hold it in the buffer
    buffer = chunks.pop()

    for (const chunk of chunks) {
      const line = chunk.replace(/^data: /, '').trim()
      if (!line) continue
      try {
        yield JSON.parse(line)
      } catch {
        // Ignore malformed chunks
      }
    }
  }
}

// ─── Component ───────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(INITIAL_STATE)

  // ── Reset — wipes all state and returns to upload view
  const reset = useCallback(() => {
    if (state.originalImage) {
        URL.revokeObjectURL(state.originalImage)
    }
    setState(INITIAL_STATE)
  }, [state.originalImage])

  // ── Upload handler — called by UploadPage with the selected File object
  const handleUpload = useCallback(async (file) => {

    // Store original image immediately as an object URL so it persists
    // through to the results page without a second server round-trip
    const originalImage = URL.createObjectURL(file)

    setState(prev => ({
      ...prev,
      view: 'processing',
      originalImage,
      connecting: true,
      progress: 0,
      step: { label: '', description: '', image: null },
      upc: null,
      product: null,
      errorMessage: '',
    }))

    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await fetch(`${API_URL}/api/process/`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      // Iterate over parsed SSE events as they arrive
      for await (const event of readSSEStream(response)) {

        // First event confirms the connection is live
        setState(prev => ({ ...prev, connecting: false }))

        if (event.error) {
          setState(prev => ({ ...prev, view: 'error', errorMessage: event.error }))
          return
        }

        if (event.done) {
            return
        }

        setState(prev => ({
          ...prev,
          ...(event.progress !== undefined  && { progress: event.progress }),
          ...(event.step                    && {
            step: {
              label:       event.step,
              description: event.description || '',
              image:       event.image || null,
            },
          }),
          ...(event.confidence !== undefined && { confidence: event.confidence }),
          ...(event.upc_candidate           && { upc: event.upc_candidate }),
          ...(event.result                  && { product: event.result, view: 'results' }),
        }))
      }

    } catch (err) {
      setState(prev => ({
        ...prev,
        view: 'error',
        errorMessage: err.message || 'An unexpected error occurred.',
      }))
    }
  }, [])

  const { view, originalImage, connecting, step, progress, confidence, upc, product, errorMessage } = state

  return (
    // app--{view} modifier lets CSS target view-specific backgrounds/transitions
    <div className={`app app--${view}`}>

      {/* Decorative stripe texture layer — can be hidden per-view via CSS */}
      <div className="app__stripe-layer" aria-hidden="true" />

      {/* Active view — swap child component based on state machine */}
      <div className="app__view">

        {view === 'upload' && (
          <UploadPage onUpload={handleUpload} />
        )}

        {view === 'processing' && (
          <ProcessingPage
            connecting={connecting}
            step={step}
            progress={progress}
            confidence={confidence}
            upc={upc}
          />
        )}

        {view === 'results' && (
          <ResultsPage
            originalImage={originalImage}
            upc={upc}
            product={product}
            onReset={reset}
          />
        )}

        {view === 'error' && (
          <ErrorPage message={errorMessage} onReset={reset} />
        )}

      </div>
    </div>
  )
}