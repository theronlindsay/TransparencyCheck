<script>
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/Components/Navbar.svelte';
	import '../lib/styles/theme.css';

	let { children } = $props();
	let isScrolled = $state(false);

	onMount(() => {
		const handleScroll = () => {
			isScrolled = window.scrollY > 1;
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-layout">

	

	<div class="navbar-container" class:scrolled={isScrolled}>
		<div class="app-header">
			<a href="/" class="logo-link">
				<img src="/Logo.png" alt="Transparency Check"/>
			</a>
		</div>

		<!-- <Navbar /> -->
	</div>

	

	<div class="app-content">
		{@render children?.()}
	</div>
</div>

<style>
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
		text-decoration: none;
		cursor: pointer;
		transition: transform 0.2s ease;
	}

	.logo-link:hover {
		transform: scale(1.02);
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
