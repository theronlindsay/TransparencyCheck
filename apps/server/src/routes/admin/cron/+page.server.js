import { fail } from '@sveltejs/kit';
import { getAdminDataCompleteness } from '$lib/server/admin-metrics.js';
import { ADMIN_CRON_JOBS, runAdminCronJob, runAllAdminCronJobs } from '$lib/server/cron-jobs.js';
import { runWithLogCapture } from '$lib/server/logging.js';

export async function load() {
	return {
		jobs: ADMIN_CRON_JOBS,
		completeness: await getAdminDataCompleteness()
	};
}

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const intent = String(formData.get('intent') || '');

		try {
			if (intent === 'run-job') {
				const jobId = String(formData.get('jobId') || '');
				const job = ADMIN_CRON_JOBS.find((entry) => entry.id === jobId);

				if (!job) {
					return fail(400, { error: `Unknown cron job: ${jobId}` });
				}

				const { result, logs } = await runWithLogCapture(async () => await runAdminCronJob(jobId));

				return {
					intent,
					jobId,
					jobLabel: job.label,
					result,
					logs,
					ranAt: new Date().toISOString()
				};
			}

			if (intent === 'run-all') {
				const { result, logs } = await runWithLogCapture(async () => await runAllAdminCronJobs());

				return {
					intent,
					results: result,
					logs,
					ranAt: new Date().toISOString()
				};
			}

			return fail(400, { error: 'Unknown admin cron action.' });
		} catch (error) {
			console.error('[Admin Cron] Action failed:', error);
			return fail(500, {
				error: error?.message || 'Cron execution failed.'
			});
		}
	}
};
