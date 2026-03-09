/**
 * SQLite adapter — all bill operations via Prisma (SQLite client).
 * Functions match the interface in adapters/mongo.js exactly.
 */

import { sqlitePrisma as prisma } from '$lib/db/prisma-sqlite.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const safeParse = (str, fallback = null) => {
	if (!str) return fallback;
	try {
		return JSON.parse(str);
	} catch {
		return fallback;
	}
};

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function saveBill(billId, billStatus, bill) {
	const data = {
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
		url: bill.url ?? null,
		legislationUrl: bill.legislationUrl ?? null,
		policyArea: bill.policyArea ? JSON.stringify(bill.policyArea) : null,
		primaryCommitteeCode: null,
		actionsCount: bill.actions?.count ?? bill.actionsCount ?? null,
		actionsUrl: bill.actions?.url ?? bill.actionsUrl ?? null,
		committeesCount: bill.committees?.count ?? bill.committeesCount ?? null,
		committeesUrl: bill.committees?.url ?? bill.committeesUrl ?? null,
		cosponsorsCount: bill.cosponsors?.count ?? bill.cosponsorsCount ?? null,
		cosponsorsUrl: bill.cosponsors?.url ?? bill.cosponsorsUrl ?? null,
		relatedBillsCount: bill.relatedBills?.count ?? bill.relatedBillsCount ?? null,
		relatedBillsUrl: bill.relatedBills?.url ?? bill.relatedBillsUrl ?? null,
		sponsors: bill.sponsors ? JSON.stringify(bill.sponsors) : null,
		subjectsCount: bill.subjects?.count ?? bill.subjectsCount ?? null,
		subjectsUrl: bill.subjects?.url ?? bill.subjectsUrl ?? null,
		summariesCount: bill.summaries?.count ?? bill.summariesCount ?? null,
		summariesUrl: bill.summaries?.url ?? bill.summariesUrl ?? null,
		textVersionsCount: bill.textVersions?.count ?? bill.textVersionsCount ?? null,
		textVersionsUrl: bill.textVersions?.url ?? bill.textVersionsUrl ?? null,
		titlesCount: bill.titles?.count ?? bill.titlesCount ?? null,
		titlesUrl: bill.titles?.url ?? bill.titlesUrl ?? null
	};

	const existingBill = await prisma.bill.findFirst({
		where: { billNumber: data.billNumber, congress: data.congress }
	});

	if (existingBill) {
		await prisma.bill.update({ where: { id: existingBill.id }, data: { id: billId, ...data } });
	} else {
		await prisma.bill.create({ data: { id: billId, ...data } });
	}

	// Also upsert sponsors into people + bill_people junction
	if (bill.sponsors && Array.isArray(bill.sponsors)) {
		for (const sponsor of bill.sponsors) {
			if (!sponsor.bioguideId) continue;
			try {
				const sponsorData = {
					firstName: sponsor.firstName ?? null,
					lastName: sponsor.lastName ?? null,
					fullName: sponsor.fullName ?? null,
					branch: 'legislative',
					party: sponsor.party ?? null,
					state: sponsor.state ?? null,
					district: sponsor.district != null ? String(sponsor.district) : null,
					url: sponsor.url ?? null
				};
				const existingPerson = await prisma.person.findUnique({
					where: { bioguideId: sponsor.bioguideId }
				});
				if (existingPerson) {
					await prisma.person.update({ where: { bioguideId: sponsor.bioguideId }, data: sponsorData });
				} else {
					await prisma.person.create({ data: { bioguideId: sponsor.bioguideId, ...sponsorData } });
				}

				const existingBillPerson = await prisma.billPerson.findFirst({
					where: { billId, personId: sponsor.bioguideId, relationship: 'sponsor' }
				});
				if (existingBillPerson) {
					await prisma.billPerson.update({
						where: { id: existingBillPerson.id },
						data: { isByRequest: sponsor.isByRequest ?? null }
					});
				} else {
					await prisma.billPerson.create({
						data: {
							billId,
							personId: sponsor.bioguideId,
							relationship: 'sponsor',
							isByRequest: sponsor.isByRequest ?? null
						}
					});
				}
			} catch (err) {
				console.error(`SQLite Prisma: error saving sponsor ${sponsor.bioguideId}:`, err.message);
			}
		}
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
	const versionType = version.type ?? '';
	const formatType = format.type ?? '';

	const existingVersion = await prisma.billTextVersion.findFirst({
		where: { billId, type: versionType, formatType }
	});

	if (existingVersion) {
		await prisma.billTextVersion.update({
			where: { id: existingVersion.id },
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

	// Fetch sponsors via junction table
	const billPeople = await prisma.billPerson.findMany({
		where: { billId, relationship: 'sponsor' }
	});
	const sponsors = [];
	for (const bp of billPeople) {
		const person = await prisma.person.findUnique({ where: { bioguideId: bp.personId } });
		if (person) sponsors.push(person);
	}

	// Fetch committees via junction table
	const billCommittees = await prisma.billCommittee.findMany({ where: { billId } });
	const committees = [];
	for (const bc of billCommittees) {
		const committee = await prisma.committee.findUnique({
			where: { committeeCode: bc.committeeCode }
		});
		if (committee) committees.push(committee);
	}

	return {
		...bill,
		latestAction: safeParse(bill.latestAction),
		policyArea: safeParse(bill.policyArea),
		sponsors,
		committees
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
