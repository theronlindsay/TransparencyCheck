<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import * as pdfjsLib from 'pdfjs-dist';
	// Import worker as a URL to ensure it works in production builds
	import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

	let { url } = $props();
	let canvas = $state(null);
	let pageNum = $state(1);
	let pageRendering = $state(false);
	let pageNumPending = $state(null);
	let scale = $state(1.5);
	let pdfDoc = $state(null);
	let totalPages = $state(0);
	let error = $state(null);
	let loading = $state(true);
	let initialRenderDone = $state(false);

	// Set worker source
	onMount(() => {
		pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
	});

	$effect(() => {
		if (url) {
			initialRenderDone = false;
			loadPdf(url);
		}
	});

	// Render first page when both canvas and pdfDoc are ready
	$effect(() => {
		if (canvas && pdfDoc && !initialRenderDone && !loading) {
			initialRenderDone = true;
			renderPage(pageNum);
		}
	});

	async function loadPdf(pdfUrl) {
		try {
			loading = true;
			error = null;
			
			// Loading document
			const loadingTask = pdfjsLib.getDocument(pdfUrl);
			pdfDoc = await loadingTask.promise;
			totalPages = pdfDoc.numPages;
			
			// Let the effect handle initial render when canvas is ready
			loading = false;
		} catch (err) {
			console.error('Error loading PDF:', err);
			error = err.message;
			loading = false;
		}
	}

	async function renderPage(num) {
		pageRendering = true;
		
		try {
			const page = await pdfDoc.getPage(num);
			const viewport = page.getViewport({ scale });
			const context = canvas.getContext('2d');
			
			canvas.height = viewport.height;
			canvas.width = viewport.width;

			const renderContext = {
				canvasContext: context,
				viewport: viewport
			};
			
			const renderTask = page.render(renderContext);

			// Wait for render to finish
			await renderTask.promise;
			pageRendering = false;

			if (pageNumPending !== null) {
				renderPage(pageNumPending);
				pageNumPending = null;
			}
		} catch (err) {
			console.error('Error rendering page:', err);
			pageRendering = false;
		}
	}

	function queueRenderPage(num) {
		if (pageRendering) {
			pageNumPending = num;
		} else {
			renderPage(num);
		}
	}

	function onPrevPage() {
		if (pageNum <= 1) return;
		pageNum--;
		queueRenderPage(pageNum);
	}

	function onNextPage() {
		if (pageNum >= totalPages) return;
		pageNum++;
		queueRenderPage(pageNum);
	}

	function onZoomIn() {
		scale += 0.25;
		queueRenderPage(pageNum);
	}

	function onZoomOut() {
		if (scale <= 0.5) return;
		scale -= 0.25;
		queueRenderPage(pageNum);
	}
</script>

<div class="pdf-container">
	{#if error}
		<div class="error">
			<p>Error loading PDF: {error}</p>
		</div>
	{:else}
		<div class="controls">
			<div class="pagination">
				<button class="btn" onclick={onPrevPage} disabled={pageNum <= 1} aria-label="Previous page">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="15 18 9 12 15 6"></polyline>
					</svg>
				</button>
				<span>Page {pageNum} of {totalPages}</span>
				<button class="btn" onclick={onNextPage} disabled={pageNum >= totalPages} aria-label="Next page">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				</button>
			</div>
			
			<div class="zoom">
				<button class="btn" onclick={onZoomOut} title="Zoom Out">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
						<line x1="8" y1="11" x2="14" y2="11"></line>
					</svg>
				</button>
				<button class="btn" onclick={onZoomIn} title="Zoom In">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
						<line x1="11" y1="8" x2="11" y2="14"></line>
						<line x1="8" y1="11" x2="14" y2="11"></line>
					</svg>
				</button>
			</div>
		</div>

		<div class="canvas-wrapper">
			{#if loading}
				<div class="loading">Loading PDF...</div>
			{/if}
			<canvas bind:this={canvas} style:display={loading ? 'none' : 'block'}></canvas>
		</div>
	{/if}
</div>

<style>
	.pdf-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		overflow: hidden;
		width: 100%;
	}

	.controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 0.75rem;
		background: rgba(0, 0, 0, 0.2);
		border-bottom: 1px solid var(--border-color);
		flex-wrap: wrap;
		gap: 1rem;
	}

	.pagination, .zoom {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pagination span {
		font-size: 0.9rem;
		color: var(--text-primary);
		min-width: 100px;
		text-align: center;
	}

	.btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn:hover:not(:disabled) {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.canvas-wrapper {
		position: relative;
		width: 100%;
		overflow: auto;
		display: flex;
		justify-content: center;
		padding: 1rem;
		background: #525659; /* Standard PDF viewer background color */
		min-height: 400px;
	}

	canvas {
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
		max-width: 100%;
	}

	.loading, .error {
		padding: 2rem;
		color: var(--text-primary);
		text-align: center;
	}

	.error {
		color: #ff5b58;
	}

	@media (max-width: 600px) {
		.controls {
			justify-content: center;
		}
	}
</style>