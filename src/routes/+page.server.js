export const ssr = false;
import { CONGRESS_API_KEY } from '$env/static/private';
import { initDatabase, execute, query, saveBillActions } from '$lib/db.js';

// Helper function to determine bill status from API data
function determineBillStatus(bill) {
	const latestActionText = bill.latestAction?.text?.toLowerCase() || '';
	
	// Check for enacted/became law
	if (latestActionText.includes('became public law') || 
	    latestActionText.includes('became private law') ||
	    latestActionText.includes('signed by president')) {
		return 'Enacted';
	}
	
	// Check for vetoed
	if (latestActionText.includes('vetoed') || 
	    latestActionText.includes('veto message')) {
		return 'Vetoed';
	}
	
	// Check for failed
	if (latestActionText.includes('failed') || 
	    latestActionText.includes('rejected') ||
	    latestActionText.includes('motion to proceed rejected')) {
		return 'Failed';
	}
	
	// Check for passed chambers
	if (latestActionText.includes('passed senate') || 
	    latestActionText.includes('received in the senate')) {
		return 'Passed House';
	}
	
	if (latestActionText.includes('passed house') || 
	    latestActionText.includes('received in the house')) {
		return 'Passed Senate';
	}
	
	// Check for committee referral
	if (latestActionText.includes('referred to') || 
	    latestActionText.includes('committee on')) {
		return 'In Committee';
	}
	
	// Check for introduced
	if (latestActionText.includes('introduced in') || 
	    bill.introducedDate) {
		return 'Introduced';
	}
	
	// Default
	return 'Active';
}

async function getRecentBills(amount){
	let url = `https://api.congress.gov/v3/bill?api_key=${CONGRESS_API_KEY}&limit=${amount}`;

	const response = await fetch(url);
	const data = await response.json();
	return data;
}

// Fetch detailed bill information from the individual bill URL
async function getBillDetails(billUrl) {
	const url = `${billUrl}?format=json&api_key=${CONGRESS_API_KEY}`;
	const response = await fetch(url);
	const data = await response.json();
	return data.bill;
}

// Fetch committees for a bill from the committees URL
async function getBillCommittees(committeesUrl) {
	const url = `${committeesUrl}&api_key=${CONGRESS_API_KEY}`;
	const response = await fetch(url);
	const data = await response.json();
	return data.committees || [];
}

// Fetch actions for a bill from the actions URL
async function getBillActionsFromAPI(actionsUrl) {
	const url = `${actionsUrl}&api_key=${CONGRESS_API_KEY}`;
	const response = await fetch(url);
	const data = await response.json();
	return data.actions || [];
}

export async function load() {
	// Initialize database if it doesn't exist
	await initDatabase();

	// Return a promise that will resolve later, allowing the page to render immediately
	const billsPromise = syncAndFetchBills();

	return {
		// This will stream to the client as it resolves
		bills: billsPromise
	};
}

// Separate function to handle sync and fetch
async function syncAndFetchBills() {
	// First, fetch bills from database (instant)
	const cachedBills = await fetchBillsFromDatabase();
	
	// Then check for updates in background (don't await)
	checkAndSyncInBackground().catch(error => {
		console.error('Background sync error:', error);
	});
	
	// Return cached bills immediately
	return cachedBills;
}

// Fetch bills from database
async function fetchBillsFromDatabase() {
	const billsWithData = await query(`
		SELECT 
			b.*,
			pc.name as primaryCommitteeName,
			GROUP_CONCAT(
				json_object(
					'bioguideId', p.bioguideId,
					'firstName', p.firstName,
					'lastName', p.lastName,
					'fullName', p.fullName,
					'party', p.party,
					'state', p.state,
					'district', p.district
				), '|||'
			) as sponsorsData,
			GROUP_CONCAT(
				json_object(
					'committeeCode', c.committeeCode,
					'name', c.name,
					'chamber', c.chamber,
					'type', c.type
				), '|||'
			) as committeesData
		FROM bills b
		LEFT JOIN committees pc ON b.primaryCommitteeCode = pc.committeeCode
		LEFT JOIN bill_people bp ON b.id = bp.billId AND bp.relationship = 'sponsor'
		LEFT JOIN people p ON bp.personId = p.bioguideId
		LEFT JOIN bill_committees bc ON b.id = bc.billId
		LEFT JOIN committees c ON bc.committeeCode = c.committeeCode
		GROUP BY b.id
		ORDER BY b.updateDate DESC
		LIMIT 100
	`);

	// Parse the sponsors and committees JSON for each bill
	return billsWithData.map(bill => ({
		...bill,
		latestAction: bill.latestAction ? JSON.parse(bill.latestAction) : null,
		policyArea: bill.policyArea ? JSON.parse(bill.policyArea) : null,
		sponsors: bill.sponsorsData ? 
			bill.sponsorsData.split('|||').map(s => JSON.parse(s)).filter(s => s.bioguideId) : 
			[],
		committees: bill.committeesData ? 
			bill.committeesData.split('|||').map(c => JSON.parse(c)).filter(c => c.committeeCode) : 
			[]
	}));
}

