import { error } from '@sveltejs/kit';
import { getBillById, getBillTextVersions, getBillActions, execute, query } from '$lib/db.js';
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
		console.log(`Bill data textVersionsUrl: ${billData.textVersionsUrl}`);
		console.log(`Bill data textVersionsCount: ${billData.textVersionsCount}`);
		
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
		} else if (!billData.textVersionsUrl) {
			console.log('⚠️  No textVersionsUrl in bill data - cannot fetch text versions');
		}

		// Map the database fields to what the page expects
		const bill = {
			id: billData.id,
			number: formatBillNumber(billData.billNumber, billData.type),
			congress: billData.congress,
			title: billData.title,
			sponsor: formatSponsor(billData.sponsors),
			committee: billData.primaryCommitteeName || 'Unassigned',
			updatedAt: billData.updateDate,
			latestAction: getLatestActionText(billData.latestAction),
			summary: billData.summaries || null,
			summaryLong: null, // Not currently in database
			status: billData.status || null,
			statusTag: billData.status || billData.billType?.toUpperCase() || null,
			votes: [], // Not currently in database
			schedule: [], // Not currently in database
			news: [] // Not currently in database
		};

		// Fetch bill actions
		const actions = await getBillActions(params.id);
		console.log(`Fetched ${actions.length} actions for bill ${params.id}`);

		return {
			bill,
			textVersions,
			actions
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
	// The textVersionsUrl already has format=json, so we need to append the API key with &
	const url = `${textVersionsUrl}&api_key=${CONGRESS_API_KEY}`;
	console.log('\n========================================');
	console.log(`FETCHING TEXT VERSIONS FOR: ${billId}`);
	console.log(`URL: ${url}`);
	console.log('========================================\n');
	
	const response = await fetch(url);
	const data = await response.json();
	
	console.log('📥 FULL API RESPONSE:');
	console.log(JSON.stringify(data, null, 2));
	console.log('\n');
	
	const textVersions = data.textVersions || [];
	console.log(`\n📦 Found ${textVersions.length} text versions in API response\n`);
	
	if (textVersions.length === 0) {
		console.log('⚠️  No text versions available in API response');
		console.log('Response keys:', Object.keys(data));
		console.log('Full response:', data);
		return [];
	}
	
	// Store each text version with its formats
	for (let i = 0; i < textVersions.length; i++) {
		const version = textVersions[i];
		console.log(`\n--- Processing version ${i + 1}/${textVersions.length} ---`);
		console.log(`Type: "${version.type}"`);
		console.log(`Date: ${version.date || 'null'}`);
		console.log(`Formats: ${version.formats?.length || 0}`);
		
		if (!version.formats || !Array.isArray(version.formats)) {
			console.log('⚠️  No formats array found, skipping');
			continue;
		}
		
		for (let j = 0; j < version.formats.length; j++) {
			const format = version.formats[j];
			console.log(`\n  Format ${j + 1}/${version.formats.length}:`);
			console.log(`    Type: "${format.type}"`);
			console.log(`    URL: ${format.url}`);
			
			try {
				console.log(`\n  🔄 Inserting into database...`);
				
				// Insert the metadata first
				const result = await execute(`
					INSERT OR REPLACE INTO bill_text_versions 
					(billId, type, date, formatType, url, content, contentFetched)
					VALUES (?, ?, ?, ?, ?, NULL, 0)
				`, [
					billId,
					version.type || null,
					version.date || null,
					format.type || null,
					format.url || null
				]);
				
				console.log(`  ✅ Metadata inserted - ID: ${result.lastID}, Changes: ${result.changes}`);
				
				// Download content for HTML/Text formats
				const formatType = format.type?.toUpperCase();
				if (formatType === 'FORMATTED TEXT' || formatType?.includes('HTM')) {
					console.log(`  📥 Downloading content from ${format.url}...`);
					
					try {
						const contentResponse = await fetch(format.url);
						const content = await contentResponse.text();
						
						console.log(`  📝 Content downloaded (${content.length} bytes), storing...`);
						
						await execute(`
							UPDATE bill_text_versions 
							SET content = ?, contentFetched = 1
							WHERE billId = ? AND type = ? AND formatType = ?
						`, [
							content,
							billId,
							version.type || null,
							format.type || null
						]);
						
						console.log(`  ✅ Content stored successfully`);
					} catch (contentErr) {
						console.error(`  ❌ Error downloading content:`, contentErr.message);
						// Continue even if content download fails
					}
				} else {
					console.log(`  ⏭️  Skipping content download for ${formatType} (not HTML/Text)`);
				}
			} catch (err) {
				console.error(`  ❌ Error storing text version:`, err.message);
				console.error(`     Stack:`, err.stack);
			}
		}
	}
	
	console.log('\n========================================');
	console.log('FETCHING STORED VERSIONS FROM DATABASE');
	console.log('========================================\n');
	
	// Return the stored versions
	const storedVersions = await getBillTextVersions(billId);
	console.log(`\n📊 Retrieved ${storedVersions.length} versions from database`);
	
	if (storedVersions.length > 0) {
		console.log('\nStored versions:');
		storedVersions.forEach((v, i) => {
			console.log(`  ${i + 1}. Type: "${v.type}", Format: "${v.formatType}", Content: ${v.contentFetched ? 'YES' : 'NO'}`);
		});
	}
	
	console.log('\n========================================\n');
	return storedVersions;
}

// Helper function to format sponsors array into a string
function formatSponsor(sponsors) {
	if (!sponsors || sponsors.length === 0) return 'Unknown';
	const sponsor = sponsors[0];
	return `${sponsor.firstName || ''} ${sponsor.lastName || ''}`.trim() || 'Unknown';
}

// Helper function to format bill number with type prefix
function formatBillNumber(billNumber, billType) {
	if (!billNumber) return '';
	
	// Map bill type codes to abbreviations
	const typeMap = {
		'HR': 'H.R.',
		'S': 'S.',
		'HRES': 'H.RES.',
		'SRES': 'S.RES.',
		'HJRES': 'H.J.RES.',
		'SJRES': 'S.J.RES.',
		'HCONRES': 'H.CON.RES.',
		'SCONRES': 'S.CON.RES.'
	};
	
	const prefix = typeMap[billType?.toUpperCase()] || billType || '';
	return `${prefix}${billNumber}`;
}

// Helper function to extract text from latestAction object
function getLatestActionText(latestAction) {
	if (!latestAction) return null;
	if (typeof latestAction === 'string') return latestAction;
	return latestAction.text || latestAction.actionText || null;
}
