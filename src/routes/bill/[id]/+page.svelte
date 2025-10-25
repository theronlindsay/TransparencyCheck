<script>
	let { data } = $props();
	const { bill, textVersions } = data;

	// Debug logging
	console.log('Bill detail page loaded');
	console.log('Bill ID:', bill.id);
	console.log('Text versions received:', textVersions);
	console.log('Text versions count:', textVersions?.length || 0);

	// Group text versions by type (e.g., "Introduced in House", "Engrossed in House")
	let versionsByType = $derived.by(() => {
		if (!textVersions || textVersions.length === 0) {
			console.log('No text versions to group');
			return {};
		}
		
		console.log('Grouping text versions...');
		const grouped = {};
		textVersions.forEach(version => {
			const type = version.type || 'Unknown';
			console.log(`Processing version: type=${type}, formatType=${version.formatType}, url=${version.url}`);
			
			if (!grouped[type]) {
				grouped[type] = {
					date: version.date,
					formats: []
				};
			}
			grouped[type].formats.push({
				formatType: version.formatType,
				url: version.url
			});
		});
		
		console.log('Grouped versions:', grouped);
		return grouped;
	});

	function formatDate(dateString) {
		if (!dateString) return 'N/A';
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
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
		if (format === 'HTML' || format === 'HTM') return '🌐';
		if (format === 'XML') return '📋';
		if (format === 'TXT') return '📝';
		return '📎';
	}
</script>

<div class="bill-detail-page">
	<div class="bill-header">
		<div class="header-top">
			<span class="bill-number">{bill.number}</span>
			{#if bill.statusTag}
				<span class="badge">{bill.statusTag}</span>
			{/if}
		</div>
		<h1 class="bill-title">{bill.title}</h1>
		
		<div class="bill-meta">
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
				href={`https://www.congress.gov/bill/${bill.number?.toLowerCase().replace(/(\d+)/, '$1')}`}
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

	<!-- Bill Text Versions Section -->
	{#if textVersions && textVersions.length > 0}
		<section class="section text-versions">
			<h2>Bill Text Versions</h2>
			<p class="section-description">Download different versions of this bill in various formats</p>
			
			<div class="versions-list">
				{#each Object.entries(versionsByType) as [type, versionData]}
					<div class="version-card">
						<div class="version-header">
							<h3>{formatVersionType(type)}</h3>
							{#if versionData.date}
								<span class="version-date">{formatDate(versionData.date)}</span>
							{/if}
						</div>
						
						<div class="format-buttons">
							{#each versionData.formats as format}
								<a
									href={format.url}
									class="format-button"
									target="_blank"
									rel="noopener noreferrer"
									download
								>
									<span class="format-icon">{getFormatIcon(format.formatType)}</span>
									<span class="format-type">{format.formatType?.toUpperCase() || 'Download'}</span>
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{:else}
		<section class="section text-versions-unavailable">
			<h2>Bill Text</h2>
			<p class="unavailable-message">Text versions are being loaded or not yet available for this bill.</p>
		</section>
	{/if}

	{#if bill.latestAction}
		<section class="section latest-action">
			<h2>Latest Action</h2>
			<p class="action-text">{bill.latestAction}</p>
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
</div>

<style>
	.bill-detail-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
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

	.versions-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.version-card {
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 1.5rem;
		transition: all 0.2s ease;
	}

	.version-card:hover {
		border-color: var(--accent);
		box-shadow: 0 4px 12px rgba(255, 91, 88, 0.1);
	}

	.version-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.version-header h3 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text-primary);
	}

	.version-date {
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-weight: 400;
	}

	.format-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.format-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1.2rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.format-button:hover {
		background: var(--accent);
		border-color: var(--accent);
		color: #ffffff;
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(255, 91, 88, 0.2);
	}

	.format-icon {
		font-size: 1.2rem;
		line-height: 1;
	}

	.format-type {
		font-weight: 600;
		letter-spacing: 0.05em;
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
	@media (max-width: 768px) {
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

		.version-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.format-buttons {
			width: 100%;
		}

		.format-button {
			flex: 1;
			justify-content: center;
			min-width: 100px;
		}
	}
</style>
