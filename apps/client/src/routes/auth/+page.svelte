<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { authError, isAuthenticated, signInEmail, signUpEmail } from '$lib/stores/auth.js';

	let mode = $state('login');
	let isSubmitting = $state(false);
	let notice = $state('');
	let showInvalidCredentials = $state(false);

	let loginEmail = $state('');
	let loginPassword = $state('');

	let signupName = $state('');
	let signupEmail = $state('');
	let signupPassword = $state('');
	let signupConfirmPassword = $state('');

	const features = [
		'📬 Subscribe to bills and get mobile push notifications for updates.',
		'🧠 Save AI summaries so your policy research stays organized.',
		'⭐ Bookmark key legislation and monitor action history in one place.',
		'🔔 Create custom watchlists by topic, chamber, or sponsor.'
	];

	$effect(() => {
		const requestedMode = $page.url.searchParams.get('mode');
		if (requestedMode === 'signup') {
			mode = 'signup';
		}
	});

	$effect(() => {
		if ($isAuthenticated) {
			goto(resolve('/account'));
		}
	});

	async function submitLogin(event) {
		event.preventDefault();
		notice = '';
		showInvalidCredentials = false;
		isSubmitting = true;

		const result = await signInEmail(loginEmail, loginPassword);
		isSubmitting = false;

		if (result.ok) {
			notice = 'Welcome back. Redirecting to your account...';
			setTimeout(() => goto(resolve('/account')), 350);
		} else {
			showInvalidCredentials = true;
		}
	}

	async function submitSignup(event) {
		event.preventDefault();
		notice = '';
		showInvalidCredentials = false;

		if (signupPassword !== signupConfirmPassword) {
			notice = 'Passwords do not match.';
			return;
		}

		isSubmitting = true;
		const result = await signUpEmail(signupName, signupEmail, signupPassword);
		isSubmitting = false;

		if (result.ok) {
			notice = 'Account created. Redirecting to account setup...';
			setTimeout(() => goto(resolve('/account')), 350);
		}
	}
</script>

