export default function ResultsPage({originalImage, upc, product, reset}) {
    return 
        <div className="results-page">
            <div className="results-page__original-image">
                <span className="results-page__original-label mono">
                    You gave:
                </span>
                <img src={originalImage}></img>
            </div>
            <div className="results-page__upc">
                <span className="results-page__upc-label mono">
                    Which became:
                </span>
                <img src={upc}></img>
            </div>
            <div className="results-page__product-area">
                <span className="results-page__product-title mono">
                    {product.product}
                </span>
                <img src={product.image}></img>
                {/* go to first offer link found from look up */}
                <button type="button" onClick={product.offers[1]}>Buy Now!</button>

                <button type="button" onClick={reset}>Scan Again!</button>
            </div>
        </div>
}