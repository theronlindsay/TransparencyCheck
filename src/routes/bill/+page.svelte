<script>
	import Bill from '$lib/Components/Bill.svelte';

	// Get data from the server
	let { data } = $props();

	// Store the resolved bills data
	let billsData = $state([]);

	// Watch for when the promise resolves
	$effect(() => {
		if (data.bills && data.bills.then) {
			data.bills.then(bills => {
				billsData = bills;
			});
		} else if (data.bills) {
			billsData = data.bills;
		}
	});

	// Reactive state for filters using Svelte 5 runes
	let searchQuery = $state(''); // Search term for filtering bills
	let selectedChamber = $state('all'); // Filter by chamber (House, Senate, or both)
	let selectedParty = $state('all'); // Filter by sponsor's party
	let sortBy = $state('date'); // Sort option (date, title, etc.)
	let showFilters = $state(true); // Toggle filters panel visibility

	// Derived state - filtered and sorted bills
	// This automatically recalculates when any dependencies change
	let filteredBills = $derived.by(() => {
		// Get bills from the resolved data
		let bills = billsData || [];

		// Apply search filter - searches in title and bill number
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			bills = bills.filter(bill => 
				bill.title?.toLowerCase().includes(query) ||
				bill.billNumber?.toLowerCase().includes(query) ||
				bill.id?.toLowerCase().includes(query)
			);
		}

		// Apply chamber filter - filters by origin chamber
		if (selectedChamber !== 'all') {
			bills = bills.filter(bill => 
				bill.originChamber?.toLowerCase() === selectedChamber.toLowerCase()
			);
		}

		// Apply party filter - filters by sponsor's party affiliation
		if (selectedParty !== 'all') {
			bills = bills.filter(bill => 
				bill.sponsors?.[0]?.party === selectedParty
			);
		}

		// Apply sorting based on selected option
		bills = [...bills].sort((a, b) => {
			switch (sortBy) {
				case 'date':
					// Sort by most recent update date
					return new Date(b.updateDate || 0) - new Date(a.updateDate || 0);
				case 'date-asc':
					// Sort by oldest update date
					return new Date(a.updateDate || 0) - new Date(b.updateDate || 0);
				case 'title':
					// Sort alphabetically by title
					return (a.title || '').localeCompare(b.title || '');
				case 'number':
					// Sort by bill number
					return (a.billNumber || '').localeCompare(b.billNumber || '');
				default:
					return 0;
			}
		});

		return bills;
	});

	// Function to reset all filters to default values
	function resetFilters() {
		searchQuery = '';
		selectedChamber = 'all';
		selectedParty = 'all';
		sortBy = 'date';
	}

	// Get count of active filters (for UI badge)
	let activeFilterCount = $derived.by(() => {
		let count = 0;
		if (searchQuery.trim()) count++;
		if (selectedChamber !== 'all') count++;
		if (selectedParty !== 'all') count++;
		if (sortBy !== 'date') count++;
		return count;
	});
</script>

