<script>
	export let data;
	export let form;

	function percentage(count, total) {
		if (!total) return '0.0';
		return ((count / total) * 100).toFixed(1);
	}
</script>

<svelte:head>
	<title>Admin Cron</title>
</svelte:head>

<section class="hero">
	<div>
		<p class="eyebrow">Operations</p>
		<h2>Cron Controls</h2>
		<p class="intro">
			Run the existing server cron jobs on demand and inspect their complete output without leaving
			the server app.
		</p>
	</div>

	<form method="POST" class="run-all">
		<input type="hidden" name="intent" value="run-all" />
		<button type="submit">Run All Cron Jobs</button>
	</form>
</section>

<section class="grid">
	{#each data.jobs as job}
		<article class="card">
			<div>
				<h3>{job.label}</h3>
				<p>{job.description}</p>
			</div>

			<form method="POST">
				<input type="hidden" name="intent" value="run-job" />
				<input type="hidden" name="jobId" value={job.id} />
				<button type="submit">Run {job.label}</button>
			</form>
		</article>
	{/each}
</section>

<section class="metrics">
	<article class="panel">
		<div class="section-head">
			<div>
				<p class="eyebrow">Representatives</p>
				<h3>{data.completeness.representatives.total} records</h3>
			</div>
			<p class="meta">Finance profiles: {data.completeness.financeProfiles.total}</p>
		</div>

		<div class="metric-list">
			{#each data.completeness.representatives.checks as check}
				<div class="metric-row">
					<span>{check.label}</span>
					<strong>{check.count}</strong>
					<small>{percentage(check.count, data.completeness.representatives.total)}%</small>
				</div>
			{/each}
		</div>
	</article>

	<article class="panel">
		<div class="section-head">
			<div>
				<p class="eyebrow">Bills</p>
				<h3>{data.completeness.bills.total} records</h3>
			</div>
			<p class="meta">Missing-field report</p>
		</div>

		<div class="metric-list">
			{#each data.completeness.bills.checks as check}
				<div class="metric-row">
					<span>{check.label}</span>
					<strong>{check.count}</strong>
					<small>{percentage(check.count, data.completeness.bills.total)}%</small>
				</div>
			{/each}
		</div>
	</article>
</section>

{#if form?.error}
	<section class="output error">
		<h3>Cron Error</h3>
		<pre>{form.error}</pre>
	</section>
{/if}

{#if form?.ranAt}
	<section class="output">
		<div class="section-head">
			<div>
				<p class="eyebrow">Run Output</p>
				<h3>{form.intent === 'run-all' ? 'All cron jobs' : form.jobLabel}</h3>
			</div>
			<p class="meta">{form.ranAt}</p>
		</div>

		<pre>{JSON.stringify(form.intent === 'run-all' ? form.results : form.result, null, 2)}</pre>

		<h4>Captured logs</h4>
		<pre>{(form.logs || []).join('\n')}</pre>
	</section>
{/if}

<style>
	.hero,
	.grid,
	.metrics,
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

	.hero {
		padding: 24px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
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

	h2 {
		margin-bottom: 10px;
		font-size: clamp(1.4rem, 2.5vw, 2.2rem);
	}

	.intro,
	.card p,
	.meta {
		color: var(--admin-muted);
		line-height: 1.5;
	}

	.run-all button,
	form button {
		border: 0;
		border-radius: 999px;
		padding: 12px 18px;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		background: linear-gradient(135deg, var(--admin-accent), var(--admin-accent-strong));
		color: #f2fbfd;
	}

	.grid,
	.metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 18px;
	}

	.card,
	.panel,
	.output {
		padding: 22px;
	}

	.card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 18px;
		min-height: 200px;
	}

	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 18px;
	}

	.metric-list {
		display: grid;
		gap: 10px;
	}

	.metric-row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 14px;
		align-items: baseline;
		padding: 12px 14px;
		border-radius: 16px;
		background: var(--admin-surface-soft);
	}

	.metric-row small {
		color: var(--admin-muted);
	}

	.output pre {
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
		.hero {
			flex-direction: column;
			align-items: flex-start;
		}

		.section-head {
			flex-direction: column;
		}

		.metric-row {
			grid-template-columns: 1fr auto;
		}

		.metric-row small {
			grid-column: 1 / -1;
		}
	}
</style>
