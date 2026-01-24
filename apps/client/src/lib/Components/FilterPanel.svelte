<script>
	let {
		searchQuery = $bindable(''),
		statusFilter = $bindable('all'),
		chamberFilter = $bindable('all'),
		sponsorFilter = $bindable(''),
		dateFrom = $bindable(''),
		dateTo = $bindable(''),
		itemsPerPage = $bindable(25),
		searchCongress = $bindable(false),
		resultsSummary = '',
		onReset = () => {}
	} = $props();

	function handleReset() {
		searchQuery = '';
		statusFilter = 'all';
		chamberFilter = 'all';
		sponsorFilter = '';
		dateFrom = '';
		dateTo = '';
		itemsPerPage = 25;
		searchCongress = false;
		if (onReset) {
			onReset();
		}
	}
</script>

<div class="filter-panel">
	<div class="filter-header">
		<h3>Filters</h3>
		<button class="reset-button" onclick={handleReset}>Reset All</button>
	</div>

	<div class="filter-grid">
		<!-- Search -->
		<div class="filter-group full-width">
			<label for="search">Search Bills</label>
			<input
				type="text"
				id="search"
				bind:value={searchQuery}
				placeholder="Search by title, bill number, or description..."
			/>
		</div>

		<!-- Status Filter -->
		<div class="filter-group">
			<label for="status">Status</label>
			<select id="status" bind:value={statusFilter}>
				<option value="all">All Status</option>
				<option value="Introduced">Introduced</option>
				<option value="In Committee">In Committee</option>
				<option value="Passed House">Passed House</option>
				<option value="Passed Senate">Passed Senate</option>
				<option value="Enacted">Enacted</option>
				<option value="Vetoed">Vetoed</option>
				<option value="Failed">Failed</option>
			</select>
		</div>

		<!-- Chamber Filter -->
		<div class="filter-group">
			<label for="chamber">Origin Chamber</label>
			<select id="chamber" bind:value={chamberFilter}>
				<option value="all">All Chambers</option>
				<option value="House">House</option>
				<option value="Senate">Senate</option>
			</select>
		</div>

		<!-- Sponsor Filter -->
		<div class="filter-group">
			<label for="sponsor">Sponsor</label>
			<input
				type="text"
				id="sponsor"
				bind:value={sponsorFilter}
				placeholder="Search by sponsor name..."
			/>
		</div>

		<!-- Items Per Page -->
		<div class="filter-group">
			<label for="itemsPerPage">Items Per Page</label>
			<select id="itemsPerPage" bind:value={itemsPerPage}>
				<option value={10}>10</option>
				<option value={25}>25</option>
				<option value={50}>50</option>
				<option value={100}>100</option>
			</select>
		</div>

		<!-- Date Range -->
		<div class="filter-group">
			<label for="dateFrom">Introduced From</label>
			<input type="date" id="dateFrom" bind:value={dateFrom} />
		</div>

		<div class="filter-group">
			<label for="dateTo">Introduced To</label>
			<input type="date" id="dateTo" bind:value={dateTo} />
		</div>

		<!-- Search Congress Checkbox -->
		<div class="filter-group checkbox-group">
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={searchCongress} />
				<span>Search Congress.gov if needed</span>
			</label>
			<p class="checkbox-hint">Automatically search Congress.gov when local results are limited</p>
		</div>
	</div>

	<!-- Results Summary -->
	{#if resultsSummary}
		<div class="results-summary">
			<p>{resultsSummary}</p>
		</div>
	{/if}
</div>

<style>
	.filter-panel {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.filter-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.filter-header h3 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--text-primary);
	}

	.reset-button {
		padding: 0.5rem 1rem;
		background: transparent;
		color: var(--accent);
		border: 1px solid var(--accent);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s;
	}

	.reset-button:hover {
		background: var(--accent);
		color: #fff;
	}

	.filter-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filter-group.full-width {
		grid-column: 1 / -1;
	}

	label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	input[type='text'],
	input[type='date'],
	select {
		padding: 0.75rem;
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		font-size: 1rem;
		transition: all 0.2s;
	}

	input[type='text']:focus,
	input[type='date']:focus,
	select:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(241, 58, 55, 0.1);
	}

	input[type='text']::placeholder {
		color: var(--text-tertiary);
	}

	.checkbox-group {
		grid-column: 1 / -1;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-color);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		font-size: 1rem;
		color: var(--text-primary);
	}

	input[type='checkbox'] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: var(--accent);
	}

	.checkbox-label span {
		font-weight: 500;
	}

	.checkbox-hint {
		margin: 0.5rem 0 0 0;
		font-size: 0.85rem;
		color: var(--text-tertiary);
		font-style: italic;
	}

	.results-summary {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
		text-align: center;
	}

	.results-summary p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.95rem;
		font-weight: 500;
	}

	/* Mobile Styles */
	@media (max-width: 768px) {
		.filter-panel {
			padding: 0.75rem;
		}

		.filter-header {
			flex-direction: column;
			align-items: stretch;
			gap: 1rem;
		}

		.reset-button {
			width: 100%;
		}

		.filter-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
	}
</style>
