import { getBillById } from '$lib/server/bills.js';
import { getBillFullText } from '$lib/server/bill-text.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	try {
		const bill = await getBillById(params.id);

		if (!bill) {
			throw error(404, {
				message: 'Bill not found'
			});
		}

		// Fetch the full text from congress.gov
		let fullText = null;
		try {
			fullText = await getBillFullText(bill);
		} catch (err) {
			console.warn('Failed to fetch bill full text:', err);
			// Continue without full text - don't fail the whole page
		}

		return {
			bill,
			fullText
		};
	} catch (err) {
		console.error('Error loading bill:', err);
		throw error(500, {
			message: 'Failed to load bill details'
		});
	}
}
