import { useState, useEffect, useRef, useCallback } from 'react'
import ZebraBarcode from './ZebraBarcode'

const DISPLAY_MS = 1000  // minimum time each step is shown

export default function ProcessingPage({ connecting, step, progress, confidence, upc }) {
  const [displayed, setDisplayed] = useState({ label: '', description: '', image: null })
  const queueRef = useRef([])    // steps waiting to be shown
  const busyRef  = useRef(false) // true while a step is being displayed

  const processNext = useCallback(() => {
    if (busyRef.current || queueRef.current.length === 0) return
    busyRef.current = true
    const next = queueRef.current[0]

    const advance = () => {
      setDisplayed(next)
      // Hold this step for DISPLAY_MS, then move to the next queued step
      setTimeout(() => {
        queueRef.current.shift()
        busyRef.current = false
        processNext()
      }, DISPLAY_MS)
    }

    if (!next.image) {
      // No image to preload — show immediately, hold for DISPLAY_MS
      advance()
      return
    }

    // Preload the image before showing the step
    const img = new window.Image()
    img.onload  = advance
    img.onerror = advance  // show anyway if image fails
    img.src = `data:image/png;base64,${next.image}`
  }, [])

  // Each new step prop gets added to the queue
  useEffect(() => {
    if (!step.label) return
    queueRef.current.push(step)
    processNext()
  }, [step.label, step.image, processNext])

  const isDetectionStep = displayed.label === 'Zebra Detected'

  return (
    <div className="processing-page page">
      <div className="processing-page__header">
        <div className="accent-bar processing-page__accent-bar" />
        {connecting ? (
          <div className="processing-page__connecting">
            <div className="processing-page__connecting-dot" aria-hidden="true" />
            <span className="processing-page__connecting-label mono">
              CONNECTING TO PIPELINE...
            </span>
          </div>
        ) : (
          <div className="processing-page__step">
            <div className="processing-page__step-header">
              <span className="processing-page__step-label mono">
                {displayed.label || 'Processing'}
              </span>
              {isDetectionStep && confidence !== null && (
                <span className="processing-page__confidence-badge mono">
                  — {confidence}% Confidence
                </span>
              )}
            </div>
            <p className="processing-page__step-description">
              {displayed.description || 'Analysing image...'}
            </p>
          </div>
        )}
      </div>

      <div className="processing-page__image-area">
        {connecting ? (
          <div className="processing-page__skeleton">
            <div className="processing-page__spinner" aria-label="Loading" />
          </div>
        ) : displayed.label === 'Barcode' && upc ? (
          <div className="processing-page__barcode-wrap fade-up">
            <ZebraBarcode upc={upc} />
          </div>
        ) : !displayed.image ? (
          <div className="processing-page__skeleton">
            <div className="processing-page__spinner" aria-label="Loading" />
          </div>
        ) : (
          <img
            key={displayed.label}
            className="processing-page__image fade-up"
            src={`data:image/png;base64,${displayed.image}`}
            alt={`Pipeline step: ${displayed.label}`}
          />
        )}
      </div>

      <div className="processing-page__footer">
        <div className="processing-page__progress-header">
          <span className="processing-page__progress-label mono">DECODING</span>
          <span className="processing-page__progress-value mono">{progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}