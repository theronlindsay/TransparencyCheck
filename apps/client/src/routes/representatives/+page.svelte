<script>
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { apiUrl } from '$lib/config.js';

	let loading = $state(true);
	let members = $state([]);
	let error = $state(null);
	/** True when the API served the Person collection (Congress.gov sync skipped or failed). */
	let servedFromCache = $state(false);
	let activeChamber = $state('Senate'); // Default

	let filteredMembers = $derived.by(() => {
		return members.filter((m) => m.chamber.includes(activeChamber));
	});

	onMount(async () => {
		try {
			const res = await fetch(apiUrl('/api/representatives'));
			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				error = data?.error || 'Failed to load representatives.';
				servedFromCache = false;
				return;
			}

			if (!Array.isArray(data.members)) {
				error = 'Unexpected response from server.';
				servedFromCache = false;
				return;
			}

			servedFromCache = data.servedFromCache === true;
			// Sort by State alphabetically, then Name
			members = data.members.sort((a, b) => {
				if (a.state < b.state) return -1;
				if (a.state > b.state) return 1;
				return a.name.localeCompare(b.name);
			});
		} catch (err) {
			console.error(err);
			error = 'Network error fetching representatives.';
			servedFromCache = false;
		} finally {
			loading = false;
		}
	});

	function getPartyAbbr(partyName) {
		if (!partyName) return 'I';
		if (partyName.toLowerCase().includes('democrat')) return 'D';
		if (partyName.toLowerCase().includes('republican')) return 'R';
		return 'I'; // Independents
	}
</script>

<svelte:head>
	<title>TransparencyCheck - Representatives</title>
</svelte:head>

