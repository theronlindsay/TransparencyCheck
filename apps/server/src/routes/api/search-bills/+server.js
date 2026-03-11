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

export async function GET({ url }) {
	const searchQuery = url.searchParams.get('search') || '';
	const status = url.searchParams.get('status');
	const chamber = url.searchParams.get('chamber');
	const sponsor = url.searchParams.get('sponsor');
	const dateFrom = url.searchParams.get('dateFrom');
	const dateTo = url.searchParams.get('dateTo');
	const stream = url.searchParams.get('stream') === 'true';

	try {

		// If streaming is requested, return a streaming response
		if (stream) {
			const readable = new ReadableStream({
				async start(controller) {
					const encoder = new TextEncoder();
					let count = 0;

					console.log(`Starting stream for bills`);

					for await (const bill of fetchAndStoreBillsGenerator({ searchQuery, dateFrom, dateTo, congress: 119 })) {
						try {
							const billStatus = determineBillStatus(bill);

							const formattedBill = {
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

							// Apply filters
							let shouldInclude = true;

							if (chamber && chamber !== 'all' && formattedBill.originChamber !== chamber) {
								shouldInclude = false;
							}

							if (sponsor && shouldInclude) {
								const sponsorLower = sponsor.toLowerCase();
								const sponsorStr = Array.isArray(formattedBill.sponsors) 
									? formattedBill.sponsors.map(s => s ? `${s.firstName || ''} ${s.lastName || ''} ${s.fullName || ''}` : '').join(' ').toLowerCase() 
									: '';
								if (!sponsorStr.includes(sponsorLower)) {
									shouldInclude = false;
								}
							}

							if (status && status !== 'all' && formattedBill.status !== status) {
								shouldInclude = false;
							}

							if (dateFrom && shouldInclude) {
								if (formattedBill.updateDate && formattedBill.updateDate < dateFrom) {
									shouldInclude = false;
								}
							}

							if (dateTo && shouldInclude) {
								if (formattedBill.updateDate && formattedBill.updateDate > dateTo) {
									shouldInclude = false;
								}
							}

							if (shouldInclude) {
								count++;
								const chunk = JSON.stringify(formattedBill) + '\n';
								controller.enqueue(encoder.encode(chunk));
								console.log(`Streamed bill ${count}: ${formattedBill.billNumber}`);
							}
						} catch (error) {
							console.error(`Error processing bill ${bill.type}${bill.number}:`, error);
						}
					}

					console.log(`Stream completed. Total bills streamed: ${count}`);
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
		const formattedBills = bills.map((bill) => {
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
		});

		// Apply filters
		let filteredBills = formattedBills;

		if (chamber && chamber !== 'all') {
			filteredBills = filteredBills.filter((bill) => bill.originChamber === chamber);
		}

		if (sponsor) {
			const sponsorLower = sponsor.toLowerCase();
			filteredBills = filteredBills.filter((bill) => {
				const sponsorsArray = Array.isArray(bill.sponsors) ? bill.sponsors : [];
				const sponsorStr = sponsorsArray.map(s => s ? `${s.firstName || ''} ${s.lastName || ''} ${s.fullName || ''}` : '').join(' ').toLowerCase();
				return sponsorStr.includes(sponsorLower);
			});
		}

		if (status && status !== 'all') {
			filteredBills = filteredBills.filter((bill) => bill.status === status);
		}

		if (dateFrom) {
			filteredBills = filteredBills.filter((bill) => bill.updateDate && bill.updateDate >= dateFrom);
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
