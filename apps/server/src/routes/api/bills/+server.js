import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db/prisma.js';
import { fetchAndStoreBills } from '$lib/bill-fetcher.js';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

// Flag to ensure background job only runs once
let backgroundJobStarted = false;

/**
 * Kick off background job to fetch recent bills (last 3 days)
 */
async function startBackgroundJob() {
	if (backgroundJobStarted) return;
	backgroundJobStarted = true;

	console.log('🔄 Starting background job to fetch recent bills...');
	try {
		const dateTo = new Date();
		const dateFrom = new Date();
		dateFrom.setDate(dateTo.getDate() - 3);

		const fromString = dateFrom.toISOString().split('T')[0];
		const toString = dateTo.toISOString().split('T')[0];

		await fetchAndStoreBills({ dateFrom: fromString, dateTo: toString });
		console.log('✅ Background job: Finished fetching recent bills.');
	} catch (error) {
		console.error('❌ Background job: Error fetching recent bills:', error);
	}
}

export async function OPTIONS() {
	return new Response(null, { headers: corsHeaders });
}

export async function GET() {
	try {
		// Start background job on first request (non-blocking)
		if (!backgroundJobStarted) {
			startBackgroundJob().catch((err) => {
				console.error('Background job failed:', err);
			});
		}

		// Fetch bills from MongoDB via Prisma
		const bills = await prisma.bill.findMany({
			orderBy: { updateDate: 'desc' },
			take: 100
		});

		// Parse JSON string fields for each bill
		const parsedBills = bills.map((bill) => {
			const safeParse = (str, fallback = null) => {
				if (!str) return fallback;
				try {
					return JSON.parse(str);
				} catch (e) {
					return fallback;
				}
			};

			return {
				...bill,
				latestAction: safeParse(bill.latestAction),
				policyArea: safeParse(bill.policyArea),
				sponsors: safeParse(bill.sponsors, []),
				committees: []
			};
		});

		return json(parsedBills, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching bills:', error);
		return json({ error: error.message }, { status: 500, headers: corsHeaders });
	}
}

