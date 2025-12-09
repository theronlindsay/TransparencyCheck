<script>
	import Bill from '$lib/Components/Bill.svelte';
	import FilterPanel from '$lib/Components/FilterPanel.svelte';

	let { data } = $props();

	// Store the resolved bills data
	let billsData = $state([]);
	let searchQuery = $state('');
	let statusFilter = $state('all');
	let chamberFilter = $state('all');
	let sponsorFilter = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');
	let itemsPerPage = $state(25);
	let currentPage = $state(1);
	let showFilters = $state(true);
	let isSearching = $state(false);
	let serverSearchResults = $state([]);
	let hasSearched = $state(false);
	let searchCongress = $state(false);
	let shouldShowCongressPrompt = $state(false);

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

	// Filtered bills
	let filteredBills = $derived(() => {
		// Use server search results if available (even while loading)
		if (serverSearchResults.length > 0) {
			return serverSearchResults;
		}

		if (!billsData || billsData.length === 0) return [];
		
		return billsData.filter((bill) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const matchesSearch =
					bill.title?.toLowerCase().includes(query) ||
					bill.billNumber?.toLowerCase().includes(query) ||
					bill.policyArea?.toLowerCase().includes(query);
				if (!matchesSearch) return false;
			}

			// Status filter
			if (statusFilter !== 'all' && bill.status !== statusFilter) {
				return false;
			}

			// Chamber filter
			if (chamberFilter !== 'all' && bill.originChamber !== chamberFilter) {
				return false;
			}

			// Sponsor filter
			if (sponsorFilter) {
				const sponsorQuery = sponsorFilter.toLowerCase();
				const sponsors = bill.sponsors || '';
				if (!sponsors.toLowerCase().includes(sponsorQuery)) {
					return false;
				}
			}

			// Date range filter
			if (dateFrom && bill.introducedDate < dateFrom) {
				return false;
			}
			if (dateTo && bill.introducedDate > dateTo) {
				return false;
			}

			return true;
		});
	});

	// Paginated bills
	let paginatedBills = $derived(() => {
		const filtered = filteredBills();
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return filtered.slice(startIndex, endIndex);
	});

	let totalPages = $derived(Math.ceil((filteredBills()?.length || 0) / itemsPerPage));

	// Check if we should show Congress search prompt
	$effect(() => {
		const filtered = filteredBills();
		if (filtered.length < 10 && filtered.length > 0 && !isSearching && !hasSearched && !serverSearchResults.length) {
			shouldShowCongressPrompt = true;
		} else {
			shouldShowCongressPrompt = false;
		}
	});

	// Auto-search Congress if checkbox is enabled and results are low
	$effect(() => {
		const filtered = filteredBills();
		if (searchCongress && filtered.length < 10 && !isSearching && !hasSearched && !serverSearchResults.length) {
			searchOnServer();
		}
	});

	// Reset to page 1 when filters change
	$effect(() => {
		searchQuery;
		statusFilter;
		chamberFilter;
		sponsorFilter;
		dateFrom;
		dateTo;
		itemsPerPage;
		currentPage = 1;
	});

	function toggleFilters() {
		showFilters = !showFilters;
	}

	function goToPage(page) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	async function searchOnServer() {
		isSearching = true;
		hasSearched = false;
		serverSearchResults = [];
		currentPage = 1;

		try {
			const params = new URLSearchParams();
			
			if (searchQuery) params.append('search', searchQuery);
			if (statusFilter !== 'all') params.append('status', statusFilter);
			if (chamberFilter !== 'all') params.append('chamber', chamberFilter);
			if (sponsorFilter) params.append('sponsor', sponsorFilter);
			if (dateFrom) params.append('dateFrom', dateFrom);
			if (dateTo) params.append('dateTo', dateTo);
			params.append('stream', 'true');

			const response = await fetch(`/api/search-bills?${params.toString()}`);
			
			console.log('Response status:', response.status);
			console.log('Response headers:', response.headers.get('Content-Type'));
			
			if (response.ok && response.body) {
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = '';

				try {
					while (true) {
						const { done, value } = await reader.read();
						
						if (done) {
							console.log('Stream completed');
							break;
						}
						
						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						
						// Keep the last incomplete line in the buffer
						buffer = lines.pop() || '';
						
						// Process complete lines
						for (const line of lines) {
							if (line.trim()) {
								try {
									const bill = JSON.parse(line);
									console.log('Received bill:', bill.billNumber);
									// Create a new array to trigger reactivity
									serverSearchResults = [...serverSearchResults, bill];
								} catch (e) {
									console.error('Error parsing bill:', e, 'Line:', line);
								}
							}
						}
					}
				} catch (streamError) {
					console.error('Stream reading error:', streamError);
				}
				
				hasSearched = true;
			} else {
				console.error('Response not ok or no body');
			}
		} catch (error) {
			console.error('Server search failed:', error);
		} finally {
			isSearching = false;
			console.log('Search completed, total bills:', serverSearchResults.length);
		}
	}

	function resetServerSearch() {
		serverSearchResults = [];
		hasSearched = false;
	}

	function handleFilterReset() {
		resetServerSearch();
	}
