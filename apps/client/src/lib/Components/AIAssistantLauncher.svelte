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
		background: linear-gradient(165deg, #ff5a53, #de2e2e);
		color: #fff;
		font-size: 1.45rem;
		cursor: pointer;
		z-index: 130;
		box-shadow:
			0 14px 22px rgba(222, 46, 46, 0.35),
			0 7px 0 #8d1f1f,
			inset 0 1px 0 rgba(255, 255, 255, 0.25);
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}

	.assistant-launcher:hover {
		transform: translateY(-2px);
		box-shadow:
			0 18px 26px rgba(222, 46, 46, 0.45),
			0 9px 0 #8d1f1f,
			inset 0 1px 0 rgba(255, 255, 255, 0.3);
	}

	.assistant-launcher:active,
	.assistant-launcher.open {
		transform: translateY(4px);
		box-shadow:
			0 9px 14px rgba(222, 46, 46, 0.28),
			0 2px 0 #8d1f1f,
			inset 0 1px 0 rgba(255, 255, 255, 0.16);
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
