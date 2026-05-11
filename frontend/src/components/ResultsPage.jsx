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
Open Food Facts response shape (after normalisation in lookup.py):
   product.product   the product name string (from OFF's product_name field)
   product.upc       the matched UPC — may differ from the zebra's generated UPC
   product.image     single image URL string (from OFF's image_front_url)
   product.offers    always an empty array from OFF — no retailer data available

    Some seemingly unused code (like product.offers) is left in place in case 
    The data source ever changes, then this component shouldn't need 
    to be overly modified to work
   */


export default function ResultsPage({originalImage, upc, product, onReset}) {
    // both the prop and the name of the product share the same name
    // so we destructure it here for less confusion later
    const name       = product?.product ?? 'Unknown Product'
    const imgSrc     = Array.isArray(product?.image)
        ? product.image[0]       // UPC ItemDB returns an images array
        : product?.image ?? null
    const offers     = product?.offers ?? []

  // Use the matched product's UPC for the OFF link, not the zebra-derived one,
  // since the zebra UPC may not have existed in the database
  const offUrl = product?.upc
    ? `https://world.openfoodfacts.org/product/${product.upc}`
    : null


  const [imgLoaded, setImgLoaded] = useState(false)


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
              {/* Spinner shown until image loads */}
              {!imgLoaded && (
                <div className="results-page__product-img-spinner">
                  <div className="processing-page__spinner" />
                </div>
              )}
              <img
                className={`results-page__product-img ${
                  imgLoaded ? '' : 'results-page__product-img--hidden'
                }`}
                src={imgSrc}
                alt={name}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgLoaded(true)}
              />
            </div>
          )}
 
          <h2 className="results-page__product-title">{name}</h2>
 
          {/* Retailer links if available, otherwise fall back to OFF page */}
          <div className="results-page__offers">
            {offers.length > 0
              ? offers.map((offer, i) => (
                  <a
                    key={i}
                    className="btn btn-ghost results-page__offer-link"
                    href={offer.link ?? offer.url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {offer.merchant ?? offer.retailer ?? 'View'} →
                  </a>
                ))
              : offUrl && (
                  <a
                    className="btn btn-ghost results-page__offer-link"
                    href={offUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Open Food Facts →
                  </a>
                )
            }
          </div>
 
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