import { json } from '@sveltejs/kit';
import { fetchAndStoreBills, fetchAndStoreBillsGenerator } from '$lib/bill-fetcher.js';
import { searchBills } from '$lib/db/repository.js';

// Default: only consider bills updated within the last 2 years to avoid ancient results.
const DEFAULT_DATE_FROM = `${new Date().getFullYear() - 2}-01-01`;

// Helper function to determine bill status from API data
// This is kept here for formatting the response, as the fetcher module only stores raw data.
function determineBillStatus(bill) {
	const latestActionText = bill.latestAction?.text?.toLowerCase() || '';

	if (
		latestActionText.includes('became public law') ||
		latestActionText.includes('became private law') ||
		latestActionText.includes('signed by president')
	) {
		return 'Enacted';
	}

	if (latestActionText.includes('vetoed') || latestActionText.includes('veto message')) {
		return 'Vetoed';
	}

	if (
		latestActionText.includes('failed') ||
		latestActionText.includes('rejected') ||
		latestActionText.includes('motion to proceed rejected')
	) {
		return 'Failed';
	}

	if (
		latestActionText.includes('passed senate') ||
		latestActionText.includes('received in the senate')
	) {
		return 'Passed House';
	}

	if (
		latestActionText.includes('passed house') ||
		latestActionText.includes('received in the house')
	) {
		return 'Passed Senate';
	}

	if (latestActionText.includes('referred to') || latestActionText.includes('committee on')) {
		return 'In Committee';
	}

	if (latestActionText.includes('introduced in') || bill.introducedDate) {
		return 'Introduced';
	}

	return 'Active';
}

function formatCongressBill(bill) {
	const billStatus = determineBillStatus(bill);
	return {
		id: `${bill.type}${bill.number}`,
		billNumber: `${bill.type}.${bill.number}`,
		congress: bill.congress,
		type: bill.type,
		introducedDate: bill.introducedDate,
		latestAction: bill.latestAction?.text || '',
		status: billStatus,
		originChamber: bill.originChamber,
		originChamberCode: bill.originChamberCode,
		title: bill.title,
		updateDate: bill.updateDate,
		url: bill.url,
		policyArea: bill.policyArea?.name || '',
		sponsors: bill.sponsors || [],
		primaryCommitteeName: bill.primaryCommitteeName || null
	};
}

function formatLocalBill(bill) {
	return {
		...bill,
		id: bill.id || bill._id,
		latestAction: bill.latestAction?.text || bill.latestAction || ''
	};
}

function includeBillByFilters(bill, { status, chamber, sponsor, dateFrom, dateTo }) {
	if (chamber && chamber !== 'all' && bill.originChamber !== chamber) {
		return false;
	}

	if (sponsor) {
		const sponsorLower = sponsor.toLowerCase();
		const sponsorStr = Array.isArray(bill.sponsors)
			? bill.sponsors
					.map((s) => (s ? `${s.firstName || ''} ${s.lastName || ''} ${s.fullName || ''}` : ''))
					.join(' ')
					.toLowerCase()
			: '';
		if (!sponsorStr.includes(sponsorLower)) {
			return false;
		}
	}

	if (status && status !== 'all' && bill.status !== status) {
		return false;
	}

	if (dateFrom && bill.updateDate && bill.updateDate < dateFrom) {
		return false;
	}

	if (dateTo && bill.updateDate && bill.updateDate > dateTo) {
		return false;
	}

	return true;
}

function dedupeKey(bill) {
	return `${(bill.billNumber || '').toLowerCase()}|${bill.congress || ''}`;
}

