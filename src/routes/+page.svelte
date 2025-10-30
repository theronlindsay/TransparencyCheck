<script>
	import Bill from '$lib/Components/Bill.svelte';

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
</script>

<div class="content">
	<div class="hero-section">
		<h2>Welcome to Transparency Check</h2>
		<p>Track and monitor congressional bills and legislative transparency.</p>
	</div>

	<section class="recent-bills-section">
		<h3>Recently Updated Bills</h3>

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
				<div class="bills-grid">
					{#each billsData as bill}
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

	.recent-bills-section h3 {
		font-size: 1.8rem;
		margin-bottom: 1.5rem;
		color: var(--text-primary);
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

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.content {
			padding: 1.5rem;
		}

		.hero-section {
			margin-bottom: 2rem;
			padding: 1rem;
		}

		h2 {
			font-size: 2rem;
		}

		.hero-section p {
			font-size: 1rem;
		}

		.recent-bills-section h3 {
			font-size: 1.5rem;
		}

		.bills-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
	}

	@media (max-width: 480px) {
		.content {
			padding: 1rem;
		}

		h2 {
			font-size: 1.75rem;
		}

		.hero-section p {
			font-size: 0.95rem;
		}

		.recent-bills-section h3 {
			font-size: 1.25rem;
		}
	}
</style>