<div class="page-container">
	<div class="content-wrapper">
		<header class="page-header">
			<h1>Congress Directory</h1>
			<p>Access financial, sponsorship, and demographic data across the United States Congress.</p>

			<div class="tab-switcher" role="tablist" aria-label="Chamber">
				<div class="tab-track">
					<span
						class="tab-indicator"
						class:house={activeChamber === 'House of Representatives'}
						aria-hidden="true"
					></span>
					<button
						type="button"
						role="tab"
						class="tab {activeChamber === 'Senate' ? 'active' : ''}"
						aria-selected={activeChamber === 'Senate'}
						onclick={() => (activeChamber = 'Senate')}
					>
						Senate
					</button>
					<button
						type="button"
						role="tab"
						class="tab {activeChamber === 'House of Representatives' ? 'active' : ''}"
						aria-selected={activeChamber === 'House of Representatives'}
						onclick={() => (activeChamber = 'House of Representatives')}
					>
						House
					</button>
				</div>
			</div>
		</header>

		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading Active Congress Members...</p>
			</div>
		{:else if error}
			<div class="error-state">{error}</div>
		{:else}
			<div class="grid">
				{#each filteredMembers as rep (rep.bioguideId)}
					<a href={resolve(`/member/${rep.bioguideId}`)} class="rep-card">
						<div class="image-wrapper">
							<img
								src={rep.imageUrl || '/placeholder-profile.svg'}
								alt={rep.name}
								onerror={(e) => {
									e.target.src = '/placeholder-profile.svg';
									e.target.onerror = null;
								}}
							/>
						</div>
						<div class="rep-info">
							<h3>{rep.name}</h3>
							<div class="badges">
								<span class="badge state">{rep.state}</span>
								<span
									class="badge {getPartyAbbr(rep.partyName) === 'D'
										? 'party-d'
										: getPartyAbbr(rep.partyName) === 'R'
											? 'party-r'
											: 'party-i'}"
								>
									{getPartyAbbr(rep.partyName)}
								</span>
							</div>
						</div>
					</a>
				{/each}
				{#if filteredMembers.length === 0}
					<div class="empty-state">No active representatives found for this chamber.</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.page-container {
		min-height: 100vh;
		padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0;
	}

	.content-wrapper {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem 8rem 1.5rem; /* Allow space for bottom tab bar */
	}

	.page-header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 1.75rem;
		margin: 0 0 0.35rem 0;
		color: var(--text-primary);
	}

	.page-header p {
		color: var(--text-secondary);
		font-size: 0.9rem;
		max-width: 520px;
		margin: 0 auto 1.25rem auto;
		line-height: 1.4;
	}

	.tab-switcher {
		display: inline-flex;
		margin: 0 auto;
	}

	.tab-track {
		position: relative;
		display: flex;
		gap: 0.4rem;
		padding: 0.4rem;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 6px 20px rgba(0, 0, 0, 0.3);
		overflow: visible;
	}

	.tab-indicator {
		position: absolute;
		left: 0.4rem;
		top: 0.4rem;
		width: calc(50% - 0.4rem - 0.2rem);
		height: calc(100% - 0.8rem);
		border-radius: 999px;
		z-index: 0;
		pointer-events: none;
		background: linear-gradient(145deg, #f13a37, #b91c1c);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.22),
			0 5px 0 #7f1d1d,
			0 10px 24px rgba(241, 58, 55, 0.4);
		transform: translateX(0) translateY(-4px);
		transition:
			transform 0.38s cubic-bezier(0.34, 1.2, 0.64, 1),
			box-shadow 0.3s ease;
	}

	.tab-indicator.house {
		transform: translateX(calc(100% + 0.4rem)) translateY(-4px);
	}

	.tab-switcher .tab {
		position: relative;
		z-index: 1;
		flex: 1 1 0;
		min-width: 0;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		padding: 0.45rem 1.1rem;
		font-size: 0.85rem;
		font-weight: 600;
		border-radius: 999px;
		cursor: pointer;
		transition: color 0.25s ease;
		box-shadow: none;
	}

	.tab-switcher .tab:hover {
		color: var(--text-primary);
	}

	.tab-switcher .tab.active {
		color: #fff;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
		gap: 0.65rem;
	}

	.rep-card {
		background: var(--surface-3d-gradient);
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: var(--radius-md, 10px);
		overflow: hidden;
		text-decoration: none;
		transition: all var(--transition-base);
		display: flex;
		flex-direction: column;
		height: 100%;
		backdrop-filter: var(--blur);
		box-shadow: var(--shadow-3d-stack);
		transform: translateZ(0);
	}

	.rep-card:hover {
		transform: translateY(-2px) translateZ(0);
		border-color: rgba(241, 58, 55, 0.35);
		box-shadow:
			var(--shadow-3d-inset-top),
			0 18px 36px rgba(0, 0, 0, 0.42),
			0 0 0 1px rgba(241, 58, 55, 0.2);
	}

	.image-wrapper {
		width: 100%;
		aspect-ratio: 1;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-bottom: 1px solid var(--border-color);
	}

	.image-wrapper img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.3s ease;
	}

	.rep-card:hover .image-wrapper img {
		transform: scale(1.05);
	}

	.rep-info {
		padding: 0.5rem 0.45rem 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		flex-grow: 1;
		justify-content: center;
		min-height: 0;
	}

	.rep-info h3 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.25;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		word-break: break-word;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: center;
	}

	.badge {
		font-size: 0.6rem;
		font-weight: 700;
		padding: 0.12rem 0.28rem;
		border-radius: 3px;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.badge.state {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	.party-d {
		background: rgba(54, 149, 255, 0.15);
		color: #60a5fa;
		border: 1px solid rgba(54, 149, 255, 0.3);
	}

	.party-r {
		background: rgba(255, 90, 83, 0.15);
		color: #ff8b86;
		border: 1px solid rgba(255, 90, 83, 0.3);
	}

	.party-i {
		background: rgba(148, 163, 184, 0.15);
		color: #cbd5e1;
		border: 1px solid rgba(148, 163, 184, 0.3);
	}

	.loading-state,
	.empty-state,
	.error-state {
		text-align: center;
		padding: 4rem 1rem;
		color: var(--text-secondary);
		font-size: 1.1rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-radius: 50%;
		border-top-color: var(--accent);
		animation: spin 1s ease-in-out infinite;
		margin: 0 auto 1.5rem auto;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 640px) {
		.content-wrapper {
			padding: 1.25rem 0.65rem 8rem;
		}

		.grid {
			grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
			gap: 0.5rem;
		}

		.rep-info h3 {
			font-size: 0.68rem;
		}

		.page-header h1 {
			font-size: 1.45rem;
		}
	}
</style>
