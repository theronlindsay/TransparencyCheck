import { json } from '@sveltejs/kit';
import { getRecentBills } from '$lib/db/repository.js';
import { ensureBillsSeeded } from '$lib/server/bill-sync.js';

export async function GET() {
	try {
		let bills = await getRecentBills(100);

		// First deploy / empty DB: pull congress 119 from Congress.gov before responding.
		if (bills.length === 0) {
			await ensureBillsSeeded();
			bills = await getRecentBills(100);
		}

		return json(bills.map((b) => ({ ...b, id: b._id })));
	} catch (error) {
		console.error('Error fetching bills:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
