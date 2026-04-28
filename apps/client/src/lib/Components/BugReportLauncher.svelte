<script>
	let { onClick = () => {} } = $props();
</script>

<button class="bug-launcher" onclick={onClick} aria-label="Find a bug" title="find a bug">
	<span class="tooltip">find a bug</span>
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<path
			d="M14 4h1a2 2 0 0 1 2 2v1.14a5 5 0 0 1 2.18 1.27l1.12-1.12 1.41 1.41-1.12 1.12A5 5 0 0 1 21 12h1.5v2H21a5 5 0 0 1-.41 1.94l1.12 1.12-1.41 1.41-1.12-1.12A5 5 0 0 1 17 17.86V19a2 2 0 0 1-2 2h-1v-2h1v-1h-6v1h1v2H9a2 2 0 0 1-2-2v-1.14a5 5 0 0 1-2.18-1.27l-1.12 1.12-1.41-1.41 1.12-1.12A5 5 0 0 1 3 14H1.5v-2H3a5 5 0 0 1 .41-1.94L2.29 8.94l1.41-1.41 1.12 1.12A5 5 0 0 1 7 7.14V6a2 2 0 0 1 2-2h1V2h4zm1 5H9a3 3 0 0 0-3 3v1a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-1a3 3 0 0 0-3-3zm-4 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm2 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
		/>
	</svg>
</button>

<style>
	.bug-launcher {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 999px;
		border: 1px solid rgba(241, 58, 55, 0.3);
		background: rgba(241, 58, 55, 0.12);
		color: var(--text-primary);
		cursor: pointer;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			0 12px 30px rgba(0, 0, 0, 0.28);
		transition:
			transform var(--transition-base),
			background var(--transition-base),
			border-color var(--transition-base);
	}

	.bug-launcher:hover {
		transform: translateY(-1px);
		background: rgba(241, 58, 55, 0.18);
		border-color: rgba(241, 58, 55, 0.5);
	}

	.bug-launcher svg {
		width: 22px;
		height: 22px;
		fill: currentColor;
	}

	.tooltip {
		position: absolute;
		right: 0;
		top: calc(100% + 10px);
		padding: 0.45rem 0.65rem;
		border-radius: 999px;
		background: rgba(20, 18, 18, 0.94);
		color: var(--text-primary);
		font-size: 0.82rem;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transform: translateY(-4px);
		transition:
			opacity var(--transition-base),
			transform var(--transition-base);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.bug-launcher:hover .tooltip,
	.bug-launcher:focus-visible .tooltip {
		opacity: 1;
		transform: translateY(0);
	}
</style>
