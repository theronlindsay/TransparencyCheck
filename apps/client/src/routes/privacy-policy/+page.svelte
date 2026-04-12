<svelte:head>
	<title>Privacy Policy | TransparencyCheck</title>
</svelte:head>

<section class="privacy-container">
	<div class="content-card">
		<h1>Privacy Policy</h1>
		<p class="last-updated">Last Updated: April 11, 2026</p>

		<div class="prose">
			<h2>1. Information We Collect</h2>
			<p>
				TransparencyCheck collects the following types of information to provide you with a
				comprehensive experience:
			</p>
			<ul>
				<li>
					<strong>Account Data:</strong> When you create an account, we collect your email address, name
					(optional), and authentication credentials.
				</li>
				<li>
					<strong>Usage Data:</strong> We use PostHog analytics (only if you consent) to understand how
					you navigate the application.
				</li>
				<li>
					<strong>Saved Data:</strong> Bills, politicians, and alerts you choose to save and track are
					stored in our systems.
				</li>
			</ul>

			<h2>2. General Data Protection Regulation (GDPR) Compliance</h2>
			<p>We are fully committed to GDPR compliancy. You have the right to:</p>
			<ul>
				<li>Request a comprehensive export of all your personal data.</li>
				<li>Request immediate deletion of your account and all associated records.</li>
				<li>Opt-out or opt-in to optional cookies and tracking pixels.</li>
			</ul>

			<h2>3. Third-party APIs and Artificial Intelligence</h2>
			<p>
				In order to summarize legislation and query data, we map prompts and bill text to Large
				Language Models (LLMs) such as OpenAI and OpenRouter. We <strong>do not</strong> send your personal
				account information or email address to these third-party AI systems.
			</p>

			<h2>4. Contact Us</h2>
			<p>
				If you have any questions or concern about our Privacy Policy or your data, please contact
				us from your account dashboard or email support@transparencycheck.org.
			</p>
		</div>
	</div>
</section>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

	.privacy-container {
		font-family: var(--font-family);
		color: var(--text-primary);
		max-width: 900px;
		margin: 0 auto;
		padding: 4rem 2rem;
		min-height: 80vh;
	}

	.content-card {
		background: var(--bg-elevated);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 3rem 4rem;
		backdrop-filter: var(--blur);
		box-shadow: var(--shadow-soft);
	}

	@media (max-width: 768px) {
		.content-card {
			padding: 2rem 1.5rem;
		}
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	.last-updated {
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin-bottom: 2.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.prose h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--accent);
		margin-top: 2.5rem;
		margin-bottom: 1rem;
	}

	.prose p {
		line-height: 1.7;
		margin-bottom: 1.5rem;
		color: var(--text-secondary);
	}

	.prose ul {
		margin-bottom: 1.5rem;
		padding-left: 1.5rem;
	}

	.prose li {
		margin-bottom: 0.8rem;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.prose strong {
		color: var(--text-primary);
	}
</style>
