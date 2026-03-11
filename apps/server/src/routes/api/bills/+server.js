import { json } from '@sveltejs/kit';
import { getRecentBills } from '$lib/db/repository.js';

export async function GET() {
	try {
		const bills = await getRecentBills(100);
		return json(bills.map((b) => ({ ...b, id: b._id })));
	} catch (error) {
		console.error('Error fetching bills:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

