<script>
	export let data;
	export let form;

	function formatBytes(bytes) {
		const value = Number(bytes) || 0;
		if (value < 1024) return `${value} B`;
		if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
		return `${(value / (1024 * 1024)).toFixed(2)} MB`;
	}
</script>

<svelte:head>
	<title>Admin Bug Reports</title>
</svelte:head>

<section class="hero">
	<div>
		<p class="eyebrow">Feedback</p>
		<h2>Bug Reports</h2>
		<p class="intro">
			Review incoming bug reports, remove bad entries, or open a prefilled GitHub issue from each
			report.
		</p>
	</div>
</section>

<section class="summary-grid">
	<article class="summary-card">
		<p class="eyebrow">Total</p>
		<h3>{data.summary.total}</h3>
		<p>Reports currently stored in MongoDB.</p>
	</article>
	<article class="summary-card">
		<p class="eyebrow">With Attachment</p>
		<h3>{data.summary.withAttachment}</h3>
		<p>Reports that include an uploaded file.</p>
	</article>
</section>

{#if form?.error}
	<section class="output error">
		<h3>Bug Report Action Error</h3>
		<pre>{form.error}</pre>
	</section>
{/if}

{#if form?.message}
	<section class="output">
		<h3>{form.message}</h3>
	</section>
{/if}

<section class="report-list">
	{#if data.reports.length === 0}
		<article class="empty-state">
			<h3>No bug reports yet</h3>
			<p>New bug reports submitted from the client app will appear here.</p>
		</article>
	{:else}
		{#each data.reports as report}
			<article class="report-card">
				<div class="report-head">
					<div>
						<p class="eyebrow">Submitted {report.createdAt}</p>
						<h3>{report.title}</h3>
					</div>
					<div class="report-actions">
						<a class="issue-link" href={report.githubIssueUrl} target="_blank" rel="noreferrer">
							Create GitHub Issue
						</a>
						<form method="POST">
							<input type="hidden" name="intent" value="delete-report" />
							<input type="hidden" name="reportId" value={report.id} />
							<button type="submit" class="delete-button">Remove</button>
						</form>
					</div>
				</div>

				<div class="report-meta">
					<span><strong>ID:</strong> {report.id}</span>
					<span><strong>Email:</strong> {report.email || 'Not provided'}</span>
					<span><strong>Page:</strong> {report.pageUrl || 'Not provided'}</span>
				</div>

				<pre>{report.description}</pre>

				{#if report.attachment?.url}
					<div class="attachment">
						<p class="eyebrow">Attachment</p>
						<a href={report.attachment.url} target="_blank" rel="noreferrer">
							{report.attachment.name || 'Attachment'}
						</a>
						<p>
							{report.attachment.type || 'Unknown type'} • {formatBytes(report.attachment.size)}
						</p>
					</div>
				{/if}
			</article>
		{/each}
	{/if}
</section>

<style>
	.hero,
	.summary-grid,
	.output,
	.report-list {
		margin-top: 24px;
	}

	.hero,
	.summary-card,
	.output,
	.report-card,
	.empty-state {
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
	.report-card,
	.empty-state {
		padding: 22px;
	}

	.summary-grid,
	.report-list {
		display: grid;
		gap: 18px;
	}

	.summary-grid {
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
	.summary-card p,
	.report-meta,
	.attachment p {
		color: var(--admin-muted);
		line-height: 1.5;
	}

	.report-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 16px;
	}

	.report-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.issue-link,
	.delete-button {
		border-radius: 999px;
		padding: 11px 16px;
		font: inherit;
		font-weight: 700;
		text-decoration: none;
		border: 0;
		cursor: pointer;
	}

	.issue-link {
		background: linear-gradient(135deg, var(--admin-accent), var(--admin-accent-strong));
		color: #f2fbfd;
	}

	.delete-button {
		background: rgba(220, 50, 47, 0.2);
		color: var(--admin-danger-text);
		border: 1px solid rgba(220, 50, 47, 0.35);
	}

	.report-meta {
		display: grid;
		gap: 6px;
		margin-bottom: 16px;
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

	.attachment {
		margin-top: 16px;
	}

	.error pre {
		background: rgba(80, 18, 18, 0.84);
		color: var(--admin-danger-text);
	}

	@media (max-width: 720px) {
		.report-head {
			flex-direction: column;
		}

		.report-actions {
			justify-content: flex-start;
		}
	}
</style>
