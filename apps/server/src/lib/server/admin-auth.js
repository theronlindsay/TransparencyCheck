import crypto from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'tc_admin_session';
const DEFAULT_ADMIN_HOSTS = ['admin.transparencycheck.app', 'localhost', '127.0.0.1'];

export function getAdminPassword() {
	return process.env.ADMIN_PANEL_PASSWORD?.trim() || '';
}

export function isAdminPasswordConfigured() {
	return getAdminPassword().length > 0;
}

export function validateAdminPassword(password) {
	return Boolean(password) && password === getAdminPassword();
}

function sessionValueForPassword(password) {
	return crypto.createHash('sha256').update(`transparencycheck-admin:${password}`).digest('hex');
}

function configuredAdminHosts() {
	const envHosts = (process.env.ADMIN_PANEL_HOSTS || '')
		.split(',')
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);

	return new Set([...DEFAULT_ADMIN_HOSTS, ...envHosts]);
}

export function isAllowedAdminHost(hostname) {
	if (!hostname) return false;
	return configuredAdminHosts().has(hostname.toLowerCase());
}

export function hasValidAdminSession(cookies) {
	const password = getAdminPassword();
	if (!password) return false;

	return cookies.get(ADMIN_SESSION_COOKIE) === sessionValueForPassword(password);
}

export function setAdminSession(cookies) {
	const password = getAdminPassword();
	if (!password) {
		throw new Error('ADMIN_PANEL_PASSWORD is not configured');
	}

	cookies.set(ADMIN_SESSION_COOKIE, sessionValueForPassword(password), {
		httpOnly: true,
		path: '/',
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 12
	});
}

export function clearAdminSession(cookies) {
	cookies.delete(ADMIN_SESSION_COOKIE, {
		httpOnly: true,
		path: '/',
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax'
	});
}
