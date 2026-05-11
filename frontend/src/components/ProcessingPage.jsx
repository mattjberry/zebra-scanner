import { useState, useEffect } from 'react'
import ZebraBarcode from './ZebraBarcode'

export default function ProcessingPage({ connecting, step, progress, confidence, upc }) {
    
  const [displayed, setDisplayed] = useState({ label: '', description: '', image: null })

  const isDetectionStep = displayed.label === 'Zebra Detected'

  useEffect(() => {
    if (!step.image) {
      setDisplayed(step)
      return
    }
    const img = new window.Image()
    img.onload  = () => setDisplayed(step)
    img.onerror = () => setDisplayed(step)
    img.src = `data:image/png;base64,${step.image}`
    return () => { img.onload = null; img.onerror = null }
  }, [step.image, step.label])

  return (
    <div className="processing-page page">

      {/* ── Header — step label or connecting state ───────────── */}
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
                   - {confidence}% Confidence
                </span>
              )}
            </div>

            <p className="processing-page__step-description">
              {displayed.description || 'Analysing image...'}
            </p>
          </div>
        )}
      </div>

      {/* ── Image area — skeleton until first frame arrives ───── */}
      <div className="processing-page__image-area">
        {/* four cases for:
            1. connecting to backend 2. barcode step special case
            3. image loading in 4. image displayed 
          */}
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

      {/* ── Footer — progress bar ────────────────────────────── */}
      <div className="processing-page__footer">
        <div className="processing-page__progress-header">
          <span className="processing-page__progress-label mono">DECODING</span>
          <span className="processing-page__progress-value mono">{progress}%</span>
        </div>
        <div className="progress-track">
          {/* width must stay inline — it's driven by live state */}
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

    </div>
  )
}