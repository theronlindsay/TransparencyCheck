import { json } from '@sveltejs/kit';
import { getBillById, getBillTextVersions, fetchAndStoreTextVersions } from '$lib/db/bills.js';
import { createTextVersionLoader } from '$lib/server/bill-text-versions.js';

const loadTextVersions = createTextVersionLoader({
	readVersions: getBillTextVersions,
	fetchVersions: fetchAndStoreTextVersions,
	getApiKey: () => process.env.CONGRESS_API_KEY
});

export async function GET({ params }) {
	try {
		const rawId = params.id?.trim();
		if (!rawId) {
			return json({ error: 'Missing bill id' }, { status: 400 });
		}

		const billData = await getBillById(rawId);
		if (!billData) {
			return json({ error: 'Bill not found' }, { status: 404 });
		}

		const billKey = billData._id;
		const textVersions = await loadTextVersions(billData);

		return json({
			billId: billKey,
			textVersions: textVersions || []
		});
	} catch (error) {
		console.error(`Error fetching text versions for ${params.id}:`, error.message);
		const status = [422, 502, 503].includes(error.status) ? error.status : 502;
		return json(
			{ error: 'Bill text versions could not be loaded. Please try again.' },
			{
				status,
				headers: status === 503 ? { 'Retry-After': '5' } : {}
			}
		);
	}
}
