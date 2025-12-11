import { CONGRESS_API_KEY } from '$env/static/private';
import { json } from '@sveltejs/kit';
import { execute, query } from '$lib/db.js';

// Helper function to determine bill status from API data
function determineBillStatus(bill) {
	const latestActionText = bill.latestAction?.text?.toLowerCase() || '';
	
	if (latestActionText.includes('became public law') || 
	    latestActionText.includes('became private law') ||
	    latestActionText.includes('signed by president')) {
		return 'Enacted';
	}
	
	if (latestActionText.includes('vetoed') || 
	    latestActionText.includes('veto message')) {
		return 'Vetoed';
	}
	
	if (latestActionText.includes('failed') || 
	    latestActionText.includes('rejected') ||
	    latestActionText.includes('motion to proceed rejected')) {
		return 'Failed';
	}
	
	if (latestActionText.includes('passed senate') || 
	    latestActionText.includes('received in the senate')) {
		return 'Passed House';
	}
	
	if (latestActionText.includes('passed house') || 
	    latestActionText.includes('received in the house')) {
		return 'Passed Senate';
	}
	
	if (latestActionText.includes('referred to') || 
	    latestActionText.includes('committee on')) {
		return 'In Committee';
	}
	
	if (latestActionText.includes('introduced in') || 
	    bill.introducedDate) {
		return 'Introduced';
	}
	
	return 'Active';
}

// Fetch detailed bill information
async function getBillDetails(billUrl) {
	const url = `${billUrl}?format=json&api_key=${CONGRESS_API_KEY}`;
	const response = await fetch(url);
	const data = await response.json();
	return data.bill;
}

