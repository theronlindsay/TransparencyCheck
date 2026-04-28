<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { apiUrl } from '$lib/config.js';

	let politician = $state(null);
	let financeData = $state(null);
	let stockData = $state(null);
	let error = $state(null);
	let activeTab = $state('overview');
	let financeScope = $state('authorized');
	let loadingProfile = $state(true);
	let loadingFinance = $state(true);
	let loadingStocks = $state(false);

	const politicianId = $page.params.id;

	async function loadFinanceData(scope = financeScope) {
		loadingFinance = true;
		try {
			const financeRes = await fetch(
				apiUrl(
					`/api/politician/${politicianId}/finance?committeeScope=${encodeURIComponent(scope)}`
				)
			);
			if (!financeRes.ok) {
				throw new Error('Failed to load finance data');
			}

			financeData = await financeRes.json();
			financeScope = financeData?.selectedScope || scope;
		} catch (err) {
			console.error('Error fetching finance data:', err);
			error = 'Failed to load campaign finance data.';
		} finally {
			loadingFinance = false;
		}
	}

	onMount(async () => {
		loadingProfile = true;
		try {
			const basicRes = await fetch(apiUrl(`/api/politician/${politicianId}/basic`));
			if (!basicRes.ok) {
				throw new Error('Failed to load basic politician info');
			}
			politician = await basicRes.json();
			financeData = { totals: null, donors: [], includedCommittees: [] };
			stockData = politician.stockData?.trades ?? [];
			loadingProfile = false;
			loadingStocks = false;
			await loadFinanceData(financeScope);
		} catch (err) {
			console.error('Error fetching member page data:', err);
			error = 'Failed to load politician data.';
			loadingProfile = false;
			loadingFinance = false;
			loadingStocks = false;
		}
	});
</script>

