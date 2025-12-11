<script>
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/Components/Navbar.svelte';
	import { isStaticClient, getApiBaseUrl } from '$lib/config.js';
	import '../lib/styles/theme.css';

	let { children } = $props();
	let isScrolled = $state(false);
	let debugInfo = $state('Initializing...');
	let showDebug = $state(true);

	onMount(() => {
		try {
			debugInfo += '\nMounted!';
			const handleScroll = () => {
				isScrolled = window.scrollY > 1;
			};

			window.addEventListener('scroll', handleScroll);
			
			// Debug info for troubleshooting mobile
			debugInfo += `
				isStaticClient: ${isStaticClient()}
				protocol: ${window.location.protocol}
				hostname: ${window.location.hostname}
				apiBase: ${getApiBaseUrl()}
				Capacitor: ${!!window.Capacitor}
			`;

			// Test API connection
			fetch(getApiBaseUrl() + '/api/bills')
				.then(res => debugInfo += `\nAPI Status: ${res.status}`)
				.catch(err => debugInfo += `\nAPI Error: ${err.message}`);
			
			return () => window.removeEventListener('scroll', handleScroll);
		} catch (e) {
			debugInfo += `\nError in onMount: ${e.message}`;
		}
	});

	// Global error handler
	if (typeof window !== 'undefined') {
		window.addEventListener('error', (event) => {
			debugInfo += `\nGlobal Error: ${event.message}`;
		});
		window.addEventListener('unhandledrejection', (event) => {
			debugInfo += `\nUnhandled Rejection: ${event.reason}`;
		});
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-layout">

	

	<div class="navbar-container" class:scrolled={isScrolled}>
		<div class="app-header">
			<a href="/" class="logo-link">
				<svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="back-chevron">
					<path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<img src="/Logo.png" alt="Transparency Check"/>
			</a>
		</div>

		<!-- <Navbar /> -->
	</div>

	

	<div class="app-content">
		{@render children?.()}
	</div>
	
	<!-- Debug toggle - tap corner to show -->
	<button class="debug-toggle" onclick={() => showDebug = !showDebug}>?</button>
	{#if showDebug}
		<pre class="debug-panel">{debugInfo}</pre>
	{/if}
</div>

<style>
	.debug-toggle {
		position: fixed;
		bottom: 10px;
		right: 10px;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: rgba(0,0,0,0.5);
		color: white;
		border: none;
		font-size: 14px;
		z-index: 9999;
	}
	
	.debug-panel {
		position: fixed;
		bottom: 50px;
		right: 10px;
		background: rgba(0,0,0,0.9);
		color: #0f0;
		padding: 10px;
		font-size: 10px;
		max-width: 90vw;
		z-index: 9999;
		white-space: pre-wrap;
		border-radius: 8px;
	}

	.app-layout {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.app-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		transition: padding 0.3s ease;
	}

	.logo-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.logo-link:hover {
		transform: translateX(-3px);
	}

	.back-chevron {
		color: var(--accent);
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.logo-link:hover .back-chevron {
		transform: translateX(-3px);
	}

	.app-header img {
		width: 300px;
		transition: width 0.3s ease, margin 0.3s ease;
	}

	.navbar-container {
		position: sticky;
		top: 0;
		z-index: 100;
		backdrop-filter: blur(20px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		transition: all 0.3s ease;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		padding: 0;
	}

	.navbar-container .app-header {
		flex-shrink: 0;
	}

	.navbar-container.scrolled .app-header {
		padding: 0.5rem 2rem;
	}

	.navbar-container.scrolled .app-header img {
		width: 150px;
	}

	.app-content {
		flex: 1;
		padding: 0;
	}

	@media (max-width: 768px) {
		.navbar-container {
			flex-direction: column;
			align-items: stretch;
		}

		.app-header {
			flex-direction: column;
			gap: 1rem;
			padding: 1rem;
		}
	}
</style>
