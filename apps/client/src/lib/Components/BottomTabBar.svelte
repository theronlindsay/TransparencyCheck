<script>
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isAuthenticated } from '$lib/stores/auth.js';
	import { onMount } from 'svelte';

	const TRAIL_KEY = 'tc:recent-page-trail';
	const MAX_TRAIL_LENGTH = 12;
	let pageTrail = [];
	let suppressNextRecord = false;

	function toRouteKey(url) {
		return `${url.pathname}${url.search}${url.hash}`;
	}

	function loadTrail() {
		if (!browser) return;
		try {
			const raw = sessionStorage.getItem(TRAIL_KEY);
			const parsed = raw ? JSON.parse(raw) : [];
			if (Array.isArray(parsed)) {
				pageTrail = parsed.filter((item) => typeof item === 'string').slice(-MAX_TRAIL_LENGTH);
			}
		} catch {
			pageTrail = [];
		}
	}

	function saveTrail() {
		if (!browser) return;
		sessionStorage.setItem(TRAIL_KEY, JSON.stringify(pageTrail.slice(-MAX_TRAIL_LENGTH)));
	}

	onMount(() => {
		loadTrail();

		const unsubscribe = page.subscribe(($page) => {
			const currentRoute = toRouteKey($page.url);
			if (suppressNextRecord) {
				suppressNextRecord = false;
				return;
			}

			const lastRoute = pageTrail[pageTrail.length - 1];
			if (lastRoute === currentRoute) {
				return;
			}

			pageTrail = [...pageTrail, currentRoute].slice(-MAX_TRAIL_LENGTH);
			saveTrail();
		});

		return () => unsubscribe();
	});

	function goHome() {
		goto(resolve('/'));
	}

	function goBack() {
		const currentRoute = toRouteKey($page.url);
		let trail = [...pageTrail];

		// Remove current page if it is at the top of the trail.
		if (trail[trail.length - 1] === currentRoute) {
			trail.pop();
		}

		const previousRoute = trail[trail.length - 1];
		if (previousRoute) {
			pageTrail = trail;
			saveTrail();
			suppressNextRecord = true;
			goto(resolve(previousRoute));
			return;
		}

		if (window.history.state && window.history.state.idx > 0) {
			window.history.back();
			return;
		}

		goto(resolve('/'));
	}

	function goAccount() {
		if ($isAuthenticated) {
			goto(resolve('/account'));
			return;
		}

		goto(resolve('/auth'));
	}
</script>

<nav class="bottom-tab-bar">
	<button
		class="tab-item"
		class:active={$page.url.pathname === '/'}
		onclick={goHome}
		aria-label="Home"
	>
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
			<polyline points="9 22 9 12 15 12 15 22"></polyline>
		</svg>
		<span>Home</span>
	</button>

	<button
		class="tab-item"
		class:active={$page.url.pathname.startsWith('/account') ||
			$page.url.pathname.startsWith('/auth')}
		onclick={goAccount}
		aria-label="Account"
	>
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M20 21a8 8 0 0 0-16 0"></path>
			<circle cx="12" cy="8" r="4"></circle>
		</svg>
		<span>Account</span>
	</button>

	<button class="tab-item" onclick={goBack} aria-label="Back">
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
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
		height: calc(68px + env(safe-area-inset-bottom));
		background: var(--bg-primary);
		border-top: 1px solid var(--border-color);
		padding-bottom: env(safe-area-inset-bottom);
		padding-top: 0.25rem;
		box-sizing: border-box;
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
		transition:
			color 0.2s ease,
			transform 0.2s ease;
		flex: 1;
		min-height: 56px;
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
		line-height: 1;
	}
</style>