<div class="profile-page">
	{#if error}
		<div class="error-banner">{error}</div>
	{:else if loadingProfile || !politician}
		<div class="loading-state full-page-loading">
			<div class="spinner"></div>
			<p>Loading profile…</p>
		</div>
	{:else}
		<div class="profile-header elevated-surface">
			<div class="header-content">
				<div class="photo-container">
					<img
						src={politician.headshotUrl}
						alt="Headshot of {politician.name}"
						class="headshot"
						onerror={(e) => {
							e.target.src = '/placeholder-profile.svg';
							e.target.onerror = null;
						}}
					/>
				</div>
				<div class="header-info">
					<h1>{politician.name}</h1>
					<p class="role">{politician.role} - {politician.state} ({politician.party})</p>

					{#if politician.twitter_account || politician.url}
						<div class="social-links">
							{#if politician.twitter_account}
								<a
									href="https://twitter.com/{politician.twitter_account}"
									target="_blank"
									rel="noopener noreferrer">@{politician.twitter_account}</a
								>
							{/if}
							{#if politician.url}
								<button
									type="button"
									class="external-site-link"
									onclick={() => window.open(politician.url, '_blank', 'noopener,noreferrer')}
								>
									Official Website
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="tabs">
			<button class:active={activeTab === 'overview'} onclick={() => (activeTab = 'overview')}
				>Overview</button
			>
			<button class:active={activeTab === 'financial'} onclick={() => (activeTab = 'financial')}
				>Financial Data</button
			>
			<button class:active={activeTab === 'stocks'} onclick={() => (activeTab = 'stocks')}
				>Stock Trades</button
			>
		</div>

		<div class="tab-content">
			{#if activeTab === 'overview'}
				<section class="panel">
					<h2>Overview</h2>
					<p>
						This representative serves {politician.state} and is a member of the {politician.party} party.
					</p>

					{#if politician.sponsoredBills && politician.sponsoredBills.length > 0}
						<h3 class="sponsored-header">Recent Sponsored Legislation</h3>
						<div class="bills-list">
							{#each politician.sponsoredBills as bill (bill.billId || bill.displayTitle || '')}
								{#if bill.billId}
									<a href={resolve(`/bill/${bill.billId}`)} class="bill-card">
										<div class="bill-header">
											<span class="bill-number">{bill.billId.toString().toUpperCase()}</span>
											<span class="bill-date"
												>{bill.introducedDate
													? new Date(bill.introducedDate).toLocaleDateString()
													: '—'}</span
											>
										</div>
										<p class="bill-title">{bill.displayTitle}</p>
									</a>
								{:else}
									<div class="bill-card missing-link">
										<div class="bill-header">
											<span class="bill-number">Cached Bill</span>
											<span class="bill-date"
												>{bill.introducedDate
													? new Date(bill.introducedDate).toLocaleDateString()
													: '—'}</span
											>
										</div>
										<p class="bill-title">{bill.displayTitle}</p>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</section>
			{:else if activeTab === 'financial'}
				<section class="financial-section">
					<h2>Campaign Finance & Donors (OpenFEC)</h2>

					{#if loadingFinance}
						<div class="tab-loading">
							<div class="spinner"></div>
							<p>Loading campaign finance data…</p>
						</div>
					{:else}
						{#if financeData?.totals}
							<div class="finance-totals">
								<div class="stat-box">
									<h3>Total Receipts</h3>
									<p class="amount">${financeData.totals.receipts?.toLocaleString() || 0}</p>
								</div>
								<div class="stat-box">
									<h3>Total Disbursements</h3>
									<p class="amount">${financeData.totals.disbursements?.toLocaleString() || 0}</p>
								</div>
							</div>
						{/if}

						<div class="finance-controls">
							<label>
								<span>Committee scope</span>
								<select
									value={financeScope}
									onchange={async (event) => {
										await loadFinanceData(event.currentTarget.value);
									}}
								>
									<option value="authorized">Principal + all authorized</option>
									<option value="principal">Principal committee only</option>
								</select>
							</label>

							{#if financeData?.lastSyncedAt}
								<p class="finance-meta">
									Last synced: {new Date(financeData.lastSyncedAt).toLocaleString()}
								</p>
							{/if}
						</div>

						{#if financeData?.includedCommittees?.length}
							<div class="committee-chips">
								{#each financeData.includedCommittees as committee (committee.committeeId)}
									<span class="committee-chip">
										{committee.name}
										<small>{committee.designation || '—'}</small>
									</span>
								{/each}
							</div>
						{/if}

						<h3>Top donors (last several two-year cycles)</h3>
						<p class="donor-note">
							Amounts combine committee-level Schedule A contribution rows by donor name across
							recent FEC reporting periods for the selected committee scope.
						</p>
						{#if financeData?.donors && financeData.donors.length > 0}
							<div class="donor-table-wrap">
								<table class="data-table">
									<thead>
										<tr>
											<th>Donor</th>
											<th>Amount</th>
											<th>Date</th>
										</tr>
									</thead>
									<tbody>
										{#each financeData.donors as donor (donor.donorName + ':' + donor.date)}
											<tr>
												<td>{donor.donorName}</td>
												<td class="amount">${Math.round(donor.amount).toLocaleString()}</td>
												<td>{new Date(donor.date).toLocaleDateString()}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<p class="empty-state">No detailed donor records found.</p>
						{/if}
					{/if}
				</section>
			{:else if activeTab === 'stocks'}
				<section class="panel">
					<h2>Stock Trades</h2>
					{#if loadingStocks}
						<div class="tab-loading">
							<div class="spinner"></div>
							<p>Loading stock disclosures…</p>
						</div>
					{:else if stockData && stockData.length > 0}
						<table class="data-table">
							<thead>
								<tr>
									<th>Ticker</th>
									<th>Company</th>
									<th>Type</th>
									<th>Value Range</th>
									<th>Date</th>
								</tr>
							</thead>
							<tbody>
								{#each stockData as trade (`${trade.ticker}-${trade.transactionDate}-${trade.transactionType || ''}`)}
									<tr>
										<td><strong>{trade.ticker}</strong></td>
										<td>{trade.companyName}</td>
										<td
											class={trade.transactionType?.toLowerCase().includes('purchase')
												? 'buy'
												: 'sell'}>{trade.transactionType}</td
										>
										<td>{trade.amountRange}</td>
										<td>{new Date(trade.transactionDate).toLocaleDateString()}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<p class="empty-state">No stock trade disclosures found.</p>
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</div>

<style>
	.profile-page {
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem;
		color: var(--text-primary);
		width: 100%;
		overflow-x: clip;
	}

	.loading-state,
	.tab-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		text-align: center;
		color: var(--text-secondary);
		padding: 2rem 1rem;
	}

	.finance-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin: 1rem 0 1.25rem;
	}

	.finance-controls label {
		display: grid;
		gap: 0.45rem;
		font-weight: 600;
	}

	.finance-controls select {
		padding: 0.65rem 0.9rem;
		border-radius: 0.75rem;
		border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
		background: var(--surface-elevated, rgba(255, 255, 255, 0.06));
		color: inherit;
		font: inherit;
	}

	.finance-meta {
		margin: 0;
		color: var(--text-secondary);
	}

	.committee-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-bottom: 1rem;
	}

	.committee-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.45rem 0.7rem;
		border-radius: 999px;
		background: var(--surface-elevated, rgba(255, 255, 255, 0.06));
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.committee-chip small {
		opacity: 0.75;
	}

	.full-page-loading {
		min-height: 40vh;
		padding: 4rem 1rem;
	}

	.tab-loading {
		min-height: 12rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-radius: 50%;
		border-top-color: var(--accent);
		animation: spin 0.9s ease-in-out infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-state p,
	.tab-loading p {
		margin: 0;
		font-size: 1.05rem;
	}

	.profile-header.elevated-surface {
		padding: 3rem;
		margin-bottom: 2rem;
		backdrop-filter: var(--blur);
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 2rem;
	}

	.photo-container {
		flex-shrink: 0;
	}

	.headshot {
		width: 120px;
		height: 150px;
		object-fit: cover;
		border-radius: var(--radius-sm);
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow:
			var(--shadow-3d-inset-top),
			0 8px 20px rgba(0, 0, 0, 0.45);
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.social-links {
		display: flex;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.social-links a {
		color: var(--blue-accent);
		text-decoration: none;
		font-weight: 500;
		font-size: 0.95rem;
	}

	.social-links a:hover {
		color: var(--accent);
		text-decoration: underline;
	}

	.external-site-link {
		margin: 0;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--blue-accent);
		font-weight: 500;
		font-size: 0.95rem;
		font-family: inherit;
		text-decoration: underline;
		text-align: left;
	}

	.external-site-link:hover {
		color: var(--accent);
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: 2.5rem;
		color: var(--text-primary);
	}

	.role {
		font-size: 1.2rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.tabs {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-color);
		padding-bottom: 0.5rem;
	}

	.tabs button {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid transparent;
		color: var(--text-secondary);
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0.5rem 1rem;
		border-radius: var(--radius-sm);
		transition: all var(--transition-base);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.tabs button:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.tabs button.active {
		color: var(--accent);
		background: linear-gradient(145deg, rgba(241, 58, 55, 0.2), rgba(241, 58, 55, 0.08));
		border-color: rgba(241, 58, 55, 0.35);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			0 4px 14px rgba(241, 58, 55, 0.15);
	}

	.panel {
		background: var(--surface-3d-gradient);
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: var(--radius-md);
		padding: 2rem;
		backdrop-filter: var(--blur);
		box-shadow: var(--shadow-3d-stack);
	}

	.financial-section {
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 0;
		box-shadow: none;
		backdrop-filter: none;
	}

	.financial-section h2 {
		margin-top: 0;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 1rem;
		table-layout: fixed;
	}

	.data-table th,
	.data-table td {
		padding: 1rem;
		text-align: left;
		border-bottom: 1px solid var(--border-color);
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.data-table th {
		color: var(--text-secondary);
		font-weight: 600;
		text-transform: uppercase;
		font-size: 0.85rem;
	}

	.data-table .amount {
		font-family: monospace;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.finance-totals {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2.5rem;
	}

	.stat-box {
		background: var(--surface-3d-gradient);
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: var(--radius-md);
		padding: 1.5rem;
		text-align: center;
		box-shadow: var(--shadow-3d-stack);
	}

	.stat-box h3 {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stat-box p {
		margin: 0;
		font-family: monospace;
		font-size: 1.75rem;
		font-weight: bold;
	}

	.amount {
		color: var(--text-primary);
	}

	.empty-state {
		color: var(--text-secondary);
		font-style: italic;
	}

	.donor-note {
		margin: 0 0 0.5rem 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.donor-table-wrap {
		margin-top: 0.5rem;
		width: 100%;
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-x: contain;
	}

	.donor-table-wrap .data-table {
		margin-top: 0;
	}

	.sponsored-header {
		margin-top: 2rem;
		margin-bottom: 1rem;
		color: var(--text-primary);
		font-size: 1.25rem;
	}

	.bills-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.bill-card {
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 1rem;
		text-decoration: none;
		transition: all var(--transition-base);
		display: block;
	}

	.bill-card.missing-link {
		cursor: default;
	}

	.bill-card:hover {
		background: rgba(255, 255, 255, 0.05);
		border-color: var(--blue-accent);
		transform: translateY(-2px);
	}

	.bill-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.bill-number {
		color: var(--blue-accent);
		font-weight: 600;
		font-family: monospace;
		font-size: 1.1rem;
	}

	.bill-date {
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	.bill-title {
		margin: 0;
		color: var(--text-primary);
		line-height: 1.4;
	}

	.buy {
		color: #b8ffd5; /* Keeps green hue for standard buys */
		font-weight: bold;
	}
	.sell {
		color: var(--accent); /* Red for sells */
		font-weight: bold;
	}

	@media (max-width: 640px) {
		.profile-page {
			padding: 1rem 0.75rem;
		}

		.profile-header.elevated-surface {
			padding: 1rem 0.85rem;
			margin-bottom: 1.25rem;
		}

		.header-content {
			gap: 0.75rem;
			align-items: flex-start;
		}

		.headshot {
			width: 76px;
			height: 95px;
			box-shadow:
				var(--shadow-3d-inset-top),
				0 4px 12px rgba(0, 0, 0, 0.4);
		}

		.profile-header h1 {
			font-size: 1.35rem;
			line-height: 1.2;
			margin: 0 0 0.3rem;
		}

		.profile-header .role {
			font-size: 0.82rem;
			line-height: 1.35;
		}

		.profile-header .header-info {
			gap: 0.3rem;
			min-width: 0;
		}

		.profile-header .social-links {
			flex-wrap: wrap;
			gap: 0.5rem;
			margin-top: 0.35rem;
		}

		.profile-header .social-links a {
			font-size: 0.78rem;
		}

		.finance-controls {
			align-items: stretch;
		}

		.finance-controls label,
		.finance-controls select {
			width: 100%;
		}

		.donor-table-wrap {
			margin-left: -0.15rem;
			margin-right: -0.15rem;
		}

		.donor-table-wrap .data-table {
			min-width: 0;
		}

		.donor-table-wrap .data-table th,
		.donor-table-wrap .data-table td {
			padding: 0.7rem 0.45rem;
			font-size: 0.78rem;
			line-height: 1.3;
		}

		.donor-table-wrap .data-table th:nth-child(1),
		.donor-table-wrap .data-table td:nth-child(1) {
			width: 46%;
		}

		.donor-table-wrap .data-table th:nth-child(2),
		.donor-table-wrap .data-table td:nth-child(2) {
			width: 29%;
		}

		.donor-table-wrap .data-table th:nth-child(3),
		.donor-table-wrap .data-table td:nth-child(3) {
			width: 25%;
		}

		.donor-table-wrap .data-table .amount {
			font-size: 0.82rem;
		}
	}
</style>