<div class="bills-page">
	<!-- Page Header -->
	<div class="page-header">
		<h1>Congressional Bills</h1>
		<p class="subtitle">Browse and filter all bills in the database</p>
	</div>

	<!-- Filters Panel -->
	<div class="filters-container">
		<!-- Toggle Button -->
		<button 
			class="toggle-filters-btn" 
			onclick={() => showFilters = !showFilters}
			aria-label="Toggle filters"
		>
			<span class="icon">{showFilters ? '▼' : '▶'}</span>
			Filters
			{#if activeFilterCount > 0}
				<span class="filter-badge">{activeFilterCount}</span>
			{/if}
		</button>

		<!-- Filters Panel Content (collapsible) -->
		{#if showFilters}
			<div class="filters-panel">
				<!-- Search Input -->
				<div class="filter-group">
					<label for="search">Search Bills</label>
					<input
						id="search"
						type="text"
						bind:value={searchQuery}
						placeholder="Search by title or bill number..."
						class="filter-input"
					/>
				</div>

				<!-- Chamber Filter -->
				<div class="filter-group">
					<label for="chamber">Chamber</label>
					<select id="chamber" bind:value={selectedChamber} class="filter-select">
						<option value="all">All Chambers</option>
						<option value="house">House</option>
						<option value="senate">Senate</option>
					</select>
				</div>

				<!-- Party Filter -->
				<div class="filter-group">
					<label for="party">Sponsor Party</label>
					<select id="party" bind:value={selectedParty} class="filter-select">
						<option value="all">All Parties</option>
						<option value="D">Democrat</option>
						<option value="R">Republican</option>
						<option value="I">Independent</option>
					</select>
				</div>

				<!-- Sort Options -->
				<div class="filter-group">
					<label for="sort">Sort By</label>
					<select id="sort" bind:value={sortBy} class="filter-select">
						<option value="date">Most Recent</option>
						<option value="date-asc">Oldest First</option>
						<option value="title">Title (A-Z)</option>
						<option value="number">Bill Number</option>
					</select>
				</div>

				<!-- Reset Button -->
				<div class="filter-group">
					<button class="reset-btn" onclick={resetFilters}>
						Reset Filters
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Results Count -->
	{#await data.bills}
		<div class="loading-message">
			<div class="spinner"></div>
			<p>Loading bills...</p>
		</div>
	{:then}
		<div class="results-info">
			<p>
				Showing <strong>{filteredBills.length}</strong> of <strong>{billsData?.length || 0}</strong> bills
			</p>
		</div>

		<!-- Bills Grid -->
		{#if filteredBills.length === 0}
			<div class="empty-state">
				<p>No bills match your filters.</p>
				<button class="reset-btn" onclick={resetFilters}>Clear Filters</button>
			</div>
		{:else}
			<div class="bills-grid">
				{#each filteredBills as bill (bill.id)}
					<Bill
						id={bill.id}
						number={bill.billNumber || bill.number || ''}
						title={bill.title || 'Untitled Bill'}
						sponsors={bill.sponsors || []}
						committee={bill.primaryCommitteeName || 'Unassigned'}
						statusTag={bill.billType?.toUpperCase() || ''}
						latestAction={bill.latestAction}
						updatedAt={bill.updateDate || bill.updatedAt || ''}
					/>
				{/each}
			</div>
		{/if}
	{:catch error}
		<div class="error-message">
			<p>Error loading bills: {error.message}</p>
		</div>
	{/await}
</div>

<style>
	.bills-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	/* Page Header Styles */
	.page-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.page-header h1 {
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	.subtitle {
		color: var(--text-secondary);
		font-size: 1.1rem;
	}

	/* Filters Container */
	.filters-container {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	/* Toggle Filters Button */
	.toggle-filters-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		color: var(--text-primary);
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0.5rem;
		transition: color var(--transition-base);
	}

	.toggle-filters-btn:hover {
		color: var(--accent);
	}

	.icon {
		font-size: 0.9rem;
		transition: transform var(--transition-base);
	}

	.filter-badge {
		background: var(--accent);
		color: white;
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 10px;
		font-weight: 700;
	}

	/* Filters Panel Grid */
	.filters-panel {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-color);
	}

	/* Filter Group */
	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filter-group label {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Filter Input Styles */
	.filter-input,
	.filter-select {
		padding: 0.75rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 1rem;
		transition: all var(--transition-base);
	}

	.filter-input:focus,
	.filter-select:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(241, 58, 55, 0.1);
	}

	.filter-input::placeholder {
		color: var(--text-secondary);
		opacity: 0.6;
	}

	/* Reset Button */
	.reset-btn {
		padding: 0.75rem 1.5rem;
		background: rgba(241, 58, 55, 0.1);
		border: 1px solid rgba(241, 58, 55, 0.3);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-base);
		width: 100%;
	}

	.reset-btn:hover {
		background: rgba(241, 58, 55, 0.2);
		border-color: rgba(241, 58, 55, 0.5);
		transform: translateY(-2px);
	}

	/* Results Info */
	.results-info {
		margin-bottom: 1.5rem;
		text-align: center;
		color: var(--text-secondary);
	}

	.results-info strong {
		color: var(--text-primary);
		font-weight: 700;
	}

	/* Bills Grid */
	.bills-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: var(--text-secondary);
	}

	.empty-state p {
		font-size: 1.2rem;
		margin-bottom: 1.5rem;
	}

	/* Loading State */
	.loading-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 4rem 2rem;
		color: var(--text-secondary);
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-message {
		text-align: center;
		padding: 4rem 2rem;
		color: #f87171;
		background: rgba(248, 113, 113, 0.1);
		border-radius: var(--radius-lg);
		border: 1px solid rgba(248, 113, 113, 0.3);
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.bills-page {
			padding: 1.5rem;
		}

		.page-header h1 {
			font-size: 2rem;
		}

		.filters-panel {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.bills-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 480px) {
		.bills-page {
			padding: 1rem;
		}

		.page-header h1 {
			font-size: 1.75rem;
		}

		.filters-container {
			padding: 1rem;
		}
	}
</style>
