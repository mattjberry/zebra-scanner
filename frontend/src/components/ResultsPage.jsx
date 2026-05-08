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