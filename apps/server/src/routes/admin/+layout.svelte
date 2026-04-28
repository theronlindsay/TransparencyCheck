<script>
	import { page } from '$app/stores';

	const navItems = [
		{ href: '/admin/cron', label: 'Cron' },
		{ href: '/admin/logs', label: 'Logs' },
		{ href: '/admin/bug-reports', label: 'Bug Reports' },
		{ href: '/admin/representatives', label: 'Representatives' },
		{ href: '/admin/mongodb', label: 'MongoDB' }
	];

	$: isLoginPage = $page.url.pathname === '/admin/login';
</script>

<svelte:head>
	<title>TransparencyCheck Admin</title>
</svelte:head>

{#if isLoginPage}
	<slot />
{:else}
	<div class="shell">
		<header class="topbar">
			<div>
				<p class="eyebrow">TransparencyCheck</p>
				<h1>Admin Panel</h1>
			</div>
			<nav>
				{#each navItems as item}
					<a class:active={$page.url.pathname.startsWith(item.href)} href={item.href}
						>{item.label}</a
					>
				{/each}
			</nav>
		</header>

		<main class="content">
			<slot />
		</main>
	</div>
{/if}

<style>
	:global(body) {
		--admin-bg: #001923;
		--admin-bg-secondary: #002b36;
		--admin-surface: rgba(7, 54, 66, 0.78);
		--admin-surface-strong: rgba(10, 63, 77, 0.9);
		--admin-surface-soft: rgba(38, 80, 96, 0.38);
		--admin-border: rgba(147, 161, 161, 0.18);
		--admin-text: #d9e6ea;
		--admin-muted: #93a1a1;
		--admin-accent: #268bd2;
		--admin-accent-strong: #2aa198;
		--admin-code-bg: rgba(0, 20, 28, 0.88);
		--admin-code-text: #e6f3f5;
		--admin-danger-bg: rgba(220, 50, 47, 0.16);
		--admin-danger-text: #ffb4ab;
		margin: 0;
		font-family: 'IBM Plex Sans', 'SF Pro Display', 'SF Pro Text', Helvetica, sans-serif;
		background:
			radial-gradient(circle at top left, rgba(42, 161, 152, 0.18), transparent 26%),
			radial-gradient(circle at top right, rgba(38, 139, 210, 0.14), transparent 24%),
			linear-gradient(180deg, var(--admin-bg) 0%, var(--admin-bg-secondary) 100%);
		color: var(--admin-text);
	}

	:global(*) {
		box-sizing: border-box;
	}

	.shell {
		min-height: 100vh;
		padding: 24px;
	}

	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		padding: 20px 24px;
		border: 1px solid var(--admin-border);
		border-radius: 28px;
		background: linear-gradient(180deg, rgba(14, 70, 84, 0.78) 0%, rgba(7, 54, 66, 0.88) 100%);
		backdrop-filter: blur(12px);
		box-shadow:
			0 22px 70px rgba(0, 0, 0, 0.24),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.eyebrow {
		margin: 0 0 4px;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: var(--admin-muted);
	}

	h1 {
		margin: 0;
		font-size: clamp(1.5rem, 3vw, 2.5rem);
		font-weight: 700;
	}

	nav {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	nav a {
		padding: 10px 16px;
		border-radius: 999px;
		color: var(--admin-text);
		text-decoration: none;
		background: rgba(38, 80, 96, 0.38);
		border: 1px solid var(--admin-border);
		font-weight: 600;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	nav a.active {
		background: linear-gradient(135deg, var(--admin-accent) 0%, var(--admin-accent-strong) 100%);
		border-color: rgba(255, 255, 255, 0.1);
		color: #f3fbfd;
	}

	.content {
		padding-top: 24px;
	}

	@media (max-width: 720px) {
		.shell {
			padding: 16px;
		}

		.topbar {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
