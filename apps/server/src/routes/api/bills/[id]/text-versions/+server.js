import { json } from '@sveltejs/kit';
import { getBillById, getBillTextVersions, fetchAndStoreTextVersions } from '$lib/db/bills.js';

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
		let textVersions = await getBillTextVersions(billKey);

		if (
			textVersions.length === 0 &&
			billData.textVersionsCount > 0 &&
			billData.textVersionsUrl &&
			process.env.CONGRESS_API_KEY
		) {
			textVersions = await fetchAndStoreTextVersions(
				billKey,
				billData.textVersionsUrl,
				process.env.CONGRESS_API_KEY
			);
		}

		return json({
			billId: billKey,
			textVersions: textVersions || []
		});
	} catch (error) {
		console.error(`Error fetching bill text versions for ${params.id}:`, error);
		if (error.stack) console.error(error.stack);
		return json({ error: error.message, stack: error.stack }, { status: 500 });
	}
}
