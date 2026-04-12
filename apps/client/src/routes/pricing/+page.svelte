<script>
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth/client.js';
	import { getApiBaseUrl } from '$lib/config.js';

	let user = $state(null);
	let errorMsg = $state('');

	onMount(async () => {
		const { data } = await authClient.getSession();
		if (data && data.user) {
			user = data.user;
		}
	});

	async function handleSubscribe() {
		if (!user) {
			window.location.href = '/auth/login?redirect=/pricing';
			return;
		}

		try {
			const res = await fetch(`${getApiBaseUrl()}/api/stripe/checkout`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
					// Normally authentication relies on cookies handled by BetterAuth
				}
			});

			const data = await res.json();
			if (data.url) {
				window.location.href = data.url;
			} else if (data.error) {
				errorMsg = data.error;
			}
		} catch {
			errorMsg = 'Failed to initiate checkout. Please try again later.';
		}
	}
</script>

<svelte:head>
	<title>Pricing & Plans | TransparencyCheck</title>
</svelte:head>

<section class="pricing-container">
	<div class="pricing-header">
		<h1>Upgrade your Transparency</h1>
		<p>Unlock premium models and advanced tracking capabilities.</p>
	</div>

	{#if errorMsg}
		<div class="error-banner">{errorMsg}</div>
	{/if}

	<div class="pricing-grid">
		<!-- Free Tier -->
		<div class="pricing-card">
			<div class="card-header">
				<h2>Free Tier</h2>
				<div class="price">$0<span>/forever</span></div>
			</div>
			<ul class="features">
				<li><span class="check">✓</span> Standard Llama-3 AI Analysis</li>
				<li><span class="check">✓</span> View basic politician metrics</li>
				<li><span class="check">✓</span> Ads supported</li>
			</ul>
			<div class="card-action">
				{#if user?.additionalFields?.subscriptionTier === 'free'}
					<button class="btn secondary" disabled>Current Plan</button>
				{:else if !user}
					<a href={resolve('/auth?mode=signup')} class="btn secondary">Sign Up Free</a>
				{:else}
					<button class="btn secondary" disabled>Current Plan</button>
				{/if}
			</div>
		</div>

		<!-- Pro Tier -->
		<div class="pricing-card pro">
			<div class="glass-badge">Most Popular</div>
			<div class="card-header">
				<h2>Pro Tier</h2>
				<div class="price">$9.99<span>/month</span></div>
			</div>
			<ul class="features">
				<li>
					<span class="check">✓</span> <strong>Advanced GPT-4o / Claude 3.5</strong> AI Analysis
				</li>
				<li><span class="check">✓</span> Save and Track Unlimited Bills</li>
				<li><span class="check">✓</span> Real-time Email & Push Notifications</li>
				<li><span class="check">✓</span> Ad-free experience</li>
			</ul>
			<div class="card-action">
				{#if user?.additionalFields?.subscriptionTier === 'pro'}
					<button class="btn primary" disabled>You are Pro!</button>
				{:else}
					<button class="btn primary" onclick={handleSubscribe}>Upgrade to Pro</button>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

	.pricing-container {
		font-family: 'Inter', sans-serif;
		color: #fff;
		max-width: 1000px;
		margin: 0 auto;
		padding: 4rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 80vh;
	}

	.pricing-header {
		text-align: center;
		margin-bottom: 4rem;
	}

	.pricing-header h1 {
		font-size: 3rem;
		font-weight: 800;
		margin-bottom: 1rem;
		background: linear-gradient(135deg, var(--accent), var(--blue-accent));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.pricing-header p {
		font-size: 1.25rem;
		color: #94a3b8;
	}

	.pricing-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
		width: 100%;
		max-width: 800px;
	}

	@media (min-width: 768px) {
		.pricing-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.pricing-card {
		background: var(--bg-elevated);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 2.5rem;
		display: flex;
		flex-direction: column;
		backdrop-filter: var(--blur);
		transition:
			transform var(--transition-base),
			border-color var(--transition-base);
		position: relative;
	}

	.pricing-card:hover {
		transform: translateY(-5px);
		border-color: rgba(255, 255, 255, 0.2);
	}

	.pricing-card.pro {
		background: linear-gradient(180deg, var(--bg-elevated) 0%, rgba(37, 99, 235, 0.05) 100%);
		border: 1px solid var(--blue-accent);
		box-shadow: 0 20px 40px -10px var(--blue-soft);
	}

	.glass-badge {
		position: absolute;
		top: -15px;
		right: 20px;
		background: linear-gradient(135deg, var(--blue-accent), #1d4ed8);
		padding: 0.5rem 1rem;
		border-radius: 2rem;
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		box-shadow: 0 4px 15px var(--blue-soft);
	}

	.card-header {
		margin-bottom: 2rem;
		border-bottom: 1px solid var(--border-color);
		padding-bottom: 2rem;
	}

	.card-header h2 {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	.price {
		font-size: 3rem;
		font-weight: 800;
		color: var(--text-primary);
	}

	.price span {
		font-size: 1.25rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.features {
		list-style: none;
		padding: 0;
		margin: 0;
		flex-grow: 1;
	}

	.features li {
		margin-bottom: 1rem;
		color: var(--text-secondary);
		display: flex;
		align-items: center;
	}

	.features li strong {
		color: var(--text-primary);
		font-weight: 600;
		margin: 0 0.25rem;
	}

	.check {
		color: var(--blue-accent);
		font-weight: bold;
		margin-right: 0.75rem;
	}

	.card-action {
		margin-top: 2.5rem;
	}

	.btn {
		width: 100%;
		padding: 1rem;
		border-radius: var(--radius-sm);
		font-size: 1.125rem;
		font-weight: 600;
		text-align: center;
		cursor: pointer;
		transition: all var(--transition-base);
		text-decoration: none;
		display: inline-block;
		box-sizing: border-box;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn.primary {
		background: linear-gradient(135deg, var(--blue-accent), #1d4ed8);
		color: white;
		border: none;
		box-shadow: 0 4px 15px var(--blue-soft);
	}

	.btn.primary:hover:not(:disabled) {
		box-shadow: 0 6px 20px var(--blue-soft);
		transform: translateY(-2px);
	}

	.btn.secondary {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.btn.secondary:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.1);
	}

	.error-banner {
		background-color: rgba(239, 68, 68, 0.2);
		border: 1px solid #ef4444;
		color: #f87171;
		padding: 1rem;
		border-radius: 0.5rem;
		margin-bottom: 2rem;
		width: 100%;
		max-width: 800px;
		text-align: center;
	}
</style>
