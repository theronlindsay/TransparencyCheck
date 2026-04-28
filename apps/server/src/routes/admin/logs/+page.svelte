<script>
	import { tick } from 'svelte';

	export let data;
	export let form;

	const active = form?.lines ? form : data;
	let logViewer;

	async function scrollLogsToBottom() {
		await tick();
		if (logViewer) {
			logViewer.scrollTop = logViewer.scrollHeight;
		}
	}

	$: active.lines, scrollLogsToBottom();
</script>

<svelte:head>
	<title>Admin Logs</title>
</svelte:head>

<section class="hero">
	<div>
		<p class="eyebrow">Observability</p>
		<h2>Server Logs</h2>
		<p class="intro">
			Review the latest structured server log lines captured by the admin logging pipeline.
		</p>
	</div>

	<form method="POST" class="controls">
		<label>
			<span>Lines</span>
			<input type="number" name="limit" min="50" max="5000" value={active.limit} />
		</label>
		<button type="submit">Refresh</button>
	</form>
</section>

<section class="summary-grid">
	<article class="summary-card">
		<p class="eyebrow">File</p>
		<h3>Server Log Path</h3>
		<p class="path">{active.filePath}</p>
	</article>
	<article class="summary-card">
		<p class="eyebrow">Loaded</p>
		<h3>{active.lineCount}</h3>
		<p>Recent log lines currently shown in the viewer.</p>
	</article>
</section>

{#if form?.error}
	<section class="output error">
		<h3>Log Read Error</h3>
		<pre>{form.error}</pre>
	</section>
{/if}

{#if form?.message}
	<section class="output">
		<h3>{form.message}</h3>
	</section>
{/if}

<section class="output">
	<div class="section-head">
		<div>
			<p class="eyebrow">Live View</p>
			<h3>Recent Server Logs</h3>
		</div>
		<p class="meta">Showing the last {active.lineCount} lines</p>
	</div>

	<pre bind:this={logViewer}>{active.lines.join('\n')}</pre>
</section>

<style>
	.hero,
	.summary-grid,
	.output {
		margin-top: 24px;
	}

	.hero,
	.summary-card,
	.output {
		border-radius: 24px;
		border: 1px solid var(--admin-border);
		background: var(--admin-surface);
		box-shadow:
			0 18px 56px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.hero,
	.summary-card,
	.output {
		padding: 22px;
	}

	.hero {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
	}

	.controls {
		display: flex;
		gap: 12px;
		align-items: flex-end;
		flex-wrap: wrap;
	}

	.controls label {
		display: grid;
		gap: 6px;
	}

	.controls span,
	.eyebrow {
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: var(--admin-muted);
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 18px;
	}

	h2,
	h3,
	p {
		margin-top: 0;
	}

	.intro,
	.meta,
	.summary-card p,
	.path {
		color: var(--admin-muted);
		line-height: 1.5;
	}

	.path {
		word-break: break-word;
	}

	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 18px;
	}

	input,
	button {
		border-radius: 999px;
		font: inherit;
	}

	input {
		width: 120px;
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

	pre {
		margin: 0;
		padding: 18px;
		overflow: auto;
		border-radius: 18px;
		background: var(--admin-code-bg);
		color: var(--admin-code-text);
		font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
		font-size: 0.9rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 70vh;
	}

	.error pre {
		background: rgba(80, 18, 18, 0.84);
		color: var(--admin-danger-text);
	}

	@media (max-width: 720px) {
		.hero,
		.section-head {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
