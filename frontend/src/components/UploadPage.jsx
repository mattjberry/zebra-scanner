import { useState, useRef, useCallback } from 'react'

export default function UploadPage({ onUpload }) {
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview]   = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const inputRef = useRef(null)

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleSubmit = useCallback(() => {
    if (selectedFile) onUpload(selectedFile)
  }, [selectedFile, onUpload])

  // Build dropzone class string from state
  const dropzoneClasses = [
    'upload-page__dropzone',
    dragging  && 'upload-page__dropzone--dragging',
    preview   && 'upload-page__dropzone--filled',
  ].filter(Boolean).join(' ')

  return (
    <div className="upload-page page">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="upload-page__header fade-up">
        <div className="accent-bar upload-page__accent-bar" />
        <h1 className="upload-page__title display">
          Zebra&nbsp;<span className="upload-page__title-accent">Barcode</span>
        </h1>
        <p className="upload-page__tagline">
          Upload a photo of a zebra. We'll read its stripes as a barcode,
          and find the nearest product in existence. Science. Probably.
        </p>
      </div>

      {/* ── Drop zone ────────────────────────────────────────── */}
      <div
        className="upload-page__dropzone-wrapper fade-up"
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div
          className={dropzoneClasses}
          onClick={() => !preview && inputRef.current?.click()}
        >
          {preview ? (
            <div className="upload-page__preview">
              <img
                className="upload-page__preview-img"
                src={preview}
                alt="Selected zebra"
              />
              <button
                className="upload-page__preview-change mono"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
              >
                CHANGE
              </button>
            </div>
          ) : (
            <div className="upload-page__empty">
              <span className="upload-page__empty-icon" aria-hidden="true">▤</span>
              <p className="upload-page__empty-primary mono">DROP A ZEBRA HERE</p>
              <p className="upload-page__empty-secondary">or click to browse</p>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="upload-page__file-input"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {/* ── Submit ───────────────────────────────────────────── */}
      {selectedFile && (
        <div className="upload-page__submit fade-up">
          <button className="btn btn-primary" onClick={handleSubmit}>
            Decode Stripes →
          </button>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────── */}
      <p className="upload-page__footer mono fade-up">
        NO DATA STORED — IMAGE PROCESSED IN MEMORY AND DISCARDED
      </p>

    </div>
  )
}