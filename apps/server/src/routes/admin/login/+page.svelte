<script>
	export let data;
	export let form;
</script>

<svelte:head>
	<title>Admin Login</title>
</svelte:head>

<div class="login-shell">
	<section class="login-card">
		<p class="eyebrow">TransparencyCheck</p>
		<h1>Admin Access</h1>
		<p class="copy">
			This panel is restricted to the admin subdomain and requires the password from the server
			environment.
		</p>

		{#if !data.passwordConfigured}
			<p class="error">`ADMIN_PANEL_PASSWORD` is not configured on the server.</p>
		{:else}
			<form method="POST">
				<label for="password">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
				<button type="submit">Enter Admin Panel</button>
			</form>
		{/if}

		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}
	</section>
</div>

<style>
	.login-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 24px;
	}

	.login-card {
		width: min(440px, 100%);
		padding: 32px;
		border-radius: 28px;
		background: var(--admin-surface-strong);
		border: 1px solid var(--admin-border);
		box-shadow:
			0 24px 80px rgba(0, 0, 0, 0.28),
			inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}

	.eyebrow {
		margin: 0 0 10px;
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: var(--admin-muted);
	}

	h1 {
		margin: 0 0 12px;
		font-size: 2rem;
	}

	.copy {
		margin: 0 0 24px;
		color: var(--admin-muted);
		line-height: 1.5;
	}

	form {
		display: grid;
		gap: 12px;
	}

	label {
		font-weight: 600;
	}

	input {
		padding: 14px 16px;
		border-radius: 14px;
		border: 1px solid var(--admin-border);
		font: inherit;
		background: rgba(0, 30, 38, 0.5);
		color: var(--admin-text);
	}

	button {
		padding: 14px 16px;
		border: 0;
		border-radius: 14px;
		font: inherit;
		font-weight: 700;
		background: linear-gradient(135deg, var(--admin-accent), var(--admin-accent-strong));
		color: #f2fbfd;
		cursor: pointer;
	}

	.error {
		margin: 16px 0 0;
		padding: 12px 14px;
		border-radius: 14px;
		background: var(--admin-danger-bg);
		color: var(--admin-danger-text);
	}
</style>