<div class="auth-page">
	<div class="auth-shell">
		<section class="feature-panel elevated">
			<p class="eyebrow">Your Legislative Control Room</p>
			<h1>Build a smarter way to follow bills.</h1>
			<p class="lead">
				Create an account to unlock personalized transparency tools across web and mobile.
			</p>

			<ul>
				{#each features as item, index (item)}
					<li style={`--i:${index}`}>{item}</li>
				{/each}
			</ul>
		</section>

		<section class="auth-panel elevated">
			<div class="mode-switch">
				<button
					type="button"
					class:active={mode === 'login'}
					onclick={() => {
						mode = 'login';
						notice = '';
						showInvalidCredentials = false;
					}}
				>
					🔐 Login
				</button>
				<button
					type="button"
					class:active={mode === 'signup'}
					onclick={() => {
						mode = 'signup';
						notice = '';
						showInvalidCredentials = false;
					}}
				>
					✨ Create Account
				</button>
			</div>

			{#if mode === 'login'}
				<form class="auth-form" onsubmit={submitLogin}>
					<label>
						Email
						<input bind:value={loginEmail} type="email" required placeholder="you@example.com" />
					</label>
					<label>
						Password
						<input bind:value={loginPassword} type="password" required minlength="8" />
					</label>
					<button class="depth-button" type="submit" disabled={isSubmitting}>
						{isSubmitting ? 'Signing In...' : 'Sign In'}
					</button>
				</form>
			{:else}
				<form class="auth-form" onsubmit={submitSignup}>
					<label>
						Full Name
						<input bind:value={signupName} type="text" required placeholder="Avery Citizen" />
					</label>
					<label>
						Email
						<input bind:value={signupEmail} type="email" required placeholder="you@example.com" />
					</label>
					<label>
						Password
						<input bind:value={signupPassword} type="password" required minlength="8" />
					</label>
					<label>
						Confirm Password
						<input bind:value={signupConfirmPassword} type="password" required minlength="8" />
					</label>
					<button class="depth-button" type="submit" disabled={isSubmitting}>
						{isSubmitting ? 'Creating Account...' : 'Create Account'}
					</button>
				</form>
			{/if}

			<div class="disclaimer">
				<p>
					By {mode === 'login' ? 'logging in' : 'creating an account'}, you agree to our 
					<a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. 
					We securely store your email for account access and collect anonymous telemetry data to improve your experience.
				</p>
			</div>

			{#if notice}
				<p class="notice">{notice}</p>
			{/if}
			{#if showInvalidCredentials}
				<div class="error credentials-error">
					<p>Incorrect email or password. Your credentials did not match an existing account.</p>
					<a class="signup-link-button" href={resolve('/auth?mode=signup')}>Create an account</a>
				</div>
			{/if}
			{#if $authError && !showInvalidCredentials}
				<p class="error">{$authError}</p>
			{/if}
		</section>
	</div>
</div>

<style>
	.auth-page {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.auth-shell {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: 1.5rem;
		align-items: stretch;
	}

	.elevated {
		position: relative;
		background: linear-gradient(145deg, rgba(30, 24, 24, 0.92), rgba(20, 17, 17, 0.86));
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 26px;
		box-shadow:
			0 18px 26px rgba(0, 0, 0, 0.4),
			0 32px 60px rgba(0, 0, 0, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		transform: translateZ(0);
		overflow: hidden;
	}

	.elevated::after {
		content: '';
		position: absolute;
		inset: auto 16px -18px 16px;
		height: 28px;
		filter: blur(14px);
		background: rgba(0, 0, 0, 0.35);
		z-index: -1;
	}

	.feature-panel {
		padding: 2.2rem;
		animation: reveal 0.45s ease-out both;
	}

	.eyebrow {
		font-size: 0.82rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(241, 58, 55, 0.9);
		margin: 0 0 0.8rem;
	}

	h1 {
		font-size: clamp(2rem, 3.4vw, 3.3rem);
		line-height: 1.05;
		margin: 0 0 1rem;
	}

	.lead {
		font-size: 1.03rem;
		max-width: 56ch;
		margin-bottom: 1.3rem;
	}

	ul {
		display: grid;
		gap: 0.85rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		padding: 0.9rem 1rem;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
		animation: rise 0.35s ease both;
		animation-delay: calc(var(--i) * 0.08s);
	}

	.auth-panel {
		padding: 1.5rem;
		display: grid;
		align-content: start;
		gap: 1rem;
		animation: reveal 0.55s ease-out both;
	}

	.mode-switch {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.55rem;
	}

	.mode-switch button {
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.02);
		color: var(--text-secondary);
		padding: 0.8rem 0.9rem;
		border-radius: 14px;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.mode-switch button.active {
		color: var(--text-primary);
		background: linear-gradient(145deg, rgba(241, 58, 55, 0.25), rgba(241, 58, 55, 0.12));
		border-color: rgba(241, 58, 55, 0.52);
	}

	.auth-form {
		display: grid;
		gap: 0.85rem;
	}

	.auth-form label {
		display: grid;
		gap: 0.45rem;
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.depth-button {
		position: relative;
		padding: 0.92rem 1rem;
		border: none;
		border-radius: 14px;
		font-weight: 700;
		letter-spacing: 0.01em;
		color: white;
		background: linear-gradient(165deg, #ff5a53, #de2e2e);
		box-shadow:
			0 12px 20px rgba(222, 46, 46, 0.35),
			0 6px 0 #8d1f1f,
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		cursor: pointer;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease;
	}

	.depth-button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow:
			0 16px 24px rgba(222, 46, 46, 0.42),
			0 8px 0 #8d1f1f,
			inset 0 1px 0 rgba(255, 255, 255, 0.25);
	}

	.depth-button:active:not(:disabled) {
		transform: translateY(4px);
		box-shadow:
			0 8px 14px rgba(222, 46, 46, 0.3),
			0 2px 0 #8d1f1f,
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.depth-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.notice,
	.error {
		margin: 0;
		padding: 0.72rem 0.85rem;
		border-radius: 12px;
		font-size: 0.9rem;
	}

	.notice {
		background: rgba(46, 204, 113, 0.12);
		border: 1px solid rgba(46, 204, 113, 0.35);
		color: #b8ffd5;
	}

	.error {
		background: rgba(241, 58, 55, 0.14);
		border: 1px solid rgba(241, 58, 55, 0.32);
		color: #ffc8c6;
	}

	.credentials-error {
		display: grid;
		gap: 0.7rem;
	}

	.credentials-error p {
		margin: 0;
	}

	.signup-link-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		padding: 0.5rem 0.8rem;
		border-radius: 10px;
		border: 1px solid rgba(241, 58, 55, 0.44);
		background: rgba(241, 58, 55, 0.2);
		color: #ffe6e5;
		text-decoration: none;
		font-weight: 700;
	}

	.signup-link-button:hover {
		background: rgba(241, 58, 55, 0.28);
	}

	.disclaimer {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.disclaimer p {
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.4;
		text-align: center;
		margin: 0;
	}

	.disclaimer a {
		color: #4ECDC4;
		text-decoration: none;
	}

	.disclaimer a:hover {
		text-decoration: underline;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 900px) {
		.auth-page {
			padding: 1rem;
		}

		.auth-shell {
			grid-template-columns: 1fr;
		}

		.feature-panel,
		.auth-panel {
			padding: 1.2rem;
		}
	}
</style>
