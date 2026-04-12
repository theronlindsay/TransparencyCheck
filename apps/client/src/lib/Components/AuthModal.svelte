<script>
	import { fade, scale } from 'svelte/transition';
	import { resolve } from '$app/paths';

	let { show = $bindable(false), feature = 'use this feature' } = $props();

	function closeModal() {
		show = false;
	}

	function goToLogin() {
		show = false;
		if (typeof window !== 'undefined') {
			window.location.href = resolve(
				'/auth?mode=login&redirect=' + encodeURIComponent(window.location.pathname)
			);
		}
	}

	function goToSignup() {
		show = false;
		if (typeof window !== 'undefined') {
			window.location.href = resolve(
				'/auth?mode=signup&redirect=' + encodeURIComponent(window.location.pathname)
			);
		}
	}
</script>

{#if show}
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 200 }}
		onclick={closeModal}
		role="presentation"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="modal-content elevated-surface"
			transition:scale={{ duration: 200, start: 0.95 }}
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
		>
			<button class="close-button" onclick={closeModal} aria-label="Close"> &times; </button>
			<div class="modal-header">
				<h2>Account Required</h2>
			</div>
			<div class="modal-body">
				<p>You need to be signed in to {feature}. Create a free account or log in to continue!</p>
			</div>
			<div class="modal-actions">
				<button type="button" class="btn secondary btn-raised-neutral" onclick={goToLogin}
					>Log In</button
				>
				<button type="button" class="depth-button-primary modal-primary" onclick={goToSignup}
					>Sign Up</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(10, 8, 8, 0.8);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 1rem;
	}

	.modal-content {
		width: 100%;
		max-width: 450px;
	}

	.modal-content.elevated-surface {
		padding: 0;
	}

	.close-button {
		position: absolute;
		top: 1.25rem;
		right: 1.25rem;
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 1.5rem;
		cursor: pointer;
		line-height: 1;
		padding: 0;
		transition: color var(--transition-base);
	}

	.close-button:hover {
		color: var(--text-primary);
	}

	.modal-header {
		padding: 1.5rem 1.5rem 0.5rem;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--text-primary);
	}

	.modal-body {
		padding: 0 1.5rem 1.5rem;
	}

	.modal-body p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 1.05rem;
		line-height: 1.5;
	}

	.modal-actions {
		padding: 1.5rem;
		background: rgba(0, 0, 0, 0.2);
		border-top: 1px solid var(--border-color);
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
	}

	.modal-actions :global(.btn-raised-neutral) {
		padding: 0.75rem 1.35rem;
		border-radius: var(--radius-sm);
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.modal-primary {
		padding: 0.75rem 1.35rem;
		font-size: 0.95rem;
	}
</style>
