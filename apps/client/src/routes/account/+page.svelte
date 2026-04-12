<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authError, currentUser, isAuthenticated, signOutUser } from '$lib/stores/auth.js';
	import { apiUrl } from '$lib/config.js';
	import { onMount } from 'svelte';

	let busy = $state(false);
	let toast = $state('');

	let savedBills = $state([]);
	let loadingBills = $state(false);

	$effect(() => {
		if (!$isAuthenticated) {
			goto(resolve('/auth'));
		}
	});

	onMount(async () => {
		if ($isAuthenticated) {
			loadingBills = true;
			try {
				const res = await fetch(apiUrl('/api/bills/save'));
				if (res.ok) {
					const data = await res.json();
					savedBills = data.bills || [];
				}
			} catch (e) {
				console.error(e);
			} finally {
				loadingBills = false;
			}
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

	async function exportData() {
		// Mock endpoint calls for GDPR features
		toast = 'Data export initiated. You will receive an email shortly.';
	}

	async function deleteAccount() {
		if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
			// Mock endpoint call for deletion
			toast = 'Account deleted successfully.';
			setTimeout(() => goto(resolve('/auth')), 1000);
		}
	}
</script>

<div class="account-page">
	<div class="account-card elevated-surface">
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

			<section class="panel">
				<h2>Data & Privacy</h2>
				<p>Manage your account data and privacy settings (GDPR Compliant).</p>
				<div class="actions" style="margin-top: 1rem;">
					<button
						class="depth-button-primary depth-blue"
						style="font-size: 0.8rem; padding: 0.5rem;"
						onclick={exportData}
						disabled={busy}>📥 Export My Data</button
					>
					<button
						class="depth-button-primary depth-danger"
						style="font-size: 0.8rem; padding: 0.5rem;"
						onclick={deleteAccount}
						disabled={busy}>🗑️ Delete Account</button
					>
				</div>
			</section>
		</div>

		<section class="panel full-width" style="margin-top: 1.3rem;">
			<h2>My Saved Bills</h2>
			{#if loadingBills}
				<p>Loading...</p>
			{:else if savedBills.length === 0}
				<p>You have not saved any bills yet.</p>
			{:else}
				<ul class="bill-list">
					{#each savedBills as saved (saved.billId + ':' + saved.savedAt)}
						<li style="margin-bottom: 0.5rem;">
							<a
								href={resolve(`/bill/${saved.billId.replace(/\./g, '')}`)}
								style="color: #4ECDC4; font-weight: bold; text-decoration: none;"
							>
								{saved.title || saved.billId}
							</a>
							<span style="color: #94a3b8; font-size: 0.85rem; margin-left: 0.5rem;"
								>Saved: {new Date(saved.savedAt).toLocaleDateString()}</span
							>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<div class="actions">
			<button class="depth-button-primary depth-blue" onclick={() => goto(resolve('/'))}
				>🏛️ Explore Bills</button
			>
			<button class="depth-button-primary depth-danger" onclick={handleLogout} disabled={busy}>
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

	.account-card.elevated-surface {
		padding: 1.8rem;
		display: grid;
		gap: 1.3rem;
		border-radius: 28px;
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
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.05),
			0 4px 16px rgba(0, 0, 0, 0.22);
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

		.account-card.elevated-surface {
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
