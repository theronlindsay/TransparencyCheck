<script>
	import AISummarizer from '$lib/Components/AISummarizer.svelte';
	import { apiUrl, isTauri } from '$lib/config.js';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	
	let { data } = $props();
	
	// Reactive state for bill data (can be updated client-side in Tauri)
	let bill = $state(data.bill);
	let textVersions = $state(data.textVersions);
	let actions = $state(data.actions);
	let isLoading = $state(false);
	let loadError = $state(null);

	// Fetch bill data client-side when in Tauri
	async function fetchBillFromAPI(billId) {
		isLoading = true;
		loadError = null;
		try {
			const response = await fetch(apiUrl(`/api/bills/${billId}`));
			if (!response.ok) {
				throw new Error(`Failed to fetch bill: ${response.status}`);
			}
			const result = await response.json();
			bill = result.bill;
			textVersions = result.textVersions;
			actions = result.actions;
		} catch (err) {
			console.error('Error fetching bill:', err);
			loadError = err.message;
		} finally {
			isLoading = false;
		}
	}

	// On mount, fetch from API if in Tauri
	$effect(() => {
		if (browser && isTauri() && !bill) {
			const billId = $page.params.id;
			fetchBillFromAPI(billId);
		}
	});

	// State for active tab
	let activeVersionType = $state(null);
	let activeFormat = $state(null);
	let htmlContent = $state('');
	let isLoadingHtml = $state(false);
	let isDragging = $state(false);
	let mainContentWidth = $state(60); // Percentage width of main content

	// Handle divider drag
	function handleMouseDown() {
		isDragging = true;
	}

	function handleMouseUp() {
		isDragging = false;
	}

	function handleMouseMove(e) {
		if (!isDragging) return;

		const container = document.querySelector('.page-container');
		if (!container) return;

		const containerRect = container.getBoundingClientRect();
		const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

		// Constrain width between 40% and 85%
		if (newWidth >= 40 && newWidth <= 85) {
			mainContentWidth = newWidth;
		}
	}

	// Group text versions by type (e.g., "Introduced in House", "Engrossed in House")
	let versionsByType = $derived.by(() => {
		if (!textVersions || textVersions.length === 0) {
			return {};
		}
		
		const grouped = {};
		textVersions.forEach(version => {
			const type = version.type || 'Unknown';
			
			if (!grouped[type]) {
				grouped[type] = {
					date: version.date,
					formats: []
				};
			}
			grouped[type].formats.push({
				formatType: version.formatType,
				url: version.url,
				content: version.content,
				contentFetched: version.contentFetched
			});
		});
		
		// Sort formats to put PDF first
		Object.keys(grouped).forEach(type => {
			grouped[type].formats.sort((a, b) => {
				const aIsPdf = a.formatType?.toUpperCase() === 'PDF' ? 0 : 1;
				const bIsPdf = b.formatType?.toUpperCase() === 'PDF' ? 0 : 1;
				return aIsPdf - bIsPdf;
			});
		});
		
		return grouped;
	});

	// Set initial active version when data loads
	$effect(() => {
		if (!activeVersionType && Object.keys(versionsByType).length > 0) {
			const firstType = Object.keys(versionsByType)[0];
			activeVersionType = firstType;
			
			// Set first format as active (which is now PDF if available)
			if (versionsByType[firstType].formats.length > 0) {
				activeFormat = versionsByType[firstType].formats[0];
			}
		}
	});

	// Load HTML content when active format changes
	$effect(() => {
		if (!activeFormat) return;
		
		const formatType = activeFormat.formatType?.toUpperCase();
		if (formatType === 'FORMATTED TEXT' || formatType?.includes('HTM')) {
			isLoadingHtml = true;
			
			// Check if content is already stored in database
			if (activeFormat.contentFetched && activeFormat.content) {
				console.log('Using stored content from database');
				htmlContent = activeFormat.content;
				isLoadingHtml = false;
			} else {
				console.log('Fetching content via proxy');
				htmlContent = '';
				
				// Use our API proxy to fetch the content (avoids CORS issues)
				fetch(apiUrl(`/api/fetch-bill-text?url=${encodeURIComponent(activeFormat.url)}`))
					.then(response => response.json())
					.then(data => {
						if (data.error) {
							throw new Error(data.error);
						}
						htmlContent = data.content;
						isLoadingHtml = false;
					})
					.catch(err => {
						console.error('Error loading HTML:', err);
						htmlContent = '<p>Error loading bill text. You can <a href="' + activeFormat.url + '" target="_blank" rel="noopener noreferrer">view it directly on Congress.gov</a>.</p>';
						isLoadingHtml = false;
					});
			}
		} else if (formatType?.includes('XML')) {
			// For XML, fetch and display with formatting
			isLoadingHtml = true;
			htmlContent = '';
			
			fetch(apiUrl(`/api/fetch-bill-text?url=${encodeURIComponent(activeFormat.url)}`))
				.then(response => response.json())
				.then(data => {
					if (data.error) {
						throw new Error(data.error);
					}
					// Store XML content - will be displayed in pre tag
					htmlContent = data.content;
					isLoadingHtml = false;
				})
				.catch(err => {
					console.error('Error loading XML:', err);
					htmlContent = 'Error loading XML content. You can view it directly on Congress.gov.';
					isLoadingHtml = false;
				});
		} else {
			htmlContent = '';
			isLoadingHtml = false;
		}
	});

	function selectVersion(type, format) {
		activeVersionType = type;
		activeFormat = format;
	}

	function formatDate(dateString) {
		if (!dateString) return 'N/A';
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric',
			});
		} catch {
			return 'N/A';
		}
	}

	function formatVersionType(type) {
		// Convert type codes to readable names
		const typeMap = {
			'IH': 'Introduced in House',
			'IS': 'Introduced in Senate',
			'RH': 'Reported in House',
			'RS': 'Reported in Senate',
			'EH': 'Engrossed in House',
			'ES': 'Engrossed in Senate',
			'ENR': 'Enrolled',
			'RDS': 'Received in Senate',
			'RDH': 'Received in House'
		};
		return typeMap[type] || type;
	}

	function getFormatIcon(formatType) {
		const format = formatType?.toUpperCase();
		if (format === 'PDF') return '📄';
		if (format === 'FORMATTED TEXT' || format?.includes('HTM')) return '🌐';
		if (format?.includes('XML')) return '📋';
		if (format === 'TXT') return '📝';
		return '📎';
	}

	function getCongressUrl(billNumber, congress) {
		// Parse bill number like "H.R.3062", "S.1234", "HR3062", "S2392"
		const match = billNumber?.match(/^([A-Z]+)\.?(\d+)$/i);
		if (!match || !congress) {
			console.warn(`Failed to parse bill number: ${billNumber}`);
			return '';
		}
		
		const billType = match[1].toLowerCase(); // "hr" or "s"
		const billNum = match[2];
		
		// Format congress number as "119th-congress"
		const congressFormatted = `${congress}th-congress`;
		
		// Map bill type codes to Congress.gov format
		const typeMap = {
			'hr': 'house-bill',
			'hres': 'house-resolution',
			'hjres': 'house-joint-resolution',
			'hconres': 'house-concurrent-resolution',
			's': 'senate-bill',
			'sres': 'senate-resolution',
			'sjres': 'senate-joint-resolution',
			'sconres': 'senate-concurrent-resolution'
		};
		
		const billTypeFormatted = typeMap[billType] || `${billType}-bill`;
		const url = `https://www.congress.gov/bill/${congressFormatted}/${billTypeFormatted}/${billNum}`;
		console.log(`Generated Congress URL: ${url}`);
		return url;
	}
