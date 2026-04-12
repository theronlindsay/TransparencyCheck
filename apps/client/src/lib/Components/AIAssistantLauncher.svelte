<script>
	let { isOpen = false, onClick = () => {} } = $props();
</script>

<button
	class="assistant-launcher"
	class:open={isOpen}
	onclick={onClick}
	aria-label="Open AI assistant"
	title="AI Assistant"
>
	<span class="icon">🤖</span>
</button>

<style>
	.assistant-launcher {
		position: fixed;
		right: 1rem;
		bottom: calc(84px + env(safe-area-inset-bottom));
		width: 60px;
		height: 60px;
		border-radius: 999px;
		border: 0;
		background: var(--depth-primary-face);
		color: #fff;
		font-size: 1.45rem;
		cursor: pointer;
		z-index: 130;
		box-shadow: var(--depth-primary-rest);
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}

	.assistant-launcher:hover {
		transform: translateY(-2px);
		box-shadow: var(--depth-primary-hover);
	}

	.assistant-launcher:active,
	.assistant-launcher.open {
		transform: translateY(4px);
		box-shadow: var(--depth-primary-active);
	}

	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	@media (max-width: 768px) {
		.assistant-launcher {
			width: 56px;
			height: 56px;
			right: 0.8rem;
			bottom: calc(80px + env(safe-area-inset-bottom));
		}
	}
</style>
