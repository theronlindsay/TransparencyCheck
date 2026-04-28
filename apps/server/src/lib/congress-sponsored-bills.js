function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error) {
	return (
		error?.name === 'AbortError' ||
		error?.message?.includes('terminated') ||
		error?.cause?.code === 'UND_ERR_SOCKET'
	);
}

/**
 * Fetch recent sponsored legislation for a member from Congress.gov v3.
 * @param {string} bioguideId
 * @param {string} apiKey
 * @param {{ limit?: number, retries?: number, timeoutMs?: number }} [opts]
 * @returns {Promise<Array<{ billId: string, displayTitle: string, introducedDate: string, congress: number|null }>>}
 */
export async function fetchSponsoredBillsFromCongress(
	bioguideId,
	apiKey,
	{ limit = 25, retries = 2, timeoutMs = 20000 } = {}
) {
	if (!apiKey || !bioguideId) return [];

	const url = new URL(
		`https://api.congress.gov/v3/member/${encodeURIComponent(bioguideId)}/sponsored-legislation`
	);
	url.searchParams.set('api_key', apiKey);
	url.searchParams.set('limit', String(limit));
	url.searchParams.set('offset', '0');
	url.searchParams.set('format', 'json');

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const res = await fetch(url.toString(), {
				signal: AbortSignal.timeout(timeoutMs)
			});
			if (!res.ok) {
				console.warn(
					`[sponsored-bills] Congress API ${res.status} for member ${bioguideId}:`,
					res.statusText
				);
				return [];
			}

			const data = await res.json();
			const raw = data.sponsoredLegislation || data.bills || [];

			return raw
				.map((bill) => {
					const type = (bill.type || '').toString().toLowerCase();
					const num = (bill.number ?? '').toString();
					if (!type || !num) return null;
					return {
						billId: `${type}${num}`,
						displayTitle: bill.title || 'Untitled',
						introducedDate: bill.introducedDate || '',
						congress: bill.congress ?? null
					};
				})
				.filter(Boolean);
		} catch (error) {
			const lastAttempt = attempt >= retries;
			if (!isRetryableFetchError(error) || lastAttempt) {
				throw error;
			}

			console.warn(
				`[sponsored-bills] Retryable fetch failure for ${bioguideId} on attempt ${attempt + 1}/${retries + 1}:`,
				error?.message || error
			);
			await sleep(500 * (attempt + 1));
		}
	}

	return [];
}
