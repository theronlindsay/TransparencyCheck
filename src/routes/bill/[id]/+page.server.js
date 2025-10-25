import { error } from '@sveltejs/kit';
import { getBillById, getBillTextVersions, execute, query } from '$lib/db.js';
import { CONGRESS_API_KEY } from '$env/static/private';

export async function load({ params }) {
	try {
		const billData = await getBillById(params.id);

		if (!billData) {
			throw error(404, {
				message: 'Bill not found'
			});
		}

		// Fetch and cache text versions if available
		let textVersions = await getBillTextVersions(params.id);
		
		console.log(`Initial textVersions from DB: ${textVersions.length}`);
		
		// If no text versions in database and we have a textVersionsUrl, fetch them
		if (textVersions.length === 0 && billData.textVersionsUrl) {
			console.log(`Fetching text versions from API for ${params.id}`);
			try {
				textVersions = await fetchAndStoreTextVersions(params.id, billData.textVersionsUrl);
				console.log(`After fetching: ${textVersions.length} versions`);
			} catch (err) {
				console.error('Error fetching text versions:', err);
				// Continue even if text versions fail
			}
		}

		// Map the database fields to what the page expects
		const bill = {
			id: billData.id,
			number: billData.billNumber,
			title: billData.title,
			sponsor: formatSponsor(billData.sponsors),
			committee: billData.primaryCommitteeName || 'Unassigned',
			updatedAt: billData.updateDate,
			latestAction: getLatestActionText(billData.latestAction),
			summary: billData.summaries || null,
			summaryLong: null, // Not currently in database
			statusTag: billData.billType?.toUpperCase() || null,
			votes: [], // Not currently in database
			schedule: [], // Not currently in database
			news: [] // Not currently in database
		};

		return {
			bill,
			textVersions
		};
	} catch (err) {
		console.error('Error loading bill:', err);
		throw error(500, {
			message: 'Failed to load bill details'
		});
	}
}

// Fetch text versions from Congress.gov API and store in database
async function fetchAndStoreTextVersions(billId, textVersionsUrl) {
	const url = `${textVersionsUrl}?api_key=${CONGRESS_API_KEY}`;
	console.log(`Fetching text versions for ${billId} from:`, url);
	
	const response = await fetch(url);
	const data = await response.json();
	
	const textVersions = data.textVersions || [];
	console.log(`Found ${textVersions.length} text versions for ${billId}`);
	
	// Store each text version with its formats
	for (const version of textVersions) {
		console.log(`Processing version: ${version.type}, date: ${version.date}, formats: ${version.formats?.length}`);
		
		if (version.formats && Array.isArray(version.formats)) {
			for (const format of version.formats) {
				try {
					console.log(`  - Storing format: ${format.type}, url: ${format.url}`);
					
					await execute(`
						INSERT OR REPLACE INTO bill_text_versions 
						(billId, type, date, formatType, url)
						VALUES (?, ?, ?, ?, ?)
					`, [
						billId,
						version.type || null,
						version.date || null,
						format.type || null,
						format.url || null
					]);
					
					console.log(`  ✓ Stored successfully`);
				} catch (err) {
					console.error(`  ✗ Error storing text version:`, err);
				}
			}
		}
	}
	
	// Return the stored versions
	const storedVersions = await getBillTextVersions(billId);
	console.log(`Retrieved ${storedVersions.length} stored versions from database`);
	return storedVersions;
}

// Helper function to format sponsors array into a string
function formatSponsor(sponsors) {
	if (!sponsors || sponsors.length === 0) return 'Unknown';
	const sponsor = sponsors[0];
	return `${sponsor.firstName || ''} ${sponsor.lastName || ''}`.trim() || 'Unknown';
}

// Helper function to extract text from latestAction object
function getLatestActionText(latestAction) {
	if (!latestAction) return null;
	if (typeof latestAction === 'string') return latestAction;
	return latestAction.text || latestAction.actionText || null;
}
