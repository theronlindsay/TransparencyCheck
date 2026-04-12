/** Thrown when OpenFEC returns HTTP 429; callers should stop further OpenFEC requests in that flow. */
export class OpenFECRateLimitError extends Error {
	constructor(message = 'OpenFEC rate limit exceeded (429)') {
		super(message);
		this.name = 'OpenFECRateLimitError';
	}
}
