import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
 
// Renders the zebra-derived UPC as a scannable barcode on an SVG element.
// This is the barcode the zebra became, not the product's own barcode.
function ZebraBarcode({ upc }) {
  const svgRef = useRef(null)
 
  useEffect(() => {
    if (!svgRef.current || !upc) return
    try {
      JsBarcode(svgRef.current, upc, {
        format:       'UPC',
        lineColor:    '#F5F0E8',
        background:   'transparent',
        width:        2,
        height:       64,
        displayValue: true,
        font:         'JetBrains Mono, monospace',
        fontSize:     12,
        textMargin:   5,
      })
    } catch {
      // JsBarcode will throw if the UPC candidate fails its own
      // validation — the fallback below renders the raw digits instead
    }
  }, [upc])
 
  return (
    <div className="results-page__barcode-box">
      {upc
        ? <svg ref={svgRef} className="results-page__barcode-svg" />
        : <span className="results-page__barcode-fallback mono">{upc ?? '—'}</span>
      }
    </div>
  )
}


/* Note -
product.product             the product name string — yes, confusingly named
product.upc                 the matched UPC string (may differ from the zebra's UPC)
product.image               product photo URL — may be an array from UPC ItemDB
product.offers              array of { merchant, link, price } objects
product.offers[0]           first/best offer
product.offers[0].link      retailer URL
product.offers[0].merchant  retailer name e.g. "Amazon"
*/


export default function ResultsPage({originalImage, upc, product, onReset}) {
    // both the prop and the name of the product share the same name
    // so we destructure it here for less confusion later
    const name       = product?.product ?? 'Unknown Product'
    const imgSrc     = Array.isArray(product?.image)
        ? product.image[0]       // UPC ItemDB returns an images array
        : product?.image ?? null
    const offers     = product?.offers ?? []
    const firstOffer = offers[0] ?? null

  return (
    <div className="results-page page">
 
      {/* ── Title ─────────────────────────────────────────────── */}
      <div className="results-page__header fade-up">
        <div className="accent-bar results-page__accent-bar" />
        <h1 className="results-page__title display">
          Your zebra is a{' '}
          <span className="results-page__title-accent">{name}</span>
        </h1>
      </div>
 
      {/* ── Main grid — left panel + right panel ──────────────── */}
      <div className="results-page__grid fade-up">
 
        {/* Left — original image stacked above barcode */}
        <div className="results-page__left">
 
          <div className="results-page__original-image">
            <span className="results-page__original-label mono">You gave:</span>
            <img
              className="results-page__original-img"
              src={originalImage}
              alt="Original zebra"
            />
          </div>
 
          <div className="results-page__upc">
            <span className="results-page__upc-label mono">Which became:</span>
            <ZebraBarcode upc={upc} />
          </div>
 
        </div>
 
        {/* Right — product details */}
        <div className="results-page__product-area">
 
          {imgSrc && (
            <div className="results-page__product-image-wrap">
              <img
                className="results-page__product-img"
                src={imgSrc}
                alt={name}
              />
            </div>
          )}
 
          <h2 className="results-page__product-title">{name}</h2>
 
          {/* Retailer offer links — show all available */}
          {offers.length > 0 ? (
            <div className="results-page__offers">
              {offers.map((offer, i) => (
                <a
                  key={i}
                  className="btn btn-ghost results-page__offer-link"
                  href={offer.link ?? offer.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {offer.merchant ?? offer.retailer ?? 'View'} →
                </a>
              ))}
            </div>
          ) : (
            <p className="results-page__no-offers">
              No retailer links found for this product.
            </p>
          )}
 
        </div>
      </div>
 
      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="results-page__actions fade-up">
        <button className="btn btn-primary" onClick={onReset}>
          Scan Again
        </button>
      </div>
 
    </div>
  )
}