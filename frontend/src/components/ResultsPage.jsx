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
    product_name = product.product;

    return (
        <div className="results-page">
            {/* display original given image */}
            <div className="results-page__original-image">
                <span className="results-page__original-label mono">
                    You gave:
                </span>
                <img src={originalImage}></img>
            </div>

            {/* display the upc barcode that the image became */}
            <div className="results-page__upc">
                <span className="results-page__upc-label mono">
                    Which became:
                </span>
                <img src={upc}></img>
            </div>

            {/* display resulting product */}
            <div className="results-page__product-area">
                <span className="results-page__product-title mono">
                    {product_name}
                </span>
                <img src={product.image}></img>
                {/* go to first offer link found from look up */}
                <button type="button" onClick={() => window.open(product.offers[0]?.url, '_blank')}>
                    Buy Now!
                </button>

                {/* reset state and go back to the upload page */}
                <button type="button" onClick={onReset}>Scan Again!</button>
            </div>
        </div>
    );
}