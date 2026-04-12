/**
 * Fetch recent sponsored legislation for a member from Congress.gov v3.
 * @param {string} bioguideId
 * @param {string} apiKey
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{ number: string, displayTitle: string, introducedDate: string, congress: number|null }>>}
 */
export async function fetchSponsoredBillsFromCongress(bioguideId, apiKey, { limit = 25 } = {}) {
	if (!apiKey || !bioguideId) return [];

	const url = new URL(
		`https://api.congress.gov/v3/member/${encodeURIComponent(bioguideId)}/sponsored-legislation`
	);
	url.searchParams.set('api_key', apiKey);
	url.searchParams.set('limit', String(limit));
	url.searchParams.set('offset', '0');
	url.searchParams.set('format', 'json');

	const res = await fetch(url.toString());
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
			const type = (bill.type || '').toString().toUpperCase();
			const num = (bill.number ?? '').toString();
			if (!type || !num) return null;
			return {
				number: `${type}${num}`,
				displayTitle: bill.title || 'Untitled',
				introducedDate: bill.introducedDate || '',
				congress: bill.congress ?? null
			};
		})
		.filter(Boolean);
}
