<script>
	let { url } = $props();
</script>

<div class="pdf-container">
	{#if url}
		<iframe
			src={url}
			title="PDF Viewer"
			class="pdf-iframe" ></iframe>
	{:else}
		<div class="no-pdf">No PDF URL provided</div>
	{/if}
</div>

<style>
	.pdf-container {
		width: 100%;
		height: 600px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--bg-secondary);
	}

	.pdf-iframe {
		width: 100%;
		height: 100%;
		border: none;
	}

	.no-pdf {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-secondary);
		font-size: 1rem;
	}

	@media (max-width: 768px) {
		.pdf-container {
			height: 400px;
		}
	}
</style>