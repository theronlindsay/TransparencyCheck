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

	function goReps() {
		goto(resolve('/representatives'));
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
		aria-label="Bills"
	>
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
			<polyline points="14 2 14 8 20 8"></polyline>
			<line x1="16" y1="13" x2="8" y2="13"></line>
			<line x1="16" y1="17" x2="8" y2="17"></line>
			<polyline points="10 9 9 9 8 9"></polyline>
		</svg>
		<span>Bills</span>
	</button>

	<button
		class="tab-item"
		class:active={$page.url.pathname.startsWith('/representatives')}
		onclick={goReps}
		aria-label="Reps"
	>
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
			<circle cx="9" cy="7" r="4"></circle>
			<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
			<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
		</svg>
		<span>Reps</span>
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
		align-items: center;
		gap: 1rem;
		padding-left: 0.75rem;
		padding-right: 0.75rem;
		box-sizing: border-box;
		height: calc(68px + env(safe-area-inset-bottom));
		background: linear-gradient(180deg, rgba(28, 24, 24, 0.96) 0%, rgba(14, 12, 12, 0.98) 100%);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding-bottom: env(safe-area-inset-bottom);
		padding-top: 0.25rem;
		z-index: 100;
		backdrop-filter: blur(20px);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			0 -10px 28px rgba(0, 0, 0, 0.4);
	}

	.tab-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.5rem 1rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid transparent;
		border-radius: 12px;
		color: var(--text-secondary);
		cursor: pointer;
		transition:
			color 0.2s ease,
			transform 0.2s ease,
			box-shadow 0.2s ease,
			border-color 0.2s ease,
			background 0.2s ease;
		flex: 1 1 0;
		min-width: 0;
		min-height: 56px;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.tab-item:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.05);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.tab-item:active {
		transform: scale(0.96) translateY(1px);
	}

	.tab-item.active {
		color: var(--accent);
		background: linear-gradient(145deg, rgba(241, 58, 55, 0.18), rgba(241, 58, 55, 0.06));
		border-color: rgba(241, 58, 55, 0.35);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			0 4px 14px rgba(241, 58, 55, 0.18);
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