// Background sync function - checks for updates and only syncs changed bills
async function checkAndSyncInBackground() {
	const billsData = await getRecentBills(20);
	const bills = billsData.bills || [];
	
	console.log(`Fetched ${bills.length} bills from API`);

	// Track statistics
	let newBills = 0;
	let updatedBills = 0;
	let unchangedBills = 0;

	// Insert each bill into the database
	for (const bill of bills) {
		// Skip bills with missing required data
		if (!bill.number || !bill.type || !bill.congress) {
			console.warn(`Skipping bill with missing data:`, bill);
			continue;
		}

		const billId = `${bill.type}${bill.number}`;

		// Check if bill exists and if it needs updating
		const existingBill = await query(
			`SELECT updateDate FROM bills WHERE id = ?`,
			[billId]
		);

		// If bill exists and hasn't been updated, skip it
		if (existingBill.length > 0 && existingBill[0].updateDate === bill.updateDate) {
			unchangedBills++;
			continue;
		}

		// Determine if this is a new bill or an update
		const isNewBill = existingBill.length === 0;
		if (isNewBill) {
			newBills++;
		} else {
			updatedBills++;
		}

		// Fetch detailed bill information
		let detailedBill = bill;
		if (bill.url) {
			try {
				detailedBill = await getBillDetails(bill.url);
				console.log(`Fetched details for ${bill.type}${bill.number} (${isNewBill ? 'new' : 'updated'})`);
			} catch (error) {
				console.error(`Error fetching details for ${bill.number}:`, error);
			}
		}
		
		try {
			// Determine bill status
			const billStatus = determineBillStatus(detailedBill);
			
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
					null, // primaryCommitteeCode - will be updated after fetching committees
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
							// Insert or update person (sponsor)
							await execute(
								`INSERT OR REPLACE INTO people 
								(bioguideId, firstName, lastName, fullName, branch, party, state, district, donors, url) 
								VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
								[
									sponsor.bioguideId,
									sponsor.firstName || null,
									sponsor.lastName || null,
									sponsor.fullName || null,
									'legislative', // branch of government
									sponsor.party || null,
									sponsor.state || null,
									sponsor.district || null,
									null, // donors - will be populated later
									sponsor.url || null
								]
							);

							// Link person to bill
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
							console.error(`Error inserting person ${sponsor.bioguideId}:`, error);
						}
					}
				}
			}

			// Process committees
			if (detailedBill.committees?.url) {
				try {
					const committees = await getBillCommittees(detailedBill.committees.url);
					console.log(`Fetched ${committees.length} committees for ${billId}`);

					let primaryCommitteeCode = null;

					for (let i = 0; i < committees.length; i++) {
						const committee = committees[i];
						if (committee.systemCode) {
							try {
								// Insert or update committee
								await execute(
									`INSERT OR REPLACE INTO committees 
									(committeeCode, name, chamber, type, subcommitteeCode, parentCommitteeCode, url) 
									VALUES (?, ?, ?, ?, ?, ?, ?)`,
									[
										committee.systemCode,
										committee.name || null,
										committee.chamber || null,
										committee.type || null,
										committee.subcommittee?.systemCode || null,
										committee.subcommittee?.systemCode ? committee.systemCode : null,
										committee.url || null
									]
								);

								// Link committee to bill
								await execute(
									`INSERT OR REPLACE INTO bill_committees 
									(billId, committeeCode) 
									VALUES (?, ?)`,
									[
										billId,
										committee.systemCode
									]
								);

								// Set first committee as primary
								if (i === 0) {
									primaryCommitteeCode = committee.systemCode;
								}
							} catch (error) {
								console.error(`Error inserting committee ${committee.systemCode}:`, error);
							}
						}
					}

					// Update bill with primary committee
					if (primaryCommitteeCode) {
						await execute(
							`UPDATE bills SET primaryCommitteeCode = ? WHERE id = ?`,
							[primaryCommitteeCode, billId]
						);
					}
				} catch (error) {
					console.error(`Error fetching committees for ${billId}:`, error);
				}
			}

			// Process actions
			if (detailedBill.actions?.url) {
				try {
					const actions = await getBillActionsFromAPI(detailedBill.actions.url);
					console.log(`Fetched ${actions.length} actions for ${billId}`);
					
					// Log first action to see structure
					if (actions.length > 0) {
						console.log('Sample action structure:', JSON.stringify(actions[0], null, 2));
					}

					if (actions.length > 0) {
						await saveBillActions(billId, actions);
						console.log(`Saved ${actions.length} actions for ${billId}`);
					}
				} catch (error) {
					console.error(`Error fetching/saving actions for ${billId}:`, error);
				}
			}
		} catch (error) {
			console.error(`Error inserting bill ${detailedBill.number}:`, error);
		}
	}
	
	console.log('=== Background Sync Summary ===');
	console.log(`New bills: ${newBills}`);
	console.log(`Updated bills: ${updatedBills}`);
	console.log(`Unchanged bills: ${unchangedBills}`);
	console.log(`Total checked: ${newBills + updatedBills + unchangedBills}`);
	console.log('===============================');
}