</script>

{#if isLoading}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<p>Loading bill details...</p>
	</div>
{:else if error}
	<div class="error-container">
		<p class="error-message">{error}</p>
		<button onclick={() => window.location.reload()}>Retry</button>
	</div>
{:else if !bill}
	<div class="error-container">
		<p class="error-message">Bill not found</p>
	</div>
{:else}
<div class="page-container" style="--main-width: {mainContentWidth}%"
	role="presentation"
	onmousemove={handleMouseMove}
	onmouseup={handleMouseUp}
	onmouseleave={handleMouseUp}
>
	<!-- Main Content -->
	<div class="main-content">
		<div class="bill-detail-page">
	<div class="bill-header">
		<div class="header-top">
			<span class="bill-number">{bill.number}</span>
		</div>
		<h1 class="bill-title">{bill.title}</h1>
		
		<div class="bill-meta">
			<div class="meta-item">
				<span class="meta-label">Status</span>
				<span class="badge" style="width: min-content;">{bill.statusTag || "Unknown"}</span>
			</div>
			<div class="meta-item">
				<span class="meta-label">Sponsor</span>
				<span class="meta-value">{bill.sponsor || 'Unknown'}</span>
			</div>
			<div class="meta-item">
				<span class="meta-label">Committee</span>
				<span class="meta-value">{bill.committee || 'Unassigned'}</span>
			</div>
			<div class="meta-item">
				<span class="meta-label">Last Updated</span>
				<span class="meta-value">{formatDate(bill.updatedAt)}</span>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="action-buttons">
			<a
				href={getCongressUrl(bill.number, bill.congress)}
				class="button primary"
				target="_blank"
				rel="noopener noreferrer"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M14 9V14H2V9H0V14C0 15.1 0.9 16 2 16H14C15.1 16 16 15.1 16 14V9H14Z" fill="currentColor"/>
					<path d="M13 5L11.59 6.41L9 3.83V12H7V3.83L4.41 6.41L3 5L8 0L13 5Z" fill="currentColor"/>
				</svg>
				View on Congress.gov
			</a>
		</div>
	</div>


	{#if bill.latestAction}
		<section class="section latest-action">
			<h2>Latest Action</h2>
			<p class="action-text">{bill.latestAction}</p>
		</section>
	{/if}

	{#if actions && actions.length > 0}
		<section class="section">
			<h2>Legislative Actions</h2>
			<p class="section-description">Complete timeline of all actions taken on this bill</p>
			<div class="timeline">
				{#each actions as action}
					<div class="timeline-item">
						{#if action.actionDate}
							<span class="timeline-date">{formatDate(action.actionDate)}</span>
						{/if}
						<p class="timeline-text">{action.text || 'Action recorded'}</p>
						{#if action.type}
							<span class="action-type-badge">{action.type}</span>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if bill.summary}
		<section class="section">
			<h2>Summary</h2>
			<p class="summary-text">{bill.summary}</p>
		</section>
	{/if}

	{#if bill.summaryLong && bill.summaryLong !== bill.summary}
		<section class="section">
			<h2>Detailed Summary</h2>
			<p class="summary-text">{bill.summaryLong}</p>
		</section>
	{/if}

	{#if bill.votes && bill.votes.length > 0}
		<section class="section">
			<h2>Votes</h2>
			<div class="votes-grid">
				{#each bill.votes as vote}
					<div class="card">
						<h3>{vote.title || 'Vote Record'}</h3>
						{#if vote.date}
							<p class="vote-date">{formatDate(vote.date)}</p>
						{/if}
						{#if vote.result}
							<p class="vote-result"><strong>Result:</strong> {vote.result}</p>
						{/if}
						{#if vote.yeas !== undefined && vote.nays !== undefined}
							<div class="vote-counts">
								<span class="yeas">Yeas: {vote.yeas}</span>
								<span class="nays">Nays: {vote.nays}</span>
								{#if vote.present !== undefined}
									<span class="present">Present: {vote.present}</span>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if bill.schedule && bill.schedule.length > 0}
		<section class="section">
			<h2>Schedule</h2>
			<div class="timeline">
				{#each bill.schedule as item}
					<div class="timeline-item">
						{#if item.date}
							<span class="timeline-date">{formatDate(item.date)}</span>
						{/if}
						<p class="timeline-text">{item.description || item.text || 'Scheduled event'}</p>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if bill.news && bill.news.length > 0}
		<section class="section">
			<h2>Related News</h2>
			<div class="news-grid">
				{#each bill.news as article}
					<div class="card news-card">
						{#if article.title}
							<h3>{article.title}</h3>
						{/if}
						{#if article.source}
							<p class="news-source">{article.source}</p>
						{/if}
						{#if article.date}
							<p class="news-date">{formatDate(article.date)}</p>
						{/if}
						{#if article.url}
							<a href={article.url} target="_blank" rel="noopener noreferrer" class="news-link">
								Read Article →
							</a>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}


	<!-- Bill Text Versions Section -->
	{#if textVersions && textVersions.length > 0}
		<section class="section text-versions">
			<h2>Bill Text Versions</h2>
			<p class="section-description">View different versions of this bill text</p>
			
			<!-- Version Tabs -->
			<div class="version-tabs">
				{#each Object.entries(versionsByType) as [type, versionData]}
					<div class="version-tab-group">
						<div class="version-type-header">
							<h3>{formatVersionType(type)}</h3>
							{#if versionData.date}
								<span class="version-date">{formatDate(versionData.date)}</span>
							{/if}
						</div>
						
						<div class="format-tabs">
							{#each versionData.formats as format}
								<button
									class="format-tab"
									class:active={activeVersionType === type && activeFormat === format}
									onclick={() => selectVersion(type, format)}
								>
									<span class="format-icon">{getFormatIcon(format.formatType)}</span>
									<span class="format-label">{format.formatType}</span>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<!-- Preview Area -->
			{#if activeFormat}
				<div class="preview-area">
					<div class="preview-header">
						<h3>Preview: {formatVersionType(activeVersionType)} - {activeFormat.formatType}</h3>
						<a
							href={activeFormat.url}
							class="download-link"
							target="_blank"
							rel="noopener noreferrer"
							download
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M14 9V14H2V9H0V14C0 15.1 0.9 16 2 16H14C15.1 16 16 15.1 16 14V9H14Z" fill="currentColor"/>
								<path d="M7 3V9.17L4.41 6.58L3 8L8 13L13 8L11.59 6.58L9 9.17V3H7Z" fill="currentColor"/>
							</svg>
							Download from Congress.gov
						</a>
					</div>

					{#if isLoadingHtml}
						<div class="loading-preview">
							<div class="spinner"></div>
							<p>Loading bill text...</p>
						</div>
					{:else if htmlContent}
						<!-- Render HTML directly -->
						<div class="html-content">
							{@html htmlContent}
						</div>
					{:else if activeFormat.formatType?.toUpperCase() === 'PDF'}
						<!-- Embed PDF directly from local server -->
						<iframe
							src={apiUrl(`/api/pdf?url=${encodeURIComponent(activeFormat.url)}`)}
							class="preview-iframe"
							title="PDF Preview"
						></iframe>
					{:else if activeFormat.formatType?.toUpperCase().includes('XML')}
						<!-- Display XML with syntax highlighting -->
						{#if isLoadingHtml}
							<div class="loading-preview">
								<div class="spinner"></div>
								<p>Loading XML content...</p>
							</div>
						{:else if htmlContent}
							<div class="xml-content">
								<pre><code>{htmlContent}</code></pre>
							</div>
						{:else}
							<div class="download-message">
								<div class="format-icon-large">📋</div>
								<h4>XML Format</h4>
								<p>Unable to load XML content.</p>
								<a
									href={activeFormat.url}
									class="download-button"
									target="_blank"
									rel="noopener noreferrer"
									download
								>
									<svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M14 9V14H2V9H0V14C0 15.1 0.9 16 2 16H14C15.1 16 16 15.1 16 14V9H14Z" fill="currentColor"/>
										<path d="M7 3V9.17L4.41 6.58L3 8L8 13L13 8L11.59 6.58L9 9.17V3H7Z" fill="currentColor"/>
									</svg>
									Download XML
								</a>
							</div>
						{/if}
					{:else}
						<!-- For other formats, show download message -->
						<div class="download-message">
							<div class="format-icon-large">{getFormatIcon(activeFormat.formatType)}</div>
							<h4>{activeFormat.formatType} Format</h4>
							<p>This format cannot be previewed in the browser.</p>
							<a
								href={activeFormat.url}
								class="download-button"
								target="_blank"
								rel="noopener noreferrer"
								download
							>
								<svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M14 9V14H2V9H0V14C0 15.1 0.9 16 2 16H14C15.1 16 16 15.1 16 14V9H14Z" fill="currentColor"/>
									<path d="M7 3V9.17L4.41 6.58L3 8L8 13L13 8L11.59 6.58L9 9.17V3H7Z" fill="currentColor"/>
								</svg>
								Download and View
							</a>
						</div>
					{/if}
				</div>
			{/if}
		</section>
	{:else}
		<section class="section text-versions-unavailable">
			<h2>Bill Text</h2>
			<p class="unavailable-message">Text versions are being loaded or not yet available for this bill.</p>
		</section>
	{/if}
	</div>
</div>

	<!-- Resizable Divider -->
	<button
		class="divider"
		class:active={isDragging}
		onmousedown={handleMouseDown}
		aria-label="Resize divider between content and sidebar"
		title="Drag to resize panels"
		tabindex="-1"
	></button>

	<!-- AI Summarizer Sidebar -->
	<aside class="sidebar">
		<AISummarizer 
			billNumber={bill.number} 
			billTitle={bill.title}
			billText={htmlContent}
		/>
	</aside>
</div>
{/if}

<style>
	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 50vh;
		gap: 1rem;
		color: var(--text-secondary);
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-message {
		color: var(--accent);
		font-size: 1.1rem;
	}

	.error-container button {
		padding: 0.5rem 1rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.page-container {
		display: grid;
		grid-template-columns: calc(var(--main-width, 60%) - 0.5rem) 1rem calc(100% - var(--main-width, 60%) - 1.5rem);
		gap: 0;
		max-width: 1600px;
		margin: 0 auto;
		height: calc(100vh - 4rem); /* Full viewport height minus padding */
		overflow: hidden; /* Prevent container from scrolling */
	}

	.main-content {
		min-width: 0; /* Prevents grid overflow */
		overflow-y: auto; /* Enable vertical scrolling */
		overflow-x: hidden;
		padding-right: 1rem; /* Space for scrollbar */
		padding: 2em;
	}

	.sidebar {
		min-width: 0; /* Prevents grid overflow */
		overflow-y: auto; /* Enable vertical scrolling */
		overflow-x: hidden;
		padding-right: 0.5rem; /* Space for scrollbar */
		padding: 0.5em;
	}

	.divider {
		cursor: col-resize;
		background: linear-gradient(90deg, transparent 0%, rgba(241, 58, 55, 0.05) 50%, transparent 100%);
		padding: 0 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		user-select: none;
		border: 1px solid rgba(241, 58, 55, 0.1);
		position: relative;
	}

	.divider::before {
		content: ' ⋮⋮';
		font-size: 1.2rem;
		color: rgba(241, 58, 55, 0.3);
		letter-spacing: 0.2rem;
		transition: all 0.2s ease;
		font-weight: 600;
	}

	.divider::after {
		content: '';
		position: absolute;
		width: 100%;
		height: 60px;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.divider:hover {
		/* background: linear-gradient(90deg, transparent 0%, rgba(241, 58, 55, 0.25) 50%, transparent 100%); */
		border-color: rgba(241, 58, 55, 0.25);
	}

	.divider:hover::before {
		color: var(--accent);
		text-shadow: 0 0 8px rgba(241, 58, 55, 0.3);
	}

	.divider.active {
		/* background: linear-gradient(90deg, transparent 0%, rgba(241, 58, 55, 0.2) 50%, transparent 100%); */
		border-color: rgba(241, 58, 55, 0.4);
	}

	.divider.active::before {
		color: var(--accent);
		text-shadow: 0 0 12px rgba(241, 58, 55, 0.5);
	}

	/* Scrollbar styling for main content */
	.main-content::-webkit-scrollbar,
	.sidebar::-webkit-scrollbar {
		width: 8px;
	}

	.main-content::-webkit-scrollbar-track,
	.sidebar::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 4px;
	}

	.main-content::-webkit-scrollbar-thumb,
	.sidebar::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 4px;
	}

	.main-content::-webkit-scrollbar-thumb:hover,
	.sidebar::-webkit-scrollbar-thumb:hover {
		background: var(--accent);
	}

	.bill-detail-page {
		max-width: 100%;
		margin: 0;
		padding: 0;
	}

	.bill-header {
		margin-bottom: 3rem;
	}

	.header-top {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.bill-number {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--accent);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.bill-title {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 1.5rem 0;
		line-height: 1.3;
	}

	.bill-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
		padding: 1.5rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-color);
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.meta-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.meta-value {
		font-size: 1rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.status-value {
		color: var(--accent);
		font-weight: 600;
		text-transform: capitalize;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
		flex-wrap: wrap;
	}

	.button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition: all var(--transition-base);
		border: none;
	}

	.button.primary {
		background: var(--accent);
		color: white;
		border: 1px solid var(--accent);
	}

	.button.primary:hover {
		background: #ff5b58;
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(241, 58, 55, 0.4);
	}

	.button.secondary {
		background: rgba(241, 58, 55, 0.1);
		color: var(--text-primary);
		border: 1px solid rgba(241, 58, 55, 0.3);
	}

	.button.secondary:hover {
		background: rgba(241, 58, 55, 0.2);
		border-color: rgba(241, 58, 55, 0.5);
		transform: translateY(-2px);
	}

	.section {
		margin-bottom: 3rem;
	}

	.section h2 {
		font-size: 1.8rem;
		color: var(--text-primary);
		margin-bottom: 1.5rem;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid var(--border-color);
	}

	.latest-action {
		padding: 2rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-color);
		border-left: 4px solid var(--accent);
	}

	.latest-action h2 {
		border: none;
		padding-bottom: 0;
		margin-bottom: 1rem;
	}

	.action-text {
		font-size: 1.1rem;
		color: var(--text-primary);
		line-height: 1.7;
		margin: 0;
	}

	.summary-text {
		font-size: 1.05rem;
		color: var(--text-secondary);
		line-height: 1.8;
		margin: 0;
	}

	.votes-grid,
	.news-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.card {
		padding: 1.5rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-color);
	}

	.card h3 {
		font-size: 1.2rem;
		color: var(--text-primary);
		margin: 0 0 1rem 0;
	}

	.vote-date,
	.news-date,
	.news-source {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin: 0.5rem 0;
	}

	.vote-result {
		margin: 0.75rem 0;
		color: var(--text-primary);
	}

	.vote-counts {
		display: flex;
		gap: 1.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
	}

	.vote-counts span {
		font-size: 0.95rem;
		font-weight: 600;
	}

	.yeas {
		color: #4ade80;
	}

	.nays {
		color: #f87171;
	}

	.present {
		color: var(--text-secondary);
	}

	.timeline {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.timeline-item {
		padding-left: 2rem;
		border-left: 2px solid var(--border-color);
		position: relative;
	}

	.timeline-item::before {
		content: '';
		position: absolute;
		left: -6px;
		top: 0;
		width: 10px;
		height: 10px;
		background: var(--accent);
		border-radius: 50%;
	}

	.timeline-date {
		display: block;
		font-size: 0.85rem;
		color: var(--accent);
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.timeline-text {
		color: var(--text-primary);
		line-height: 1.6;
		margin: 0;
	}

	.action-type-badge {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.25rem 0.75rem;
		background: rgba(241, 58, 55, 0.1);
		border: 1px solid rgba(241, 58, 55, 0.3);
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--accent);
		text-transform: capitalize;
	}

	.news-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
		margin-top: 1rem;
		transition: all var(--transition-base);
	}

	.news-link:hover {
		color: #ff5b58;
		transform: translateX(4px);
	}

	/* Full Text Section */
	.full-text {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 2rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid var(--border-color);
	}

	.section-header h2 {
		margin: 0;
		padding: 0;
		border: none;
	}

	.source-link {
		font-size: 0.9rem;
		color: var(--accent);
		text-decoration: none;
		font-weight: 600;
		transition: all var(--transition-base);
	}

	.source-link:hover {
		color: #ff5b58;
	}

	.format-info {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin: 0 0 1.5rem 0;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.bill-text-content {
		background: rgba(0, 0, 0, 0.2);
		border-radius: var(--radius-md);
		padding: 2rem;
		margin: 1.5rem 0;
		max-height: 800px;
		overflow-y: auto;
		border: 1px solid var(--border-color);
	}

	.bill-text-content :global(p) {
		color: var(--text-primary);
		line-height: 1.8;
		margin: 1rem 0;
		font-size: 1rem;
	}

	.bill-text-content :global(pre) {
		background: rgba(0, 0, 0, 0.3);
		padding: 1.5rem;
		border-radius: var(--radius-sm);
		overflow-x: auto;
		white-space: pre-wrap;
		word-wrap: break-word;
		color: var(--text-primary);
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.9rem;
		line-height: 1.6;
		border: 1px solid var(--border-color);
	}

	.bill-text-content :global(h1),
	.bill-text-content :global(h2),
	.bill-text-content :global(h3),
	.bill-text-content :global(h4),
	.bill-text-content :global(h5),
	.bill-text-content :global(h6) {
		color: var(--text-primary);
		margin-top: 2rem;
		margin-bottom: 1rem;
	}

	.fetched-info {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin: 1rem 0 0 0;
		text-align: right;
		font-style: italic;
	}

	.full-text-unavailable {
		padding: 2rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-color);
		text-align: center;
	}

	.unavailable-reason {
		color: var(--text-secondary);
		margin: 1rem 0 1.5rem 0;
		font-size: 1.05rem;
	}

	/* Text Versions Styles */
	.text-versions {
		padding: 2rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-color);
	}

	.text-versions h2 {
		margin: 0 0 0.5rem 0;
	}

	.section-description {
		color: var(--text-secondary);
		margin: 0 0 2rem 0;
		font-size: 0.95rem;
	}

	.version-tabs {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.version-tab-group {
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 1.25rem;
	}

	.version-type-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.version-type-header h3 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.version-date {
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-weight: 400;
	}

	.format-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.format-tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1.2rem;
		background: var(--bg-tertiary);
		border: 2px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.format-tab:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(255, 91, 88, 0.2);
	}

	.format-tab.active {
		background: var(--accent);
		border-color: var(--accent);
		color: #ffffff;
		box-shadow: 0 4px 12px rgba(255, 91, 88, 0.3);
	}

	.format-icon {
		font-size: 1.2rem;
		line-height: 1;
	}

	.format-label {
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.preview-area {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 1px solid var(--border-color);
		flex-wrap: wrap;
		gap: 1rem;
	}

	.preview-header h3 {
		margin: 0;
		font-size: 1rem;
		color: var(--text-primary);
	}

	.download-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--accent);
		border-radius: var(--radius-sm);
		color: #ffffff;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 600;
		transition: all 0.2s ease;
	}

	.download-link:hover {
		background: #ff4845;
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(255, 91, 88, 0.3);
	}

	.preview-iframe {
		width: 100%;
		height: 800px;
		border: none;
		background: white;
	}

	.html-content {
		padding: 2rem;
		background: white;
		color: #000;
		max-height: 800px;
		overflow-y: auto;
	}

	.html-content :global(p) {
		line-height: 1.8;
		margin: 1rem 0;
	}

	.html-content :global(h1),
	.html-content :global(h2),
	.html-content :global(h3) {
		margin-top: 2rem;
		margin-bottom: 1rem;
		color: #000;
	}

	.html-content :global(pre) {
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.xml-content {
		padding: 2rem;
		background: rgba(0, 0, 0, 0.2);
		max-height: 800px;
		overflow: auto;
	}

	.xml-content pre {
		margin: 0;
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--text-primary);
		white-space: pre-wrap;
		word-wrap: break-word;
		background: rgba(0, 0, 0, 0.3);
		padding: 1.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		overflow-x: auto;
	}

	.xml-content code {
		font-family: 'Courier New', Courier, monospace;
		color: inherit;
	}

	.loading-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		gap: 1rem;
	}

	.loading-preview p {
		color: var(--text-secondary);
		font-size: 1rem;
	}

	.download-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		gap: 1.5rem;
		text-align: center;
	}

	.format-icon-large {
		font-size: 4rem;
		line-height: 1;
		opacity: 0.8;
	}

	.download-message h4 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--text-primary);
	}

	.download-message p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 1rem;
		max-width: 500px;
	}

	.download-button {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 2rem;
		background: var(--accent);
		border-radius: var(--radius-md);
		color: #ffffff;
		text-decoration: none;
		font-size: 1.1rem;
		font-weight: 600;
		transition: all 0.2s ease;
		margin-top: 1rem;
	}

	.download-button:hover {
		background: #ff4845;
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(255, 91, 88, 0.4);
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid var(--border-color);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.text-versions-unavailable {
		padding: 2rem;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-color);
		text-align: center;
	}

	.unavailable-message {
		color: var(--text-secondary);
		margin: 0.5rem 0 0 0;
		font-size: 0.95rem;
	}

	/* Responsive Design */
	@media (max-width: 1024px) {
		.page-container {
			grid-template-columns: 1fr;
			gap: 2rem;
			height: auto; /* Remove fixed height on mobile */
			overflow: visible; /* Allow normal page scrolling */
		}

		.main-content,
		.sidebar {
			overflow-y: visible; /* Disable independent scrolling on mobile */
			overflow-x: visible;
			padding-right: 0; /* Remove scrollbar spacing */
			height: auto;
		}

		.sidebar {
			order: -1; /* Move sidebar to top on mobile */
		}
	}

	@media (max-width: 768px) {
		.page-container {
			padding: 1.5rem;
		}
		.bill-detail-page {
			padding: 1.5rem;
		}

		.bill-title {
			font-size: 1.8rem;
		}

		.bill-meta {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.section h2 {
			font-size: 1.5rem;
		}

		.votes-grid,
		.news-grid {
			grid-template-columns: 1fr;
		}

		.version-type-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.format-tabs {
			width: 100%;
		}

		.format-tab {
			flex: 1;
			justify-content: center;
			min-width: 100px;
		}

		.preview-iframe {
			height: 600px;
		}

		.html-content {
			padding: 1rem;
			max-height: 600px;
		}

		.preview-header {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
