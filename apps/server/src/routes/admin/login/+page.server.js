import { fail, redirect } from '@sveltejs/kit';
import {
	isAdminPasswordConfigured,
	setAdminSession,
	validateAdminPassword
} from '$lib/server/admin-auth.js';

export function load() {
	return {
		passwordConfigured: isAdminPasswordConfigured()
	};
}

export const actions = {
	default: async ({ request, cookies }) => {
		if (!isAdminPasswordConfigured()) {
			return fail(500, {
				error: 'ADMIN_PANEL_PASSWORD is not configured.'
			});
		}

		const formData = await request.formData();
		const password = String(formData.get('password') || '');

		if (!validateAdminPassword(password)) {
			return fail(400, {
				error: 'Incorrect admin password.'
			});
		}

		setAdminSession(cookies);
		throw redirect(303, '/admin/cron');
	}
};
