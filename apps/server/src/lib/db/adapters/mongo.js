/**
 * MongoDB adapter — all bill operations via Prisma.
 * Functions must match the interface in adapters/sqlite.js exactly.
 */

import { prisma } from '$lib/db/prisma.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const safeParse = (str, fallback = null) => {
	if (!str) return fallback;
	try {
		return JSON.parse(str);
	} catch {
		return fallback;
	}
};

/** Build the data payload shared between upsert create/update */
function buildBillData(billId, billStatus, bill) {
	return {
		billNumber: bill.number ?? bill.billNumber,
		congress: bill.congress,
		type: bill.type ?? null,
		introducedDate: bill.introducedDate ?? null,
		latestAction: JSON.stringify(bill.latestAction) ?? null,
		status: billStatus,
		originChamber: bill.originChamber ?? null,
		originChamberCode: bill.originChamberCode ?? null,
		title: bill.title ?? null,
		updateDate: bill.updateDate ?? null,
		updateDateIncludingText: bill.updateDateIncludingText ?? null,
		legislationUrl: bill.legislationUrl ?? null,
		policyArea: bill.policyArea ? JSON.stringify(bill.policyArea) : null,
		actionsCount: bill.actions?.count ?? bill.actionsCount ?? null,
		actionsUrl: bill.actions?.url ?? bill.actionsUrl ?? null,
		committeesCount: bill.committees?.count ?? bill.committeesCount ?? null,
		committeesUrl: bill.committees?.url ?? bill.committeesUrl ?? null,
		cosponsorsCount: bill.cosponsors?.count ?? bill.cosponsorsCount ?? null,
		cosponsorsUrl: bill.cosponsors?.url ?? bill.cosponsorsUrl ?? null,
		relatedBillsCount: bill.relatedBills?.count ?? bill.relatedBillsCount ?? null,
		relatedBillsUrl: bill.relatedBills?.url ?? bill.relatedBillsUrl ?? null,
		sponsors: JSON.stringify(bill.sponsors) ?? null,
		subjectsCount: bill.subjects?.count ?? bill.subjectsCount ?? null,
		subjectsUrl: bill.subjects?.url ?? bill.subjectsUrl ?? null,
		summariesCount: bill.summaries?.count ?? bill.summariesCount ?? null,
		summaraiesUrl: bill.summaries?.url ?? bill.summaraiesUrl ?? null, // typo preserved per schema
		textVersionsCount: bill.textVersions?.count ?? bill.textVersionsCount ?? null,
		textVersionsUrl: bill.textVersions?.url ?? bill.textVersionsUrl ?? null,
		titlesCount: bill.titles?.count ?? bill.titlesCount ?? null,
		titlesUrl: bill.titles?.url ?? bill.titlesUrl ?? null
	};
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function saveBill(billId, billStatus, bill) {
	const data = buildBillData(billId, billStatus, bill);
	const existing = await prisma.bill.findUnique({ where: { id: billId } });

	if (existing) {
		await prisma.bill.update({ where: { id: billId }, data });
	} else {
		await prisma.bill.create({ data: { id: billId, ...data } });
	}
}

export async function saveBillActions(billId, actions) {
	await prisma.billAction.deleteMany({ where: { billId } });

	if (actions.length > 0) {
		await prisma.billAction.createMany({
			data: actions.map((a) => ({
				billId,
				actionDate: a.actionDate ?? null,
				text: a.text ?? null,
				type: a.type ?? null,
				actionCode: a.actionCode ?? null,
				sourceSystem: JSON.stringify(a.sourceSystem ?? null)
			}))
		});
	}
}

export async function saveTextVersion(billId, version, format, content, isFetched) {
	// Avoid Prisma MongoDB compound unique index issues with nullable fields by
	// using an explicit findFirst + update/create instead of upsert.
	const versionType = version.type ?? '';
	const formatType = format.type ?? '';

	const existing = await prisma.billTextVersion.findFirst({
		where: { billId, type: versionType, formatType }
	});

	if (existing) {
		await prisma.billTextVersion.update({
			where: { id: existing.id },
			data: {
				date: version.date ?? null,
				url: format.url ?? null,
				content,
				contentFetched: isFetched
			}
		});
	} else {
		await prisma.billTextVersion.create({
			data: {
				billId,
				type: versionType,
				date: version.date ?? null,
				formatType,
				url: format.url ?? null,
				content,
				contentFetched: isFetched
			}
		});
	}
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function getBillById(billId) {
	const bill = await prisma.bill.findUnique({ where: { id: billId } });
	if (!bill) return null;

	return {
		...bill,
		latestAction: safeParse(bill.latestAction),
		policyArea: safeParse(bill.policyArea),
		sponsors: safeParse(bill.sponsors, []),
		committees: [] // committees not yet stored directly on Mongo Bill model
	};
}

export async function getBillTextVersions(billId) {
	const versions = await prisma.billTextVersion.findMany({
		where: { billId },
		orderBy: { date: 'desc' }
	});
	return versions ?? [];
}

export async function getBillActions(billId) {
	const actions = await prisma.billAction.findMany({
		where: { billId },
		orderBy: { actionDate: 'desc' }
	});
	return actions ?? [];
}

export async function getRecentBills(limit = 20) {
	const bills = await prisma.bill.findMany({
		orderBy: { updateDateIncludingText: 'desc' },
		take: limit
	});

	return bills.map((bill) => ({
		...bill,
		latestAction: safeParse(bill.latestAction),
		policyArea: safeParse(bill.policyArea),
		sponsors: safeParse(bill.sponsors, []),
		committees: []
	}));
}
