export default function ResultsPage({originalImage, upc, product, reset}) {
    return 
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
                    {product.product}
                </span>
                <img src={product.image}></img>
                {/* go to first offer link found from look up */}
                <button type="button" onClick={product.offers[1]}>Buy Now!</button>

                {/* reset state and go back to the upload page */}
                <button type="button" onClick={reset}>Scan Again!</button>
            </div>
        </div>
}