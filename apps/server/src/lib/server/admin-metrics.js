import mongo from '$lib/db/mongo.js';
import Person from '$lib/db/models/Person.js';
import Bill from '$lib/db/models/Bill.js';
import { FinanceProfile } from '$lib/db/models/FinanceProfile.js';

function missingString(field) {
	return [{ [field]: { $exists: false } }, { [field]: null }, { [field]: '' }];
}

function missingArray(field) {
	return [{ [field]: { $exists: false } }, { [field]: { $size: 0 } }];
}

async function count(model, query) {
	return model.countDocuments(query);
}

export async function getAdminDataCompleteness() {
	await mongo();

	const [representativeTotal, billTotal, financeProfileTotal] = await Promise.all([
		Person.countDocuments(),
		Bill.countDocuments(),
		FinanceProfile.countDocuments()
	]);

	const [
		repMissingImage,
		repMissingParty,
		repMissingState,
		repMissingBranch,
		repMissingFec,
		repMissingSponsoredBills,
		repMissingFinancialData,
		repMissingStockData
	] = await Promise.all([
		count(Person, { $or: missingString('imageUrl') }),
		count(Person, { $or: missingString('party') }),
		count(Person, { $or: missingString('state') }),
		count(Person, { $or: missingString('branch') }),
		count(Person, { $or: missingString('fec_candidate_id') }),
		count(Person, { $or: missingArray('sponsoredBills') }),
		count(Person, { $or: [{ financialData: { $exists: false } }, { financialData: null }] }),
		count(Person, { $or: [{ stockData: { $exists: false } }, { stockData: null }] })
	]);

	const [
		billMissingTitle,
		billMissingStatus,
		billMissingLatestAction,
		billMissingPolicyArea,
		billMissingSponsors,
		billMissingTextVersions,
		billMissingCommittee
	] = await Promise.all([
		count(Bill, { $or: missingString('title') }),
		count(Bill, { $or: missingString('status') }),
		count(Bill, {
			$or: [
				{ latestAction: { $exists: false } },
				{ latestAction: null },
				{ 'latestAction.text': { $exists: false } },
				{ 'latestAction.text': '' }
			]
		}),
		count(Bill, { $or: [{ policyArea: { $exists: false } }, { policyArea: null }] }),
		count(Bill, { $or: missingArray('sponsors') }),
		count(Bill, {
			$or: [
				{ textVersionsCount: { $exists: false } },
				{ textVersionsCount: null },
				{ textVersionsCount: 0 }
			]
		}),
		count(Bill, { $or: missingString('primaryCommitteeName') })
	]);

	return {
		representatives: {
			total: representativeTotal,
			checks: [
				{ label: 'Missing headshot', count: repMissingImage },
				{ label: 'Missing party', count: repMissingParty },
				{ label: 'Missing state', count: repMissingState },
				{ label: 'Missing chamber', count: repMissingBranch },
				{ label: 'Missing FEC candidate id', count: repMissingFec },
				{ label: 'Missing sponsored bills', count: repMissingSponsoredBills },
				{ label: 'Missing finance cache', count: repMissingFinancialData },
				{ label: 'Missing stock cache', count: repMissingStockData }
			]
		},
		bills: {
			total: billTotal,
			checks: [
				{ label: 'Missing title', count: billMissingTitle },
				{ label: 'Missing status', count: billMissingStatus },
				{ label: 'Missing latest action', count: billMissingLatestAction },
				{ label: 'Missing policy area', count: billMissingPolicyArea },
				{ label: 'Missing sponsors', count: billMissingSponsors },
				{ label: 'Missing text versions', count: billMissingTextVersions },
				{ label: 'Missing primary committee', count: billMissingCommittee }
			]
		},
		financeProfiles: {
			total: financeProfileTotal
		}
	};
}
