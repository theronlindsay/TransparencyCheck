import { json } from '@sveltejs/kit';
import { fetchAndStoreBills } from '$lib/bill-fetcher.js';
import { searchBills } from '$lib/db/repository.js';
import { createRefreshCache } from '$lib/server/refresh-cache.js';

const refresh = createRefreshCache();
const formatBill = (bill) => ({
	...bill,
	id: bill.id || bill._id,
	latestAction: bill.latestAction?.text || bill.latestAction || ''
});

export async function GET({ url, request }) {
	const searchQuery = (url.searchParams.get('search') || '').trim();
	const sponsor = (url.searchParams.get('sponsor') || '').trim();
	if (searchQuery.length > 200 || sponsor.length > 200) {
		return json({ error: 'Search and sponsor must be at most 200 characters' }, { status: 400 });
	}
	const dateFrom = url.searchParams.get('dateFrom') || `${new Date().getFullYear() - 2}-01-01`;
	const dateTo = url.searchParams.get('dateTo') || '';
	if (![dateFrom, dateTo].every((date) => !date || /^\d{4}-\d{2}-\d{2}$/.test(date))) {
		return json({ error: 'Dates must use YYYY-MM-DD' }, { status: 400 });
	}
	const filters = {
		searchQuery,
		sponsor,
		dateFrom,
		dateTo,
		status: url.searchParams.get('status'),
		chamber: url.searchParams.get('chamber'),
		congress: 119,
		limit: 80
	};
	const refreshKey = JSON.stringify([searchQuery.toLowerCase(), dateFrom, dateTo]);
	const refreshBills = () =>
		process.env.CONGRESS_API_KEY
			? refresh(refreshKey, () =>
					fetchAndStoreBills({
						searchQuery,
						dateFrom,
						dateTo,
						congress: 119,
						limit: 20,
						detailed: false
					})
				)
			: Promise.resolve(false);

	try {
		const localBills = (await searchBills(filters)).map(formatBill);
		if (url.searchParams.get('stream') !== 'true') {
			// Non-streaming clients get cached results immediately; refreshes never queue.
			void refreshBills().catch((error) => console.warn('[Search] Refresh failed:', error.message));
			return json({ bills: localBills, count: localBills.length, source: 'cache' });
		}

		let cancelled = request.signal.aborted;
		const readable = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();
				const abort = () => {
					cancelled = true;
				};
				request.signal.addEventListener('abort', abort, { once: true });
				const send = (payload) => {
					if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
				};
				const seen = new Set(localBills.map((bill) => bill.id));
				let freshCount = 0;
				try {
					send({ type: 'event', phase: 'local', status: 'start' });
					for (const bill of localBills) send({ type: 'bill', source: 'local', bill });
					send({ type: 'event', phase: 'local', status: 'complete', count: localBills.length });
					send({ type: 'event', phase: 'congress', status: 'start' });
					if (!cancelled && (await refreshBills()) && !cancelled) {
						for (const bill of (await searchBills(filters)).map(formatBill)) {
							if (seen.has(bill.id)) continue;
							seen.add(bill.id);
							freshCount++;
							send({ type: 'bill', source: 'congress', bill });
						}
					}
				} catch (error) {
					console.warn('[Search] Refresh failed:', error.message);
					send({
						type: 'event',
						phase: 'congress',
						status: 'error',
						message: 'Showing cached results; refresh unavailable.'
					});
				} finally {
					request.signal.removeEventListener('abort', abort);
					if (!cancelled) {
						send({ type: 'event', phase: 'congress', status: 'complete', count: freshCount });
						send({
							type: 'event',
							phase: 'all',
							status: 'complete',
							count: localBills.length + freshCount
						});
						controller.close();
					}
				}
			},
			cancel() {
				cancelled = true;
			}
		});
		return new Response(readable, {
			headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' }
		});
	} catch (error) {
		console.error('[Search] Database read failed:', error.message);
		return json({ bills: [], count: 0, error: 'Search unavailable' }, { status: 503 });
	}
}
