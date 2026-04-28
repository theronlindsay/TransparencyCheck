<script>
	export let data;
	export let form;

	function pageHref(collectionName, page, query = '') {
		const params = new URLSearchParams({
			collection: collectionName,
			page: String(page)
		});

		if (query.trim()) {
			params.set('query', query.trim());
		}

		return `/admin/mongodb?${params.toString()}`;
	}
</script>

<svelte:head>
	<title>Admin MongoDB</title>
</svelte:head>

<section class="hero">
	<div>
		<p class="eyebrow">MongoDB</p>
		<h2>Collection Browser</h2>
		<p class="intro">
			Browse cached server data, inspect documents, and clear individual collections without leaving
			the admin panel.
		</p>
	</div>
</section>

{#if form?.error}
	<section class="output error">
		<h3>MongoDB Error</h3>
		<pre>{form.error}</pre>
	</section>
{/if}

<section class="grid">
	{#each data.collections as collection}
		<article class="card">
			<div>
				<h3>{collection.name}</h3>
				<p>{collection.count} document{collection.count === 1 ? '' : 's'}</p>
			</div>

			<div class="card-actions">
				<a href={pageHref(collection.name, 1)}>Browse</a>
				<form method="POST" action="?/clearCollection">
					<input type="hidden" name="collection" value={collection.name} />
					<button type="submit" class="danger">Clear</button>
				</form>
			</div>
		</article>
	{/each}
</section>

{#if data.selectedCollection}
	<section class="panel">
		<div class="section-head">
			<div>
				<p class="eyebrow">Selected Collection</p>
				<h3>{data.selectedCollection.name}</h3>
				<p class="meta">{data.selectedCollection.total} document(s)</p>
			</div>

			<div class="pager">
				{#if data.selectedCollection.page > 1}
					<a
						href={pageHref(
							data.selectedCollection.name,
							data.selectedCollection.page - 1,
							data.selectedCollection.query
						)}>Previous</a
					>
				{/if}
				<span>Page {data.selectedCollection.page} / {data.selectedCollection.totalPages}</span>
				{#if data.selectedCollection.page < data.selectedCollection.totalPages}
					<a
						href={pageHref(
							data.selectedCollection.name,
							data.selectedCollection.page + 1,
							data.selectedCollection.query
						)}>Next</a
					>
				{/if}
			</div>
		</div>

		<form class="query-form" method="GET">
			<input type="hidden" name="collection" value={data.selectedCollection.name} />
			<input
				type="text"
				name="query"
				value={data.selectedCollection.query}
				placeholder={'{key:value}'}
				aria-label="MongoDB query"
			/>
			<button type="submit">Run Query</button>
			<a href={pageHref(data.selectedCollection.name, 1)}>Clear Query</a>
		</form>

		{#if data.selectedCollection.queryError}
			<p class="query-error">{data.selectedCollection.queryError}</p>
		{/if}

		{#if data.selectedCollection.documents.length === 0}
			<p class="empty-state">This collection is currently empty.</p>
		{:else}
			<div class="table-wrap">
				<table class="documents-table">
					<thead>
						<tr>
							<th>ID</th>
							<th>Raw Data</th>
						</tr>
					</thead>
					<tbody>
						{#each data.selectedCollection.documents as document}
							<tr>
								<td class="document-id">{document._id || '(no _id)'}</td>
								<td>
									<pre>{JSON.stringify(document, null, 2)}</pre>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
{/if}

<style>
	.hero,
	.grid,
	.panel,
	.output {
		margin-top: 24px;
	}

	.hero,
	.card,
	.panel,
	.output {
		border-radius: 24px;
		border: 1px solid var(--admin-border);
		background: var(--admin-surface);
		box-shadow:
			0 18px 56px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.hero,
	.card,
	.panel,
	.output {
		padding: 22px;
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
	p {
		margin-top: 0;
	}

	.intro,
	.meta,
	.card p,
	.empty-state {
		color: var(--admin-muted);
		line-height: 1.5;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 18px;
	}

	.card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 18px;
	}

	.card-actions,
	.pager,
	.query-form {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: center;
	}

	a,
	button {
		border: 0;
		border-radius: 999px;
		padding: 11px 16px;
		font: inherit;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
		background: linear-gradient(135deg, var(--admin-accent), var(--admin-accent-strong));
		color: #f2fbfd;
	}

	input {
		flex: 1 1 280px;
		min-width: 220px;
		border-radius: 999px;
		border: 1px solid var(--admin-border);
		background: rgba(0, 20, 28, 0.5);
		color: var(--admin-text);
		padding: 11px 16px;
		font: inherit;
	}

	.danger {
		background: rgba(220, 50, 47, 0.22);
		color: var(--admin-danger-text);
		border: 1px solid rgba(220, 50, 47, 0.35);
	}

	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 18px;
	}

	.query-form {
		margin-bottom: 18px;
	}

	.query-error {
		margin: 0 0 18px;
		color: var(--admin-danger-text);
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

	.document-id {
		min-width: 180px;
		font-weight: 700;
		color: var(--admin-text);
	}

	pre {
		margin: 0;
		padding: 14px;
		border-radius: 18px;
		background: var(--admin-code-bg);
		color: var(--admin-code-text);
		font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
		font-size: 0.9rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
		overflow: auto;
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
