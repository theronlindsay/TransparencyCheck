<script>
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import posthog from 'posthog-js';

	let showBanner = $state(false);

	onMount(() => {
		// Delay slightly so layout can render.
		setTimeout(() => {
			const hasConsented = localStorage.getItem('cookie_consent');
			if (hasConsented === null) {
				showBanner = true;
			} else if (hasConsented === 'true') {
				posthog.opt_in_capturing();
				posthog.startSessionRecording();
			}
		}, 500);
	});

	function acceptCookies() {
		localStorage.setItem('cookie_consent', 'true');
		posthog.opt_in_capturing();
		posthog.startSessionRecording();
		showBanner = false;
	}

	function declineCookies() {
		localStorage.setItem('cookie_consent', 'false');
		posthog.stopSessionRecording();
		posthog.opt_out_capturing();
		showBanner = false;
	}
</script>

{#if showBanner}
	<div class="cookie-banner" role="dialog" aria-live="polite">
		<div class="cookie-content">
			<p>
				We use cookies and telemetry (PostHog) to improve your experience and measure app usage
				anonymously. Read our <a href={resolve('/privacy-policy')}>Privacy Policy</a>.
			</p>
		</div>
		<div class="cookie-actions">
			<button class="btn decline" onclick={declineCookies}>Decline</button>
			<button class="btn accept" onclick={acceptCookies}>Accept</button>
		</div>
	</div>
{/if}

<style>
	.cookie-banner {
		position: fixed;
		bottom: calc(env(safe-area-inset-bottom) + 80px); /* Above the bottom nav */
		left: 50%;
		transform: translateX(-50%);
		width: 90%;
		max-width: 600px;
		background: var(--surface-3d-gradient);
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: var(--radius-md);
		padding: 1rem;
		box-shadow: var(--shadow-3d-stack);
		display: flex;
		flex-direction: column;
		gap: 1rem;
		z-index: 1000;
		backdrop-filter: blur(10px);
	}

	@media (min-width: 640px) {
		.cookie-banner {
			flex-direction: row;
			align-items: center;
			bottom: 20px;
		}
	}

	.cookie-content p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.cookie-content a {
		color: var(--accent);
		text-decoration: underline;
	}

	.cookie-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		flex-shrink: 0;
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
		transition: all var(--transition-base);
	}

	.btn.decline {
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-secondary);
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 3px 10px rgba(0, 0, 0, 0.22);
	}

	.btn.decline:hover {
		background: rgba(255, 255, 255, 0.08);
		transform: translateY(-1px);
	}

	.btn.accept {
		background: var(--depth-primary-face);
		color: white;
		border: none;
		box-shadow: var(--depth-primary-rest);
	}

	.btn.accept:hover {
		transform: translateY(-2px);
		box-shadow: var(--depth-primary-hover);
	}

	.btn.accept:active {
		transform: translateY(2px);
		box-shadow: var(--depth-primary-active);
	}
</style>
