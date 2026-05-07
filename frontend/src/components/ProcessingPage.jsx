export default function ProcessingPage({ connecting, step, progress }) {
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
            <span className="processing-page__step-label mono">
              {step.label || 'Processing'}
            </span>
            <p className="processing-page__step-description">
              {step.description || 'Analysing image...'}
            </p>
          </div>
        )}
      </div>

      {/* ── Image area — skeleton until first frame arrives ───── */}
      <div className="processing-page__image-area">
        {connecting || !step.image ? (
          <div className="processing-page__skeleton">
            <div className="processing-page__spinner" aria-label="Loading" />
          </div>
        ) : (
          <img
            key={step.label}        /* remount triggers fade-up on each new step */
            className="processing-page__image fade-up"
            src={`data:image/png;base64,${step.image}`}
            alt={`Pipeline step: ${step.label}`}
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