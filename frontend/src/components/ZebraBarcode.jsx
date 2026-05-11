import JsBarcode from 'jsbarcode'
import { useRef, useEffect } from 'react'
 
// Renders the zebra-derived UPC as a scannable barcode on an SVG element.
// This is the barcode the zebra became, not the product's own barcode.
export default function ZebraBarcode({ upc }) {
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
