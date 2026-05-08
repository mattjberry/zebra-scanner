export default function ErrorPage({message, onReset}) {
  return (
    <div className="error-page page">
 
      {/* ── Decorative broken barcode ────────────────────────── */}
      <div className="error-page__icon mono" aria-hidden="true">
        ▌▌ ▌▌▌ ▌ ▌▌▌ ▌▌
      </div>
 
      {/* ── Message ──────────────────────────────────────────── */}
      <div className="error-page__body">
        <div className="accent-bar error-page__accent-bar" />
        <h2 className="error-page__title display">Decode Failed</h2>
        <p className="error-page__message mono">
          {message || 'An unexpected error occurred during processing.'}
        </p>
      </div>
 
      {/* ── Action ───────────────────────────────────────────── */}
      <button className="btn btn-ghost error-page__reset-button" onClick={onReset}>
        ← Go Back
      </button>
 
    </div>
  )
}