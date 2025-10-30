<script>
	import { goto } from '$app/navigation';

	// Props for bill data
	let {
		id = '',
		number = '',
		title = '',
		sponsors = [],
		committee = '',
		statusTag = '',
		latestAction = '',
		updatedAt = '',
		onclick = null
	} = $props();

	let isHovered = $state(false);

	// Format sponsor display - show first sponsor's name and party
	function formatSponsor(sponsors) {
		if (!sponsors || sponsors.length === 0) return 'Unknown';
		
		const mainSponsor = sponsors[0];
		const name = `${mainSponsor.firstName || ''} ${mainSponsor.lastName || ''}`.trim();
		const party = mainSponsor.party ? ` [${mainSponsor.party}]` : '';
		
		return name + party;
	}

	// Extract text from latestAction object
	function getLatestActionText(latestAction) {
		if (!latestAction) return 'No recent action';
		
		// If it's already a string, return it
		if (typeof latestAction === 'string') return latestAction;
		
		// If it's an object with text property, return that
		if (latestAction.text) return latestAction.text;
		
		return 'No recent action';
	}

	function formatDate(dateString) {
		if (!dateString) return 'N/A';
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return 'N/A';
		}
	}

	function handleCardClick() {
		if (onclick) {
			onclick();
		} else {
			// Default behavior: navigate to bill detail page
			goto(`/bill/${id}`);
		}
	}

	function handleKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleCardClick();
		}
	}

</script>

<div
	class="bill-card"
	class:hovered={isHovered}
	onmouseenter={() => (isHovered = true)}
	onmouseleave={() => (isHovered = false)}
	onclick={handleCardClick}
	onkeydown={handleKeydown}
	role="button"
	tabindex="0"
> 
	<!-- Latest Action Overlay (shows on hover) -->
	<div class="latest-action-overlay" class:visible={isHovered}>
		<div class="overlay-content">
			<span class="overlay-label">Latest Action</span>
			<p class="overlay-text">{getLatestActionText(latestAction)}</p>
		</div>
	</div>

	

	<h3 class="bill-title">
		<div class="card-header">
			<span class="bill-number">{number}</span>
			{#if statusTag}
				<span class="badge">{statusTag}</span>
			{/if}
		</div>{title}
	</h3>

	<div class="bill-details">
		<div class="detail-row">
			<span class="detail-label">Sponsor</span>
			<span class="detail-value">{formatSponsor(sponsors)}</span>
		</div>

		<div class="detail-row">
			<span class="detail-label">Committee</span>
			<span class="detail-value">{committee || 'Unassigned'}</span>
		</div>

		<div class="detail-row">
			<span class="detail-label">Updated</span>
			<span class="detail-value">{formatDate(updatedAt)}</span>
		</div>
	</div>
</div>

<style>
	.bill-card {
		position: relative;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		transition: all var(--transition-spring);
		cursor: pointer;
		overflow: hidden;
		backdrop-filter: var(--blur);
		box-shadow: var(--shadow-soft);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.bill-card:hover {
		transform: translateY(-4px);
		border-color: rgba(241, 58, 55, 0.3);
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(241, 58, 55, 0.2);
	}

	.bill-card:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		gap: 0.5rem;
	}

	.bill-number {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--accent);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.bill-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 1.25rem 0;
		line-height: 1.4;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
		min-height: 2.8rem;
	}

	.bill-details {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
	}

	.detail-label {
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		flex-shrink: 0;
	}

	.detail-value {
		font-size: 0.95rem;
		color: var(--text-primary);
		text-align: right;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Latest Action Overlay */
	.latest-action-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, rgba(20, 18, 18, 0.97), rgba(28, 24, 24, 0.95));
		backdrop-filter: blur(20px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--transition-base);
		z-index: 5;
	}

	.latest-action-overlay.visible {
		opacity: 1;
		pointer-events: auto;
	}

	.overlay-content {
		text-align: center;
		max-width: 100%;
	}

	.overlay-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 0.75rem;
	}

	.overlay-text {
		font-size: 1rem;
		color: var(--text-primary);
		line-height: 1.6;
		margin: 0;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.bill-card {
			padding: 1.25rem;
		}

		.bill-title {
			font-size: 1.1rem;
		}

		.detail-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}

		.detail-value {
			text-align: left;
		}

		.latest-action-overlay {
			padding: 1.5rem;
		}

		.overlay-text {
			font-size: 0.9rem;
		}
	}

	@media (max-width: 480px) {
		.bill-card {
			padding: 1rem;
		}

		.bill-title {
			font-size: 1rem;
			min-height: 2.4rem;
		}

		.detail-label,
		.detail-value {
			font-size: 0.85rem;
		}
	}
</style>
