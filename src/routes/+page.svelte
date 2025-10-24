<script>
	import Bill from '$lib/Components/Bill.svelte';

	let { data } = $props();
</script>

<div class="content">
	<div class="hero-section">
		<h2>Welcome to Transparency Check</h2>
		<p>Track and monitor congressional bills and legislative transparency.</p>
	</div>

	<section class="recent-bills-section">
		<h3>Recently Updated Bills</h3>

		{#if data.error}
			<div class="error-message">
				<p>Error loading bills: {data.error}</p>
			</div>
		{:else if data.bills.length === 0}
			<div class="empty-message">
				<p>No bills found in the database.</p>
			</div>
		{:else}
			<div class="bills-grid">
				{#each data.bills as bill}
					<Bill
						id={bill.id}
						number={bill.number}
						title={bill.title}
						sponsor={bill.sponsor}
						committee={bill.committee}
						statusTag={bill.statusTag}
						latestAction={bill.latestAction}
						updatedAt={bill.updatedAt}
						fullTextUrl={bill.fullTextUrl}
					/>
				{/each}
			</div>
		{/if}
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
	.empty-message {
		padding: 2rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		text-align: center;
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
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

