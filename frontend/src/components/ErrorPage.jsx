export default function ErrorPage({errorMessage, reset}) {
    return (
        <div className="error-page">
            <span className="error-page__message mono">
                Uh oh! {errorMessage}
            </span>

            <button type="button" onClick={reset} className="error-page__reset-button">
                Go back
            </button>
        </div>
    );
}