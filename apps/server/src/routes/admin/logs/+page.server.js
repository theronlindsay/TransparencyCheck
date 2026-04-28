import { fail } from '@sveltejs/kit';
import { readServerLogs } from '$lib/server/logging.js';

function normalizeLimit(value, fallback = 400) {
	const parsed = Number.parseInt(String(value || ''), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return Math.min(parsed, 5000);
}

function loadLogs(limit) {
	return readServerLogs({ limit });
}

export function load({ url }) {
	const limit = normalizeLimit(url.searchParams.get('limit'));
	const logs = loadLogs(limit);

	return {
		limit,
		filePath: logs.filePath,
		lines: logs.lines,
		lineCount: logs.lines.length
	};
}

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const limit = normalizeLimit(formData.get('limit'));

		try {
			const logs = loadLogs(limit);
			return {
				limit,
				filePath: logs.filePath,
				lines: logs.lines,
				lineCount: logs.lines.length,
				message: `Loaded ${logs.lines.length} recent log lines.`
			};
		} catch (error) {
			console.error('[Admin Logs] Failed to read logs:', error);
			return fail(500, {
				error: error?.message || 'Failed to read server logs.'
			});
		}
	}
};
