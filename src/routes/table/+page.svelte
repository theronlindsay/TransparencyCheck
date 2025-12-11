<script>
	let { data } = $props();
</script>

<div class="page-container">
	<h1>Bills Database</h1>

	{#if data.error}
		<div class="error-message">
			<p>Error loading bills: {data.error}</p>
		</div>
	{:else if data.bills.length === 0}
		<div class="empty-message">
			<p>No bills found in the database.</p>
		</div>
	{:else}
		<div class="table-wrapper">
			<table>
				<thead>
					<tr>
						<th>Number</th>
						<th>Title</th>
						<th>Sponsor</th>
						<th>Committee</th>
						<th>Status</th>
						<th>Latest Action</th>
						<th>Updated</th>
					</tr>
				</thead>
				<tbody>
					{#each data.bills as bill}
						<tr>
							<td class="bill-number">{bill.number}</td>
							<td class="bill-title">
								{#if bill.fullTextUrl}
									<a href={bill.fullTextUrl} target="_blank" rel="noopener noreferrer">
										{bill.title}
									</a>
								{:else}
									{bill.title}
								{/if}
							</td>
							<td>{bill.sponsor}</td>
							<td>{bill.committee}</td>
							<td>
								{#if bill.statusTag}
									<span class="badge">{bill.statusTag}</span>
								{:else}
									—
								{/if}
							</td>
							<td class="latest-action">{bill.latestAction}</td>
							<td class="updated-date">
								{new Date(bill.updatedAt).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="table-footer">
			<p>Total bills: {data.bills.length}</p>
		</div>
	{/if}
</div>

<style>
	.page-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	h1 {
		margin-bottom: 2rem;
		font-size: 2.5rem;
	}

	.error-message,
	.empty-message {
		padding: 2rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		text-align: center;
		color: var(--text-secondary);
	}

	.table-wrapper {
		overflow-x: auto;
		margin-bottom: 1rem;
	}

	table {
		min-width: 100%;
	}

	.bill-number {
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.bill-title {
		max-width: 400px;
		color: var(--text-primary);
	}

	.bill-title a {
		color: var(--accent);
		text-decoration: none;
		transition: color var(--transition-base);
	}

	.bill-title a:hover {
		color: #ff5b58;
		text-decoration: underline;
	}

	.latest-action {
		max-width: 300px;
	}

	.updated-date {
		white-space: nowrap;
		font-size: 0.9rem;
	}

	.table-footer {
		display: flex;
		justify-content: flex-end;
		padding: 1rem 0;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.table-footer p {
		margin: 0;
	}

	@media (max-width: 768px) {
		.page-container {
			padding: 0.5rem;
		}

		h1 {
			font-size: 1.8rem;
		}

		table {
			font-size: 0.85rem;
		}

		th,
		td {
			padding: 0.75rem 0.8rem;
		}
	}
</style>
