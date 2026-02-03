import { env } from '$env/dynamic/private';
import { execute } from '$lib/db.js';
import { getMongoClient } from '$lib/db/mongo.js';

const mongoMode = true; // Toggles database provider

const CONGRESS_API_KEY = env.CONGRESS_API_KEY;

async function addBillToMongo(billId, billStatus, detailedBill){
	let mongo;
	try {
		mongo = await getMongoClient();
		const billCollection = mongo.db("AppData").collection("Bills");

		const insertedResult = await billCollection.updateOne(
			{_id: billId }, 
			{$set: 
				{
					id: billId,
					billNumber: detailedBill.number,
					congress: detailedBill.congress,
					type: detailedBill.type,
					introducedDate: detailedBill.introducedDate,
					latestAction: JSON.stringify(detailedBill.latestAction) || null,
					status: billStatus,
					originChamber: detailedBill.originChamber, 
					originChamberCode: detailedBill.originChamberCode, 
					title: detailedBill.title, 
					updateDate: detailedBill.updateDate,
					updateDateIncludingText: detailedBill.updateDateIncludingText, 
					legislationUrl:  detailedBill.legislationUrl,
					policyArea: JSON.stringify(detailedBill.policyArea) ||detailedBill.policyArea|| null, 
					actionsCount: detailedBill.actionsCount, 
					actionsUrl: detailedBill.actionsUrl, 
					committees: detailedBill.committees, 
					comitteesCount: detailedBill.comitteesCount,
					comitteesUrl: detailedBill.comitteesUrl, 
					cosponsorsCount: detailedBill.cosponsorsCount, 
					cosponsorsUrl: detailedBill.cosponsorsUrl, 
					relatedBillsCount: detailedBill.relatedBillsCount, 
					relatedBillsUrl: detailedBill.relatedBillsUrl,
					sponsors: JSON.stringify(detailedBill.sponsors) || detailedBill.sponsors,
					subjectsCount: detailedBill.subjectsCount, 
					subjectsUrl: detailedBill.subjectsUrl, 
					summariesCount: detailedBill.summariesCount, 
					summaraiesUrl: detailedBill.summaraiesUrl, 
					textVersionsCount: detailedBill.textVersionsCount,
					textVersionsUrl: detailedBill.textVersionsUrl, 
					titlesCount: detailedBill.titlesCount, 
					titlesUrl:  detailedBill.titlesUrl
				}
			},
			{ upsert: true}	
		);

		const upsertedId = insertedResult.upsertedId?._id;
		console.log("Upserted document:", upsertedId ?? billId);


	} catch (error) {
    	console.error("❌ Error:", error.message);
  	} finally {
		if (mongo) {
			await mongo.close();
		}
  	}

}

async function addBillToSQL(billId, billStatus, detailedBill){

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
}

// Helper function to determine bill status from API data
function determineBillStatus(bill) {
	/**
	 * Extracts and normalizes the latest action text from a bill object.
	 * Converts the text to lowercase for case-insensitive comparison,
	 * or defaults to an empty string if no action text is available.
	 */
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
	if (!CONGRESS_API_KEY) {
		throw new Error('CONGRESS_API_KEY is not defined');
	}
	const url = `${billUrl}?format=json&api_key=${CONGRESS_API_KEY}`;
	const response = await fetch(url);
	if (!response.ok) {
		console.error(`Failed to fetch bill details from ${url}. Status: ${response.status}`);
		return null;
	}
	const data = await response.json();
	return data.bill;
}

// Save bill to database
async function saveBillToDatabase(bill) {
	//Get ID
	const billId = `${bill.type}${bill.number}`;

	let detailedBill = bill;
	if (bill.url) {
		try {
			const details = await getBillDetails(bill.url);
			if (details) {
				detailedBill = details;
			}
		} catch (error) {
			console.error(`Error fetching details for ${bill.number}:`, error);
		}
	}

	const billStatus = determineBillStatus(detailedBill);


	//TOGGLE SQL AND MONGO HERE
	if(mongoMode){
		await addBillToMongo(billId, billStatus, detailedBill);
	} else {
		await addBillToSQL(billId, billStatus, detailedBill);
	}

	return billId;
}

export async function fetchAndStoreBills({ searchQuery, dateFrom, dateTo, limit = 40 } = {}) {
    if (!CONGRESS_API_KEY) {
		throw new Error('CONGRESS_API_KEY is not defined');
	}

	try {
		const apiParams = new URLSearchParams({
			api_key: CONGRESS_API_KEY,
			format: 'json',
			limit: limit.toString() // Use the provided limit
		});

		if (searchQuery) {
			apiParams.append('query', searchQuery);
		}

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
			throw new Error(`Congress.gov API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		const bills = data.bills || [];

		console.log(`Found ${bills.length} bills from Congress.gov API.`);

		for (const bill of bills) {
			try {
				await saveBillToDatabase(bill);
			} catch (error) {
				console.error(`Error saving bill ${bill.type}${bill.number} to database:`, error);
			}
		}
		console.log(`Finished processing ${bills.length} bills.`);
        return bills;
	} catch (error) {
		console.error('Failed to fetch and store bills:', error);
        throw error;
	}
}
