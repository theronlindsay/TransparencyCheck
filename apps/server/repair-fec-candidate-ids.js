import 'dotenv/config';
import mongoose from './src/lib/db/mongoose.js';
import Person from './src/lib/db/models/Person.js';
import { FinanceProfile } from './src/lib/db/models/FinanceProfile.js';

async function loadDuplicateFecIds() {
	return Person.aggregate([
		{
			$match: {
				fec_candidate_id: { $exists: true, $type: 'string', $nin: ['', null] }
			}
		},
		{
			$group: {
				_id: '$fec_candidate_id',
				count: { $sum: 1 },
				people: {
					$push: {
						politicianId: '$_id',
						fullName: '$fullName',
						state: '$state',
						branch: '$branch',
						party: '$party'
					}
				}
			}
		},
		{ $match: { count: { $gt: 1 } } },
		{ $sort: { count: -1, _id: 1 } }
	]);
}

async function loadDuplicateFinanceProfiles() {
	return FinanceProfile.aggregate([
		{
			$match: {
				fecCandidateId: { $exists: true, $type: 'string', $nin: ['', null] }
			}
		},
		{
			$group: {
				_id: '$fecCandidateId',
				count: { $sum: 1 },
				politicianIds: { $addToSet: '$politicianId' }
			}
		},
		{ $match: { count: { $gt: 1 } } },
		{ $sort: { count: -1, _id: 1 } }
	]);
}

function printSection(title, rows, mapper) {
	console.log(`\n${title}: ${rows.length}`);
	for (const row of rows.slice(0, 20)) {
		console.log(mapper(row));
	}
	if (rows.length > 20) {
		console.log(`... ${rows.length - 20} more`);
	}
}

async function run() {
	const apply = process.argv.includes('--apply');
	await mongoose.connection.asPromise();

	const duplicatePeople = await loadDuplicateFecIds();
	const duplicateProfiles = await loadDuplicateFinanceProfiles();
	const suspiciousFecIds = new Set([
		...duplicatePeople.map((row) => row._id),
		...duplicateProfiles.map((row) => row._id)
	]);
	const affectedPoliticianIds = new Set();

	for (const row of duplicatePeople) {
		for (const person of row.people) affectedPoliticianIds.add(person.politicianId);
	}
	for (const row of duplicateProfiles) {
		for (const politicianId of row.politicianIds) affectedPoliticianIds.add(politicianId);
	}

	printSection('Duplicate Person.fec_candidate_id groups', duplicatePeople, (row) => {
		const names = row.people
			.map((person) => `${person.fullName || person.politicianId} (${person.branch || 'Unknown'} ${person.state || ''})`)
			.join('; ');
		return `- ${row._id}: ${row.count} people -> ${names}`;
	});

	printSection('Duplicate FinanceProfile.fecCandidateId groups', duplicateProfiles, (row) => {
		return `- ${row._id}: ${row.count} profiles -> ${row.politicianIds.join(', ')}`;
	});

	console.log('\nSummary');
	console.log(`- suspicious FEC candidate ids: ${suspiciousFecIds.size}`);
	console.log(`- affected politician ids: ${affectedPoliticianIds.size}`);

	if (!apply) {
		console.log('\nDry run only. Re-run with --apply to clear duplicated FEC ids and delete affected finance profiles.');
		await mongoose.connection.close();
		return;
	}

	const affectedIds = [...affectedPoliticianIds];
	const suspiciousIds = [...suspiciousFecIds];

	const personResult = affectedIds.length
		? await Person.updateMany(
				{ _id: { $in: affectedIds } },
				{ $unset: { fec_candidate_id: 1 } }
			)
		: { modifiedCount: 0 };

	const financeResult = affectedIds.length
		? await FinanceProfile.deleteMany({
				$or: [
					{ politicianId: { $in: affectedIds } },
					...(suspiciousIds.length > 0 ? [{ fecCandidateId: { $in: suspiciousIds } }] : [])
				]
			})
		: { deletedCount: 0 };

	console.log('\nRepair complete');
	console.log(`- cleared Person.fec_candidate_id on ${personResult.modifiedCount || 0} records`);
	console.log(`- deleted ${financeResult.deletedCount || 0} FinanceProfile records`);

	await mongoose.connection.close();
}

run().catch(async (err) => {
	console.error('Failed to inspect or repair FEC candidate ids:', err);
	try {
		await mongoose.connection.close();
	} catch {
		/* ignore */
	}
	process.exit(1);
});
