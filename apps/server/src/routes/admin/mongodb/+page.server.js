import { fail, redirect } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';

const PAGE_SIZE = 25;

function normalizePage(value) {
	const page = Number.parseInt(value || '1', 10);
	return Number.isFinite(page) && page > 0 ? page : 1;
}

function serializeDocument(doc) {
	return JSON.parse(JSON.stringify(doc));
}

function moveSponsoredBillsToEnd(document) {
	if (!document || typeof document !== 'object' || Array.isArray(document)) {
		return document;
	}

	if (!Object.prototype.hasOwnProperty.call(document, 'sponsoredBills')) {
		return document;
	}

	const { sponsoredBills, ...rest } = document;
	return {
		...rest,
		sponsoredBills
	};
}

function normalizeQueryInput(value) {
	return String(value || '').trim();
}

function parseQueryValue(rawValue) {
	const trimmed = rawValue.trim();

	if (!trimmed) {
		throw new Error('Query values cannot be empty.');
	}

	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}

	if (trimmed === 'true') return true;
	if (trimmed === 'false') return false;
	if (trimmed === 'null') return null;

	if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
		return Number(trimmed);
	}

	try {
		return JSON.parse(trimmed);
	} catch {
		return trimmed;
	}
}

function parseSimpleQuery(rawQuery) {
	const input = normalizeQueryInput(rawQuery);
	if (!input) {
		return {};
	}

	const body = input.startsWith('{') && input.endsWith('}') ? input.slice(1, -1).trim() : input;

	if (!body) {
		return {};
	}

	const separatorIndex = body.indexOf(':');
	if (separatorIndex === -1) {
		throw new Error('Query must use the format {key:value}.');
	}

	const rawKey = body.slice(0, separatorIndex).trim();
	const rawValue = body.slice(separatorIndex + 1);
	const key = rawKey.replace(/^['"]|['"]$/g, '').trim();

	if (!key) {
		throw new Error('Query key is required.');
	}

	return { [key]: parseQueryValue(rawValue) };
}

async function loadCollectionSummaries(db) {
	const rawCollections = await db.listCollections({}, { nameOnly: true }).toArray();

	const collections = await Promise.all(
		rawCollections
			.map((entry) => entry.name)
			.filter((name) => !name.startsWith('system.'))
			.sort((a, b) => a.localeCompare(b))
			.map(async (name) => ({
				name,
				count: await db.collection(name).countDocuments()
			}))
	);

	return collections;
}

export async function load({ url }) {
	const db = await mongo();
	const collections = await loadCollectionSummaries(db);
	const selectedName = url.searchParams.get('collection') || collections[0]?.name || null;
	const page = normalizePage(url.searchParams.get('page'));
	const rawQuery = normalizeQueryInput(url.searchParams.get('query'));
	let query = {};
	let queryError = null;

	let selectedCollection = null;

	if (selectedName && collections.some((entry) => entry.name === selectedName)) {
		try {
			query = parseSimpleQuery(rawQuery);
		} catch (error) {
			queryError = error instanceof Error ? error.message : 'Invalid query.';
		}

		const skip = (page - 1) * PAGE_SIZE;
		const total = queryError ? 0 : await db.collection(selectedName).countDocuments(query);
		const documents = queryError
			? []
			: await db
					.collection(selectedName)
					.find(query)
					.sort({ _id: 1 })
					.skip(skip)
					.limit(PAGE_SIZE)
					.toArray();

		selectedCollection = {
			name: selectedName,
			total,
			page,
			pageSize: PAGE_SIZE,
			totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
			query: rawQuery,
			queryError,
			documents: documents.map((document) => {
				const serialized = serializeDocument(document);
				return selectedName === 'people' ? moveSponsoredBillsToEnd(serialized) : serialized;
			})
		};
	}

	return {
		collections,
		selectedCollection
	};
}

export const actions = {
	clearCollection: async ({ request }) => {
		const formData = await request.formData();
		const collectionName = String(formData.get('collection') || '');

		if (!collectionName) {
			return fail(400, { error: 'Collection name is required.' });
		}

		const db = await mongo();
		const collections = await loadCollectionSummaries(db);
		if (!collections.some((entry) => entry.name === collectionName)) {
			return fail(404, { error: `Unknown collection: ${collectionName}` });
		}

		await db.collection(collectionName).deleteMany({});
		throw redirect(303, `/admin/mongodb?collection=${encodeURIComponent(collectionName)}`);
	}
};