// Save bill to database
async function saveBillToDatabase(bill) {
	const billId = `${bill.type}${bill.number}`;
	
	// Check if bill already exists
	const existingBill = await query(
		`SELECT id FROM bills WHERE id = ?`,
		[billId]
	);
	
	// If bill exists, skip (it's already in the database)
	if (existingBill.length > 0) {
		return billId;
	}

	// Fetch detailed information
	let detailedBill = bill;
	if (bill.url) {
		try {
			detailedBill = await getBillDetails(bill.url);
		} catch (error) {
			console.error(`Error fetching details for ${bill.number}:`, error);
		}
	}

	const billStatus = determineBillStatus(detailedBill);
	
	// Insert bill into database
	await execute(
		`INSERT OR REPLACE INTO bills 
		(id, billNumber, congress, type, introducedDate, latestAction, status, originChamber, originChamberCode, 
		title, updateDate, updateDateIncludingText, url, legislationUrl, policyArea, primaryCommitteeCode,
		actionsCount, actionsUrl, committeesCount, committeesUrl, cosponsorsCount, cosponsorsUrl, 
		relatedBillsCount, relatedBillsUrl, sponsors, subjectsCount, subjectsUrl, 
		summariesCount, summariesUrl, textVersionsCount, textVersionsUrl, titlesCount, titlesUrl) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			billId,
			detailedBill.number,
			detailedBill.congress,
			detailedBill.type || null,
			detailedBill.introducedDate || null,
			JSON.stringify(detailedBill.latestAction) || null,
			billStatus,
			detailedBill.originChamber || null,
			detailedBill.originChamberCode || null,
			detailedBill.title || null,
			detailedBill.updateDate || null,
			detailedBill.updateDateIncludingText || null,
			detailedBill.url || null,
			detailedBill.legislationUrl || null,
			detailedBill.policyArea ? JSON.stringify(detailedBill.policyArea) : null,
			null,
			detailedBill.actions?.count || null,
			detailedBill.actions?.url || null,
			detailedBill.committees?.count || null,
			detailedBill.committees?.url || null,
			detailedBill.cosponsors?.count || null,
			detailedBill.cosponsors?.url || null,
			detailedBill.relatedBills?.count || null,
			detailedBill.relatedBills?.url || null,
			detailedBill.sponsors ? JSON.stringify(detailedBill.sponsors) : null,
			detailedBill.subjects?.count || null,
			detailedBill.subjects?.url || null,
			detailedBill.summaries?.count || null,
			detailedBill.summaries?.url || null,
			detailedBill.textVersions?.count || null,
			detailedBill.textVersions?.url || null,
			detailedBill.titles?.count || null,
			detailedBill.titles?.url || null
		]
	);

	// Process sponsors
	if (detailedBill.sponsors && Array.isArray(detailedBill.sponsors)) {
		for (const sponsor of detailedBill.sponsors) {
			if (sponsor.bioguideId) {
				try {
					await execute(
						`INSERT OR REPLACE INTO people 
						(bioguideId, firstName, lastName, fullName, branch, party, state, district, donors, url) 
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						[
							sponsor.bioguideId,
							sponsor.firstName || null,
							sponsor.lastName || null,
							sponsor.fullName || null,
							'legislative',
							sponsor.party || null,
							sponsor.state || null,
							sponsor.district || null,
							null,
							sponsor.url || null
						]
					);

					await execute(
						`INSERT OR REPLACE INTO bill_people 
						(billId, personId, relationship, isByRequest) 
						VALUES (?, ?, ?, ?)`,
						[
							billId,
							sponsor.bioguideId,
							'sponsor',
							sponsor.isByRequest || null
						]
					);
				} catch (error) {
					console.error(`Error saving sponsor ${sponsor.bioguideId}:`, error);
				}
			}
		}
	}

	return billId;
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
		// Build Congress.gov API query
		const apiParams = new URLSearchParams({
			api_key: CONGRESS_API_KEY,
			format: 'json',
			limit: '100'
		});

		// Add search query if provided
		if (searchQuery) {
			apiParams.append('query', searchQuery);
		}

		// Add date range filters
		if (dateFrom) {
			apiParams.append('fromDateTime', `${dateFrom}T00:00:00Z`);
		}
		if (dateTo) {
			apiParams.append('toDateTime', `${dateTo}T23:59:59Z`);
		}

		const response = await fetch(
			`https://api.congress.gov/v3/bill?${apiParams.toString()}`
		);

		if (!response.ok) {
			throw new Error(`Congress.gov API error: ${response.status}`);
		}

		const data = await response.json();
		let bills = data.bills || [];

		// If streaming is requested, return a streaming response
		if (stream) {
			const readable = new ReadableStream({
				async start(controller) {
					const encoder = new TextEncoder();
					let count = 0;
					
					console.log(`Starting stream for ${bills.length} bills`);
					
					for (const bill of bills) {
						try {
							console.log(`Processing bill ${bill.type}${bill.number}...`);
							
							// Save to database
							await saveBillToDatabase(bill);
							
							// Format bill
							const latestActionText = bill.latestAction?.text?.toLowerCase() || '';
							let billStatus = 'Introduced';

							if (latestActionText.includes('became public law') || 
								latestActionText.includes('became private law') ||
								latestActionText.includes('signed by president')) {
								billStatus = 'Enacted';
							} else if (latestActionText.includes('vetoed')) {
								billStatus = 'Vetoed';
							} else if (latestActionText.includes('failed') || latestActionText.includes('rejected')) {
								billStatus = 'Failed';
							} else if (latestActionText.includes('passed senate') || 
									   latestActionText.includes('received in the senate')) {
								billStatus = 'Passed House';
							} else if (latestActionText.includes('passed house') || 
									   latestActionText.includes('received in the house')) {
								billStatus = 'Passed Senate';
							} else if (latestActionText.includes('referred to') || 
									   latestActionText.includes('committee on')) {
								billStatus = 'In Committee';
							}

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
								sponsors: bill.sponsors?.map(s => s.fullName).join(', ') || ''
							};

							// Apply filters
							let shouldInclude = true;
							
							if (chamber && chamber !== 'all' && formattedBill.originChamber !== chamber) {
								shouldInclude = false;
							}
							
							if (sponsor && shouldInclude) {
								const sponsorLower = sponsor.toLowerCase();
								if (!formattedBill.sponsors.toLowerCase().includes(sponsorLower)) {
									shouldInclude = false;
								}
							}
							
							if (status && status !== 'all' && formattedBill.status !== status) {
								shouldInclude = false;
							}

							if (shouldInclude) {
								count++;
								// Send the bill as a JSON line
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
					'Connection': 'keep-alive'
				}
			});
		}

		// Non-streaming response (original behavior)
		// Save bills to database and get formatted results
		const formattedBills = [];
		
		for (const bill of bills) {
			try {
				// Save to database (this will fetch details if needed)
				await saveBillToDatabase(bill);
				
				// Format for response
				const latestActionText = bill.latestAction?.text?.toLowerCase() || '';
				let billStatus = 'Introduced';

				if (latestActionText.includes('became public law') || 
					latestActionText.includes('became private law') ||
					latestActionText.includes('signed by president')) {
					billStatus = 'Enacted';
				} else if (latestActionText.includes('vetoed')) {
					billStatus = 'Vetoed';
				} else if (latestActionText.includes('failed') || latestActionText.includes('rejected')) {
					billStatus = 'Failed';
				} else if (latestActionText.includes('passed senate') || 
						   latestActionText.includes('received in the senate')) {
					billStatus = 'Passed House';
				} else if (latestActionText.includes('passed house') || 
						   latestActionText.includes('received in the house')) {
					billStatus = 'Passed Senate';
				} else if (latestActionText.includes('referred to') || 
						   latestActionText.includes('committee on')) {
					billStatus = 'In Committee';
				}

				formattedBills.push({
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
					sponsors: bill.sponsors?.map(s => s.fullName).join(', ') || ''
				});
			} catch (error) {
				console.error(`Error processing bill ${bill.type}${bill.number}:`, error);
			}
		}

		// Apply client-side filters that Congress.gov API doesn't support directly
		let filteredBills = formattedBills;
		
		if (chamber && chamber !== 'all') {
			filteredBills = filteredBills.filter(bill => bill.originChamber === chamber);
		}

		if (sponsor) {
			const sponsorLower = sponsor.toLowerCase();
			filteredBills = filteredBills.filter(bill => {
				const sponsors = bill.sponsors || '';
				return sponsors.toLowerCase().includes(sponsorLower);
			});
		}

		// Apply status filter
		if (status && status !== 'all') {
			filteredBills = filteredBills.filter(bill => bill.status === status);
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
