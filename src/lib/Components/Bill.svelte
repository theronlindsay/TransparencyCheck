<script>
	import { goto } from '$app/navigation';

	// Props for bill data
	let {
		id = '',
		number = '',
		title = '',
		sponsor = '',
		committee = '',
		statusTag = '',
		latestAction = '',
		updatedAt = '',
		fullTextUrl = '',
		onclick = null,
		onLearnMore = null
	} = $props();

	let isHovered = $state(false);

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

	function handleLearnMore(event) {
		event.stopPropagation();
		if (onLearnMore) {
			onLearnMore(id);
		} else {
			// Default behavior: navigate to bill detail page
			goto(`/bill/${id}`);
		}
	}

	function handleViewFullText(event) {
		event.stopPropagation();
	}

</script>

<article
	class="bill-card"
	class:hovered={isHovered}
	onmouseenter={() => (isHovered = true)}
	onmouseleave={() => (isHovered = false)}
	onclick={onclick}
	role={onclick ? 'button' : 'article'}
	tabindex={onclick ? 0 : undefined}
>
	<!-- Latest Action Overlay (shows on hover) -->
	<div class="latest-action-overlay" class:visible={isHovered}>
		<div class="overlay-content">
			<span class="overlay-label">Latest Action</span>
			<p class="overlay-text">{latestAction || 'No recent action'}</p>
		</div>
	</div>

	<!-- Card Content -->
	<div class="card-header">
		<span class="bill-number">{number}</span>
		{#if statusTag}
			<span class="badge">{statusTag}</span>
		{/if}
	</div>

	<h3 class="bill-title">{title}</h3>

	<div class="bill-details">
		<div class="detail-row">
			<span class="detail-label">Sponsor</span>
			<span class="detail-value">{sponsor || 'Unknown'}</span>
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

	{#if fullTextUrl}
		<a
			href={fullTextUrl}
			class="full-text-link"
			target="_blank"
			rel="noopener noreferrer"
			onclick={handleViewFullText}
		>
			View Full Text →
		</a>
	{/if}

	<!-- Action Buttons (always visible) -->
	<div class="card-actions">
		<button class="action-button primary" onclick={handleLearnMore}>Learn More</button>
		{#if fullTextUrl}
			<a
				href={fullTextUrl}
				class="action-button secondary"
				target="_blank"
				rel="noopener noreferrer"
				onclick={handleViewFullText}
			>
				Full Text
			</a>
		{/if}
	</div>
</article>

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

	.full-text-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--accent);
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
		margin-top: 0.5rem;
		transition: all var(--transition-base);
	}

	.full-text-link:hover {
		color: #ff5b58;
		transform: translateX(4px);
	}

	/* Action Buttons */
	.card-actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 1.25rem;
		position: relative;
		z-index: 20;
	}

	.action-button {
		flex: 1;
		padding: 0.75rem 1.25rem;
		border-radius: var(--radius-md);
		font-size: 0.9rem;
		font-weight: 600;
		text-align: center;
		text-decoration: none;
		cursor: pointer;
		transition: all var(--transition-base);
		border: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.action-button.primary {
		background: linear-gradient(135deg, rgba(241, 58, 55, 0.2), rgba(241, 58, 55, 0.35));
		color: var(--text-primary);
		border: 1px solid rgba(241, 58, 55, 0.3);
	}

	.action-button.primary:hover {
		background: linear-gradient(135deg, rgba(241, 58, 55, 0.3), rgba(241, 58, 55, 0.45));
		border-color: rgba(241, 58, 55, 0.5);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(241, 58, 55, 0.3);
	}

	.action-button.secondary {
		background: var(--bg-elevated);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.action-button.secondary:hover {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.15);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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

		.card-actions {
			flex-direction: column;
		}

		.action-button {
			width: 100%;
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

		.action-button {
			padding: 0.65rem 1rem;
			font-size: 0.85rem;
		}
	}
</style>