</script>

<div class="content">
	<div class="hero-section">
		<h2>Welcome to Transparency Check</h2>
		<p>Track and monitor congressional bills and legislative transparency.</p>
	</div>

	<section class="recent-bills-section">
		<!-- Mobile Filter Toggle -->
		<div class="filter-header-mobile">
			<h3>Recently Updated Bills</h3>
			<button class="filter-toggle" onclick={toggleFilters} aria-label="Toggle filters">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="4" y1="6" x2="20" y2="6"></line>
					<line x1="4" y1="12" x2="20" y2="12"></line>
					<line x1="4" y1="18" x2="20" y2="18"></line>
				</svg>
				Filters {showFilters ? '▲' : '▼'}
			</button>
		</div>

		<!-- Desktop Header -->
		<div class="filter-header-desktop">
			<h3>Recently Updated Bills</h3>
			<br>http://localhost:5173/
		</div>

		{#await data.bills}
			<!-- Loading state -->
			<div class="loading-message">
				<div class="spinner"></div>
				<p>Loading bills from Congress.gov...</p>
			</div>
		{:then}
			<!-- Success state -->
			{#if !billsData || billsData.length === 0}
				<div class="empty-message">
					<p>No bills found in the database.</p>
				</div>
			{:else}
				<!-- Filter Panel -->
				<div class="filter-container" class:hidden={!showFilters}>
					<FilterPanel
						bind:searchQuery
						bind:statusFilter
						bind:chamberFilter
						bind:sponsorFilter
						bind:dateFrom
						bind:dateTo
						bind:itemsPerPage
						bind:searchCongress
						resultsSummary="Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredBills().length)} of {filteredBills().length} bills"
						onReset={handleFilterReset}
					/>
				</div>

				<!-- Congress Search Prompt -->
				{#if shouldShowCongressPrompt && !searchCongress}
					<div class="congress-prompt">
						<p>
							<strong>Limited results found ({filteredBills().length} bills)</strong>
						</p>
						<p>Enable "Search Congress.gov if needed" in filters to automatically search for more bills.</p>
					</div>
				{/if}

				

				<!-- Bills Grid -->
				{#if isSearching && serverSearchResults.length === 0}
					<div class="loading-message">
						<div class="spinner"></div>
						<p>Searching Congress.gov for matching bills...</p>
					</div>
				{:else if paginatedBills().length === 0 && !isSearching}
					<div class="empty-message">
						{#if hasSearched}
							<p>No bills found on Congress.gov matching your filters.</p>
							<button class="reset-search-button" onclick={resetServerSearch}>
								Back to Local Results
							</button>
						{:else}
							<p>No bills match the current filters in the local database.</p>
							<p class="empty-hint">Enable "Search Congress.gov if needed" in filters to automatically search when results are limited.</p>
						{/if}
					</div>
				{:else}
					<div class="bills-grid">
						{#each paginatedBills() as bill}
							<Bill
								id={bill.id}
								number={bill.billNumber || bill.number}
								title={bill.title}
								sponsors={bill.sponsors}
								committee={bill.primaryCommitteeName || 'Unassigned'}
								statusTag={bill.status || bill.statusTag}
								latestAction={bill.latestAction}
								updatedAt={bill.updateDate}
							/>
						{/each}
					</div>
					
					{#if isSearching}
						<div class="loading-footer">
							<div class="spinner-small"></div>
							<p>Loading more bills from Congress.gov...</p>
						</div>
					{/if}

					<!-- Pagination -->
					{#if totalPages > 1}
						<div class="pagination">
							<button
								class="page-button"
								onclick={() => goToPage(currentPage - 1)}
								disabled={currentPage === 1}
							>
								Previous
							</button>

							<div class="page-numbers">
								{#if currentPage > 2}
									<button class="page-button" onclick={() => goToPage(1)}>1</button>
									{#if currentPage > 3}
										<span class="ellipsis">...</span>
									{/if}
								{/if}

								{#if currentPage > 1}
									<button class="page-button" onclick={() => goToPage(currentPage - 1)}>
										{currentPage - 1}
									</button>
								{/if}

								<button class="page-button active" disabled>
									{currentPage}
								</button>

								{#if currentPage < totalPages}
									<button class="page-button" onclick={() => goToPage(currentPage + 1)}>
										{currentPage + 1}
									</button>
								{/if}

								{#if currentPage < totalPages - 1}
									{#if currentPage < totalPages - 2}
										<span class="ellipsis">...</span>
									{/if}
									<button class="page-button" onclick={() => goToPage(totalPages)}>
										{totalPages}
									</button>
								{/if}
							</div>

							<button
								class="page-button"
								onclick={() => goToPage(currentPage + 1)}
								disabled={currentPage === totalPages}
							>
								Next
							</button>
						</div>
					{/if}
				{/if}
			{/if}
		{:catch error}
			<!-- Error state -->
			<div class="error-message">
				<p>Error loading bills: {error.message}</p>
			</div>
		{/await}
	</section>
</div>

<style>
	.content {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	.hero-section {
		text-align: center;
		margin-bottom: 3rem;
		padding: 2rem 1rem;
	}

	.hero-section p {
		font-size: 1.2rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.recent-bills-section {
		margin-top: 2rem;
	}

	.filter-header-mobile {
		display: none;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.filter-header-desktop {
		display: block;
	}

	.filter-header-desktop h3,
	.filter-header-mobile h3 {
		font-size: 1.8rem;
		margin: 0;
		color: var(--text-primary);
	}

	.filter-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s;
	}

	.filter-toggle:hover {
		background: var(--bg-primary);
		border-color: var(--accent);
	}

	.filter-toggle svg {
		width: 20px;
		height: 20px;
	}

	.filter-container {
		transition: all 0.3s ease;
		max-height: 2000px;
		overflow: hidden;
	}

	.filter-container.hidden {
		max-height: 0;
		margin-bottom: 0;
		opacity: 0;
	}

	.congress-prompt {
		padding: 1rem 1.5rem;
		background: rgba(241, 58, 55, 0.1);
		border: 1px solid rgba(241, 58, 55, 0.3);
		border-radius: var(--radius-md);
		margin-bottom: 1.5rem;
	}

	.congress-prompt p {
		margin: 0.5rem 0;
		color: var(--text-primary);
		font-size: 0.95rem;
	}

	.congress-prompt p:first-child {
		margin-top: 0;
	}

	.congress-prompt p:last-child {
		margin-bottom: 0;
		color: var(--text-secondary);
	}

	.empty-hint {
		margin-top: 0.75rem;
		font-size: 0.9rem;
		color: var(--text-tertiary);
	}

	.bills-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	.error-message,
	.empty-message,
	.loading-message {
		padding: 2rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		text-align: center;
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
	}

	.loading-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.spinner-small {
		width: 24px;
		height: 24px;
		border: 3px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.loading-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem;
		margin-top: 1rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
	}

	.loading-footer p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.95rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Pagination Styles */
	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		margin-top: 2rem;
		padding: 1rem;
	}

	.page-numbers {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.page-button {
		padding: 0.5rem 1rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: 0.95rem;
		transition: all 0.2s;
		min-width: 44px;
	}

	.page-button:hover:not(:disabled) {
		background: var(--bg-primary);
		border-color: var(--accent);
		color: var(--accent);
	}

	.page-button.active {
		background: var(--accent);
		color: #fff;
		border-color: var(--accent);
		cursor: default;
	}

	.page-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ellipsis {
		color: var(--text-secondary);
		padding: 0 0.25rem;
	}

	.reset-search-button {
		margin-top: 1rem;
		padding: 0.75rem 1.5rem;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: 1rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.reset-search-button:hover {
		background: color-mix(in srgb, var(--accent) 85%, black);
		transform: translateY(-1px);
	}

	.reset-search-button {
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.reset-search-button:hover {
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.reset-search-button:hover {
		background: var(--bg-secondary);
		border-color: var(--accent);
		color: var(--accent);
		transform: translateY(0);
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.content {
			padding: 0.75rem;
		}

		.hero-section {
			margin-bottom: 1rem;
			padding: 0.75rem 1rem;
		}

		h2 {
			font-size: 2rem;
			padding: 0 0.5rem;
		}

		.hero-section p {
			font-size: 1rem;
			padding: 0 0.5rem;
		}

		.filter-header-mobile {
			display: flex;
		}

		.filter-header-desktop {
			display: none;
		}

		.filter-container {
			margin-bottom: 1rem;
		}

		.bills-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.pagination {
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.page-button {
			padding: 0.4rem 0.8rem;
			font-size: 0.85rem;
			min-width: 40px;
		}

		.page-numbers {
			flex-wrap: wrap;
		}
	}

	@media (max-width: 480px) {
		.content {
			padding: 0.5rem;
		}

		h2 {
			font-size: 1.75rem;
		}

		.hero-section p {
			font-size: 0.95rem;
		}

		.filter-header-mobile h3 {
			font-size: 1.25rem;
		}

		.filter-toggle {
			padding: 0.6rem 0.8rem;
			font-size: 0.85rem;
		}

		.pagination {
			padding: 0.75rem;
		}

		.page-button {
			padding: 0.35rem 0.6rem;
			font-size: 0.8rem;
			min-width: 36px;
		}
	}
</style>

