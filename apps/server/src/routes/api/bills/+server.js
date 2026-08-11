import { json } from '@sveltejs/kit';
import { getRecentBills } from '$lib/db/repository.js';
import { ensureBillsSeeded } from '$lib/server/bill-sync.js';

export async function GET() {
	try {
		let bills = await getRecentBills(50);

		if (bills.length === 0) {
			// Kick off seed in background; don't hold the request open (avoids RAM spikes / timeouts).
			ensureBillsSeeded().catch((err) => {
				console.error('Background bill seed failed:', err);
			});
		}

		return json(bills.map((b) => ({ ...b, id: b._id })));
	} catch (error) {
		console.error('Error fetching bills:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
