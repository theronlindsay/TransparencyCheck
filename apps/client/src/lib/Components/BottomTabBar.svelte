<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { showAISummarizer, toggleAISummarizer } from '$lib/stores/ui.js';

	function goHome() {
		goto('/');
	}

	function goSearch() {
		goto('/table');
	}

	function handleAIClick() {
		// Toggle the AI summarizer visibility
		toggleAISummarizer();
		// If turning on, scroll to it after a brief delay
		if (!$showAISummarizer) {
			setTimeout(() => {
				const summarizer = document.querySelector('.ai-summarizer');
				if (summarizer) {
					summarizer.scrollIntoView({ behavior: 'smooth' });
				}
			}, 100);
		}
	}

	function goBack() {
		if (window.history.state && window.history.state.idx > 0) {
			window.history.back();
		} else {
			goto('/');
		}
	}
</script>

<nav class="bottom-tab-bar">
	<button 
		class="tab-item" 
		class:active={$page.url.pathname === '/'}
		onclick={goHome}
		aria-label="Home"
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
			<polyline points="9 22 9 12 15 12 15 22"></polyline>
		</svg>
		<span>Home</span>
	</button>

	<button 
		class="tab-item"
		class:active={$page.url.pathname === '/table'}
		onclick={goSearch}
		aria-label="Search"
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="11" cy="11" r="8"></circle>
			<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
		</svg>
		<span>Search</span>
	</button>

	<button 
		class="tab-item"
		class:active={$showAISummarizer}
		onclick={handleAIClick}
		aria-label="AI"
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path>
			<circle cx="7.5" cy="14.5" r="1.5" fill="currentColor"></circle>
			<circle cx="16.5" cy="14.5" r="1.5" fill="currentColor"></circle>
		</svg>
		<span>AI</span>
	</button>

	<button 
		class="tab-item"
		onclick={goBack}
		aria-label="Back"
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<line x1="19" y1="12" x2="5" y2="12"></line>
			<polyline points="12 19 5 12 12 5"></polyline>
		</svg>
		<span>Back</span>
	</button>
</nav>

<style>
	.bottom-tab-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-around;
		align-items: center;
		height: 60px;
		background: var(--bg-primary);
		border-top: 1px solid var(--border-color);
		padding-bottom: env(safe-area-inset-bottom);
		z-index: 100;
		backdrop-filter: blur(20px);
	}

	.tab-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.5rem 1rem;
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		transition: color 0.2s ease, transform 0.2s ease;
		flex: 1;
	}

	.tab-item:hover {
		color: var(--text-primary);
	}

	.tab-item:active {
		transform: scale(0.95);
	}

	.tab-item.active {
		color: var(--accent);
	}

	.tab-item svg {
		width: 22px;
		height: 22px;
	}

	.tab-item span {
		font-size: 0.7rem;
		font-weight: 500;
	}
</style>
