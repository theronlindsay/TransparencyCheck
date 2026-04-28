import { json } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import { BugReport } from '$lib/db/models/BugReport.js';

function normalizeString(value, maxLength = 0) {
	const normalized = String(value || '').trim();
	if (!normalized) {
		return '';
	}

	return maxLength > 0 ? normalized.slice(0, maxLength) : normalized;
}

function normalizeAttachment(value) {
	if (!value || typeof value !== 'object') {
		return null;
	}

	const fileKey = normalizeString(value.fileKey, 256);
	const url = normalizeString(value.url, 1200);
	if (!fileKey || !url) {
		return null;
	}

	return {
		fileKey,
		url,
		name: normalizeString(value.name, 255),
		size: Number(value.size) || 0,
		type: normalizeString(value.type, 120)
	};
}

export async function POST({ request }) {
	try {
		await mongo();

		const body = await request.json();
		const title = normalizeString(body?.title, 160);
		const description = normalizeString(body?.description, 6000);

		if (!title || !description) {
			return json({ error: 'Title and description are required.' }, { status: 400 });
		}

		const report = await BugReport.create({
			title,
			description,
			email: normalizeString(body?.email, 255),
			pageUrl: normalizeString(body?.pageUrl, 1200),
			userAgent: normalizeString(request.headers.get('user-agent'), 1200),
			status: 'new',
			attachment: normalizeAttachment(body?.attachment)
		});

		return json({
			ok: true,
			reportId: String(report._id),
			createdAt: report.createdAt?.toISOString?.() || new Date().toISOString()
		});
	} catch (error) {
		console.error('[Bug Reports] Failed to store bug report', error);
		return json({ error: 'Failed to submit bug report.' }, { status: 500 });
	}
}