export async function GET({ url }) {
	const searchQuery = url.searchParams.get('search') || '';
	const status = url.searchParams.get('status');
	const chamber = url.searchParams.get('chamber');
	const sponsor = url.searchParams.get('sponsor');
	const dateFrom = url.searchParams.get('dateFrom') || DEFAULT_DATE_FROM;
	const dateTo = url.searchParams.get('dateTo');
	const stream = url.searchParams.get('stream') === 'true';

	try {
		// If streaming is requested, return a streaming response
		if (stream) {
			const readable = new ReadableStream({
				async start(controller) {
					const encoder = new TextEncoder();
					let localCount = 0;
					let congressCount = 0;
					const seen = new Set();
					const filters = { status, chamber, sponsor, dateFrom, dateTo };

					const send = (payload) => {
						controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
					};

					console.log(`Starting local+congress stream for bills`);

					// 1) Local DB results first
					send({ type: 'event', phase: 'local', status: 'start' });
					const localBills = await searchBills({
						searchQuery,
						status,
						chamber,
						sponsor,
						dateFrom,
						dateTo,
						congress: 119,
						limit: 80
					});

					for (const localBill of localBills) {
						const formattedLocal = formatLocalBill(localBill);
						if (!includeBillByFilters(formattedLocal, filters)) continue;
						const key = dedupeKey(formattedLocal);
						if (seen.has(key)) continue;
						seen.add(key);
						localCount++;
						send({ type: 'bill', source: 'local', bill: formattedLocal });
					}
					send({ type: 'event', phase: 'local', status: 'complete', count: localCount });

					// 2) Congress.gov results second
					send({ type: 'event', phase: 'congress', status: 'start' });

					for await (const bill of fetchAndStoreBillsGenerator({
						searchQuery,
						dateFrom,
						dateTo,
						congress: 119
					})) {
						try {
							const formattedBill = formatCongressBill(bill);
							if (!includeBillByFilters(formattedBill, filters)) {
								continue;
							}

							const key = dedupeKey(formattedBill);
							if (seen.has(key)) {
								continue;
							}
							seen.add(key);

							congressCount++;
							send({ type: 'bill', source: 'congress', bill: formattedBill });
							console.log(
								`Streamed bill ${localCount + congressCount}: ${formattedBill.billNumber}`
							);
						} catch (error) {
							console.error(`Error processing bill ${bill.type}${bill.number}:`, error);
						}
					}

					send({ type: 'event', phase: 'congress', status: 'complete', count: congressCount });
					send({
						type: 'event',
						phase: 'all',
						status: 'complete',
						count: localCount + congressCount
					});

					console.log(
						`Stream completed. Local: ${localCount}, Congress: ${congressCount}, Total: ${localCount + congressCount}`
					);
					controller.close();
				}
			});

			return new Response(readable, {
				headers: {
					'Content-Type': 'application/x-ndjson',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive'
				}
			});
		}

		// Non-streaming response
		const bills = await fetchAndStoreBills({ searchQuery, dateFrom, dateTo, congress: 119 });
		const formattedBills = bills.map((bill) => formatCongressBill(bill));

		// Apply filters
		let filteredBills = formattedBills;

		if (chamber && chamber !== 'all') {
			filteredBills = filteredBills.filter((bill) => bill.originChamber === chamber);
		}

		if (sponsor) {
			const sponsorLower = sponsor.toLowerCase();
			filteredBills = filteredBills.filter((bill) => {
				const sponsorsArray = Array.isArray(bill.sponsors) ? bill.sponsors : [];
				const sponsorStr = sponsorsArray
					.map((s) => (s ? `${s.firstName || ''} ${s.lastName || ''} ${s.fullName || ''}` : ''))
					.join(' ')
					.toLowerCase();
				return sponsorStr.includes(sponsorLower);
			});
		}

		if (status && status !== 'all') {
			filteredBills = filteredBills.filter((bill) => bill.status === status);
		}

		if (dateFrom) {
			filteredBills = filteredBills.filter(
				(bill) => bill.updateDate && bill.updateDate >= dateFrom
			);
		}

		if (dateTo) {
			filteredBills = filteredBills.filter((bill) => bill.updateDate && bill.updateDate <= dateTo);
		}

		return json({
			bills: filteredBills,
			count: filteredBills.length,
			source: 'congress.gov'
		});
	} catch (error) {
		console.error('Search bills error:', error);
		return json(
			{
				bills: [],
				count: 0,
				error: error.message
			},
			{ status: 500 }
		);
	}
}
