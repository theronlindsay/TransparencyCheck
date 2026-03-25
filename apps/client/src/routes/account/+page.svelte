<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authError, currentUser, isAuthenticated, signOutUser } from '$lib/stores/auth.js';

	let busy = $state(false);
	let toast = $state('');

	$effect(() => {
		if (!$isAuthenticated) {
			goto(resolve('/auth'));
		}
	});

	async function handleLogout() {
		busy = true;
		toast = '';
		const result = await signOutUser();
		busy = false;
		if (result.ok) {
			toast = 'Logged out successfully.';
			setTimeout(() => goto(resolve('/auth')), 320);
		}
	}
</script>

<div class="account-page">
	<div class="account-card elevated">
		<div class="title-row">
			<p class="badge">👤 Account</p>
			<h1>Manage your Transparency Check profile</h1>
			<p>
				Your account lets you personalize notifications, follow legislation, and sync activity with
				the mobile app.
			</p>
		</div>

		<div class="grid">
			<section class="panel">
				<h2>Profile Snapshot</h2>
				<p><strong>Name:</strong> {$currentUser?.name || 'Not set'}</p>
				<p><strong>Email:</strong> {$currentUser?.email || 'Not set'}</p>
				<p><strong>Role:</strong> Citizen Watcher</p>
			</section>

			<section class="panel">
				<h2>What You Can Do Next</h2>
				<ul>
					<li>📬 Enable bill subscriptions for real-time mobile alerts.</li>
					<li>🧾 Save legislation to your watchlist by policy area.</li>
					<li>🛰️ Link app notifications to Congress.gov activity changes.</li>
				</ul>
			</section>
		</div>

		<div class="actions">
			<button class="depth-button" onclick={() => goto(resolve('/'))}>🏛️ Explore Bills</button>
			<button class="depth-button danger" onclick={handleLogout} disabled={busy}>
				{busy ? 'Signing Out...' : '🚪 Logout'}
			</button>
		</div>

		{#if toast}
			<p class="notice">{toast}</p>
		{/if}
		{#if $authError}
			<p class="error">{$authError}</p>
		{/if}
	</div>
</div>

<style>
	.account-page {
		max-width: 1080px;
		margin: 0 auto;
		padding: 2rem;
	}

	.elevated {
		position: relative;
		background: linear-gradient(145deg, rgba(30, 24, 24, 0.9), rgba(18, 16, 16, 0.86));
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 28px;
		box-shadow:
			0 24px 44px rgba(0, 0, 0, 0.35),
			0 34px 68px rgba(0, 0, 0, 0.24),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.account-card {
		padding: 1.8rem;
		display: grid;
		gap: 1.3rem;
	}

	.badge {
		display: inline-block;
		padding: 0.35rem 0.65rem;
		border-radius: 999px;
		background: rgba(241, 58, 55, 0.16);
		border: 1px solid rgba(241, 58, 55, 0.36);
		font-weight: 600;
		margin: 0 0 0.6rem;
	}

	h1 {
		margin: 0 0 0.6rem;
		font-size: clamp(1.6rem, 2.8vw, 2.4rem);
	}

	.title-row p {
		margin: 0;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.panel {
		padding: 1rem;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.07);
	}

	h2 {
		margin: 0 0 0.85rem;
		font-size: 1.05rem;
	}

	ul {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.6rem;
	}

	.actions {
		display: flex;
		gap: 0.8rem;
		flex-wrap: wrap;
	}

	.depth-button {
		padding: 0.84rem 1.1rem;
		border: none;
		border-radius: 14px;
		font-weight: 700;
		background: linear-gradient(165deg, #ff5a53, #de2e2e);
		color: #fff;
		cursor: pointer;
		box-shadow:
			0 12px 20px rgba(222, 46, 46, 0.35),
			0 6px 0 #8d1f1f,
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}

	.depth-button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow:
			0 16px 24px rgba(222, 46, 46, 0.42),
			0 8px 0 #8d1f1f,
			inset 0 1px 0 rgba(255, 255, 255, 0.24);
	}

	.depth-button:active:not(:disabled) {
		transform: translateY(4px);
		box-shadow:
			0 8px 14px rgba(222, 46, 46, 0.28),
			0 2px 0 #8d1f1f,
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.depth-button:disabled {
		opacity: 0.72;
		cursor: not-allowed;
	}

	.depth-button.danger {
		background: linear-gradient(165deg, #c63a3a, #8f2323);
		box-shadow:
			0 12px 20px rgba(143, 35, 35, 0.35),
			0 6px 0 #5f1818,
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
	}

	.notice,
	.error {
		margin: 0;
		padding: 0.72rem 0.85rem;
		border-radius: 12px;
		font-size: 0.9rem;
	}

	.notice {
		background: rgba(46, 204, 113, 0.12);
		border: 1px solid rgba(46, 204, 113, 0.35);
		color: #b8ffd5;
	}

	.error {
		background: rgba(241, 58, 55, 0.14);
		border: 1px solid rgba(241, 58, 55, 0.32);
		color: #ffc8c6;
	}

	@media (max-width: 768px) {
		.account-page {
			padding: 0.8rem;
		}

		.account-card {
			padding: 1rem;
		}

		.grid {
			grid-template-columns: 1fr;
		}

		.actions {
			flex-direction: column;
		}
	}
</style>
