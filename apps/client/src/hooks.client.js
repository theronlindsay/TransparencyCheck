import posthog from 'posthog-js/dist/module.no-external';

// Initialize PostHog when the app starts in the browser
export async function init() {
	posthog.init('phc_9jPqHMNTo8hY2tbwff0Ec3owcUQRdvLaYTWIwOdj2rs', {
		api_host: 'https://a.transparencycheck.app',
		defaults: '2026-01-30',
		capture_exceptions: true,
		// Keep replay enabled but avoid blocked external recorder script requests.
		disable_external_dependency_loading: true,
		disable_session_recording: false,
		// GDPR Compliance: Wait for active consent
		opt_out_capturing_by_default: true
	});
	console.log('PostHog initialized');
}

// Capture client-side errors with PostHog
export const handleError = async ({ error, status, message }) => {
	posthog.captureException(error);

	return {
		message,
		status
	};
};
