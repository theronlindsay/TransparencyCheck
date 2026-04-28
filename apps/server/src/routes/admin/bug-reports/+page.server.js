import { fail } from '@sveltejs/kit';
import mongo from '$lib/db/mongo.js';
import { BugReport } from '$lib/db/models/BugReport.js';
import { utapi } from '$lib/server/uploadthing.js';

function githubIssueUrl(report) {
	const attachmentLines = report.attachment?.url
		? [
				'## Attachment',
				`- File: ${report.attachment.name || 'attachment'}`,
				`- URL: ${report.attachment.url}`,
				`- Type: ${report.attachment.type || 'unknown'}`,
				`- Size: ${report.attachment.size || 0} bytes`
			]
		: ['## Attachment', '- None'];

	const body = [
		'## Bug Report',
		`- Report ID: ${report.id}`,
		`- Submitted: ${report.createdAt}`,
		`- Email: ${report.email || 'Not provided'}`,
		`- Page: ${report.pageUrl || 'Not provided'}`,
		'',
		'## Description',
		report.description || 'No description provided.',
		'',
		...attachmentLines
	].join('\n');

	const params = new URLSearchParams({
		title: `[Bug Report] ${report.title}`,
		body
	});

	return `https://github.com/theronlindsay/TransparencyCheck/issues/new?${params.toString()}`;
}

async function loadBugReports() {
	await mongo();

	const reports = await BugReport.find({}).sort({ createdAt: -1, _id: -1 }).lean();

	return reports.map((report) => ({
		id: String(report._id),
		title: report.title || 'Untitled bug report',
		description: report.description || '',
		email: report.email || '',
		pageUrl: report.pageUrl || '',
		userAgent: report.userAgent || '',
		status: report.status || 'new',
		createdAt: report.createdAt ? new Date(report.createdAt).toISOString() : '',
		attachment: report.attachment
			? {
					fileKey: report.attachment.fileKey || '',
					url: report.attachment.url || '',
					name: report.attachment.name || '',
					size: Number(report.attachment.size) || 0,
					type: report.attachment.type || ''
				}
			: null,
		githubIssueUrl: githubIssueUrl({
			id: String(report._id),
			title: report.title || 'Untitled bug report',
			description: report.description || '',
			email: report.email || '',
			pageUrl: report.pageUrl || '',
			createdAt: report.createdAt ? new Date(report.createdAt).toISOString() : '',
			attachment: report.attachment || null
		})
	}));
}

export async function load() {
	const reports = await loadBugReports();

	return {
		reports,
		summary: {
			total: reports.length,
			withAttachment: reports.filter((report) => report.attachment?.url).length
		}
	};
}

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const intent = String(formData.get('intent') || '').trim();
		const reportId = String(formData.get('reportId') || '').trim();

		if (intent !== 'delete-report' || !reportId) {
			return fail(400, { error: 'Unknown bug report action.' });
		}

		try {
			await mongo();
			const report = await BugReport.findById(reportId).lean();
			if (!report) {
				return fail(404, { error: `Bug report ${reportId} not found.` });
			}

			if (report.attachment?.fileKey) {
				try {
					await utapi.deleteFiles(report.attachment.fileKey);
				} catch (error) {
					console.warn('[Admin Bug Reports] Failed to delete UploadThing file', error);
				}
			}

			await BugReport.deleteOne({ _id: reportId });

			return {
				intent,
				reportId,
				message: `Deleted bug report "${report.title || reportId}".`
			};
		} catch (error) {
			console.error('[Admin Bug Reports] Action failed:', error);
			return fail(500, {
				intent,
				reportId,
				error: error?.message || 'Bug report action failed.'
			});
		}
	}
};
