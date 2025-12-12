<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/Components/Navbar.svelte';
	import BottomTabBar from '$lib/Components/BottomTabBar.svelte';
	import { isStaticClient, getApiBaseUrl } from '$lib/config.js';
	import { pwaInfo } from 'virtual:pwa-info';
	import '../lib/styles/theme.css';

	let { children } = $props();
	let isScrolled = $state(false);

	onMount(async () => {
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegistered(r) {
					console.log('SW Registered: ' + r);
				},
				onRegisterError(error) {
					console.log('SW registration error', error);
				}
			});
		}

		const handleScroll = () => {
			isScrolled = window.scrollY > 1;
		};

		window.addEventListener('scroll', handleScroll);

		// Handle Capacitor hardware back button (only in Capacitor environment)
		let backButtonListener = null;
		if (typeof window !== 'undefined' && window.Capacitor) {
			try {
				const { App } = await import('@capacitor/app');
				backButtonListener = await App.addListener('backButton', () => {
					if ($page.url.pathname !== '/') {
						window.history.back();
					} else {
						App.exitApp();
					}
				});
			} catch (e) {
				console.log('Capacitor App plugin not available');
			}
		}

			return () => {
			window.removeEventListener('scroll', handleScroll);
			if (backButtonListener) {
				backButtonListener.remove();
			}
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{@html pwaInfo?.webManifest.linkTag}
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

	<BottomTabBar />
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
		gap: 0.75rem;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s ease;
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
		padding: env(safe-area-inset-top) 0 0 0;
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
		padding-bottom: 70px; /* Space for bottom tab bar */
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
