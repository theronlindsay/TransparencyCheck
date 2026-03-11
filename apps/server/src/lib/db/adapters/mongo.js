import Bill from '$lib/db/models/Bill.js';
import BillAction from '$lib/db/models/BillAction.js';
import BillTextVersion from '$lib/db/models/BillTextVersion.js';

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function saveBill(billId, billStatus, bill) {
	const data = {
		billNumber: bill.number ?? bill.billNumber,
		congress: bill.congress,
		type: bill.type ?? null,
		introducedDate: bill.introducedDate ?? null,
		latestAction: bill.latestAction ?? null,
		status: billStatus,
		originChamber: bill.originChamber ?? null,
		originChamberCode: bill.originChamberCode ?? null,
		title: bill.title ?? null,
		updateDate: bill.updateDate ?? null,
		updateDateIncludingText: bill.updateDateIncludingText ?? null,
		legislationUrl: bill.legislationUrl ?? null,
		policyArea: bill.policyArea ?? null,
		actionsCount: bill.actions?.count ?? bill.actionsCount ?? null,
		actionsUrl: bill.actions?.url ?? bill.actionsUrl ?? null,
		committeesCount: bill.committees?.count ?? bill.committeesCount ?? null,
		committeesUrl: bill.committees?.url ?? bill.committeesUrl ?? null,
		cosponsorsCount: bill.cosponsors?.count ?? bill.cosponsorsCount ?? null,
		cosponsorsUrl: bill.cosponsors?.url ?? bill.cosponsorsUrl ?? null,
		relatedBillsCount: bill.relatedBills?.count ?? bill.relatedBillsCount ?? null,
		relatedBillsUrl: bill.relatedBills?.url ?? bill.relatedBillsUrl ?? null,
		sponsors: bill.sponsors ?? null,
		primaryCommitteeName: bill.primaryCommitteeName ?? null,
		subjectsCount: bill.subjects?.count ?? bill.subjectsCount ?? null,
		subjectsUrl: bill.subjects?.url ?? bill.subjectsUrl ?? null,
		summariesCount: bill.summaries?.count ?? bill.summariesCount ?? null,
		summaraiesUrl: bill.summaries?.url ?? bill.summaraiesUrl ?? null,
		textVersionsCount: bill.textVersions?.count ?? bill.textVersionsCount ?? null,
		textVersionsUrl: bill.textVersions?.url ?? bill.textVersionsUrl ?? null,
		titlesCount: bill.titles?.count ?? bill.titlesCount ?? null,
		titlesUrl: bill.titles?.url ?? bill.titlesUrl ?? null
	};

	try {
		const result = await Bill.findByIdAndUpdate(
			billId,
			{ $set: data, $setOnInsert: { _id: billId } },
			{ upsert: true, new: true }
		);
		console.log(`💾 Saved bill ${billId} to MongoDB (_id: ${result._id})`);
	} catch (err) {
		console.error(`❌ MongoDB saveBill failed for ${billId}:`, err.message);
		throw err;
	}
}

export async function saveBillActions(billId, actions) {
	await BillAction.deleteMany({ billId });

	if (actions.length > 0) {
		await BillAction.insertMany(
			actions.map((a) => ({
				billId,
				actionDate: a.actionDate ?? null,
				text: a.text ?? null,
				type: a.type ?? null,
				actionCode: a.actionCode ?? null,
				sourceSystem: a.sourceSystem ?? null
			}))
		);
	}
}

export async function saveTextVersion(billId, version, format, content, isFetched) {
	const versionType = version.type ?? '';
	const formatType = format.type ?? '';

	await BillTextVersion.findOneAndUpdate(
		{ billId, type: versionType, formatType },
		{
			date: version.date ?? null,
			url: format.url ?? null,
			content,
			contentFetched: isFetched
		},
		{ upsert: true, new: true }
	);
}

// ─── Reads ───────────────────────────────────────────────────────────────────

const CURRENT_CONGRESS = 119;

export async function getBillById(billId) {
	return await Bill.findById(billId).lean();
}

export async function getBillTextVersions(billId) {
	return await BillTextVersion.find({ billId }).sort({ date: -1 }).lean();
}

export async function getBillActions(billId) {
	return await BillAction.find({ billId }).sort({ actionDate: -1 }).lean();
}

export async function getRecentBills(limit = 20) {
	return await Bill.find({ congress: CURRENT_CONGRESS }).sort({ updateDateIncludingText: -1 }).limit(limit).lean();
}

export async function searchBills({ searchQuery, status, chamber, sponsor, dateFrom, dateTo, congress, limit = 40 } = {}) {
	const filter = { congress: congress ?? CURRENT_CONGRESS };

	if (searchQuery) {
		const regex = new RegExp(searchQuery, 'i');
		filter.$or = [{ title: regex }, { billNumber: regex }, { 'policyArea.name': regex }];
	}

	if (status && status !== 'all') filter.status = status;
	if (chamber && chamber !== 'all') filter.originChamber = chamber;
	if (sponsor) filter['sponsors.fullName'] = new RegExp(sponsor, 'i');

	if (dateFrom || dateTo) {
		filter.updateDate = {};
		if (dateFrom) filter.updateDate.$gte = dateFrom;
		if (dateTo) filter.updateDate.$lte = dateTo;
	}

	return await Bill.find(filter).sort({ updateDateIncludingText: -1 }).limit(limit).lean();
}

