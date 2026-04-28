<script>
	export let data;
	export let form;

	function formatLocation(representative) {
		const state = representative.state || 'Unknown';
		const district = representative.district ? `-${representative.district}` : '';
		return `${state}${district}`;
	}

	function isActiveRow(bioguideId) {
		return form?.bioguideId === bioguideId;
	}
</script>

<svelte:head>
	<title>Admin Representatives</title>
</svelte:head>

<section class="hero">
	<div>
		<p class="eyebrow">Representatives</p>
		<h2>FEC Candidate Controls</h2>
		<p class="intro">
			Review FEC candidate IDs, lock manual overrides, import official FEC bulk files, and refresh
			representative finance data one row at a time.
		</p>
	</div>

	<div class="hero-actions">
		<form method="POST">
			<input type="hidden" name="intent" value="import-fec-bulk" />
			<button type="submit">Import FEC Bulk Metadata</button>
		</form>

		<form method="POST">
			<input type="hidden" name="intent" value="import-fec-bulk-finance" />
			<button type="submit">Import FEC Bulk Finance</button>
		</form>

		<form method="POST">
			<input type="hidden" name="intent" value="rebuild-finance-caches" />
			<button type="submit">Rebuild Finance Caches</button>
		</form>

		<form method="POST">
			<input type="hidden" name="intent" value="refresh-fec-ids" />
			<button type="submit">Refresh FEC IDs Only</button>
		</form>
	</div>
</section>

<section class="summary-grid">
	<article class="summary-card">
		<p class="eyebrow">Total</p>
		<h3>{data.summary.total}</h3>
		<p>Representatives in the current `people` collection.</p>
	</article>
	<article class="summary-card">
		<p class="eyebrow">Missing FEC IDs</p>
		<h3>{data.summary.missingFecIds}</h3>
		<p>These rows can be updated here or resolved during a refresh.</p>
	</article>
	<article class="summary-card">
		<p class="eyebrow">Locked IDs</p>
		<h3>{data.summary.lockedFecIds}</h3>
		<p>Locked values are treated as manual overrides and cron will not replace them.</p>
	</article>
</section>

{#if form?.error}
	<section class="output error">
		<h3>Representative Action Error</h3>
		<pre>{form.error}</pre>
	</section>
{/if}

{#if form?.message}
	<section class="output">
		<div class="section-head">
			<div>
				<p class="eyebrow">Last Action</p>
				<h3>{form.message}</h3>
			</div>
			{#if form?.ranAt}
				<p class="meta">{form.ranAt}</p>
			{/if}
		</div>

		{#if form?.result}
			<pre>{JSON.stringify(form.result, null, 2)}</pre>
		{/if}

		{#if form?.logs?.length}
			<h4>Captured logs</h4>
			<pre>{form.logs.join('\n')}</pre>
		{/if}
	</section>
{/if}

<section class="panel">
	<div class="section-head">
		<div>
			<p class="eyebrow">Current Records</p>
			<h3>Representative FEC IDs</h3>
		</div>
		<p class="meta">Manual saves lock the FEC ID until it is cleared.</p>
	</div>

	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Representative</th>
					<th>Location</th>
					<th>Current FEC ID</th>
					<th>Financial Cache</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.representatives as representative}
					<tr class:active={isActiveRow(representative.bioguideId)}>
						<td>
							<div class="name-cell">
								<strong>{representative.name || representative.bioguideId}</strong>
								<span>{representative.branch || 'Unknown'} {representative.party || ''}</span>
								<small>{representative.bioguideId}</small>
							</div>
						</td>
						<td>{formatLocation(representative)}</td>
						<td>
							<form method="POST" class="inline-form">
								<input type="hidden" name="intent" value="update-fec-id" />
								<input type="hidden" name="bioguideId" value={representative.bioguideId} />
								<input
									type="text"
									name="fecCandidateId"
									value={representative.fecCandidateId}
									placeholder="H0XX00000"
									aria-label={`FEC candidate id for ${representative.name}`}
								/>
								<button type="submit">Save</button>
							</form>
							<p class="status">
								{#if representative.fecCandidateIdLocked}
									Locked manual override
								{:else if representative.fecCandidateId}
									Stored auto-resolved ID
								{:else}
									No FEC ID stored
								{/if}
							</p>
						</td>
						<td>
							<div class="finance-cell">
								<span>Profile FEC ID: {representative.financeFecCandidateId || 'none'}</span>
								<span>Donors: {representative.donorCount}</span>
								<span>
									Last synced:
									{representative.financialLastSyncedAt || 'never'}
								</span>
							</div>
						</td>
						<td>
							<form method="POST">
								<input type="hidden" name="intent" value="refresh-financial-data" />
								<input type="hidden" name="bioguideId" value={representative.bioguideId} />
								<button type="submit">Refresh Financial Data</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.hero,
	.summary-grid,
	.output,
	.panel {
		margin-top: 24px;
	}

	.hero,
	.summary-card,
	.output,
	.panel {
		border-radius: 24px;
		border: 1px solid var(--admin-border);
		background: var(--admin-surface);
		box-shadow:
			0 18px 56px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.hero,
	.summary-card,
	.output,
	.panel {
		padding: 22px;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 18px;
	}

	.eyebrow {
		margin: 0 0 8px;
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: var(--admin-muted);
	}

	h2,
	h3,
	h4,
	p {
		margin-top: 0;
	}

	.intro,
	.meta,
	.summary-card p,
	.status,
	.name-cell span,
	.name-cell small,
	.finance-cell span {
		color: var(--admin-muted);
		line-height: 1.5;
	}

	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 18px;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 14px 12px;
		border-top: 1px solid var(--admin-border);
		text-align: left;
		vertical-align: top;
	}

	th {
		color: var(--admin-muted);
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	tr.active {
		background: rgba(38, 139, 210, 0.08);
	}

	.name-cell,
	.finance-cell {
		display: grid;
		gap: 4px;
	}

	.inline-form {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: center;
	}

	input,
	button {
		border-radius: 999px;
		font: inherit;
	}

	input {
		min-width: 150px;
		border: 1px solid var(--admin-border);
		background: rgba(0, 20, 28, 0.5);
		color: var(--admin-text);
		padding: 11px 16px;
	}

	button {
		border: 0;
		padding: 11px 16px;
		font-weight: 700;
		cursor: pointer;
		background: linear-gradient(135deg, var(--admin-accent), var(--admin-accent-strong));
		color: #f2fbfd;
	}

	.status {
		margin: 8px 0 0;
	}

	pre {
		margin: 0;
		padding: 18px;
		overflow-x: auto;
		border-radius: 18px;
		background: var(--admin-code-bg);
		color: var(--admin-code-text);
		font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
		font-size: 0.92rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.output h4 {
		margin: 18px 0 12px;
	}

	.error pre {
		background: rgba(80, 18, 18, 0.84);
		color: var(--admin-danger-text);
	}

	@media (max-width: 720px) {
		.section-head {
			flex-direction: column;
		}

		th,
		td {
			padding-left: 0;
			padding-right: 0;
		}
	}
</style>
