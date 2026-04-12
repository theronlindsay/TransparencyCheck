<svelte:head>
	<title>Our Data Sources | TransparencyCheck</title>
</svelte:head>

<section class="sources-container">
	<div class="header">
		<h1>Where does our data come from?</h1>
		<p>
			A core part of TransparencyCheck is open access to information. Here are all the APIs and data
			sources we aggregate to provide clear insights into US policy.
		</p>
	</div>

	<div class="grid">
		<div class="source-card">
			<div class="icon">🏛️</div>
			<h2>ProPublica API</h2>
			<p>
				Provides robust metadata on Congress members, recent voting histories, and session
				schedules.
			</p>
			<a
				href="https://projects.propublica.org/api-docs/congress-api/"
				target="_blank"
				rel="noreferrer">View ProPublica Docs</a
			>
		</div>

		<div class="source-card">
			<div class="icon">📜</div>
			<h2>Congress.gov API</h2>
			<p>
				The primary source for all legislative text, formatted bill documents (PDF/XML), and daily
				action timelines directly from the Library of Congress.
			</p>
			<a href="https://api.congress.gov/" target="_blank" rel="noreferrer">View Congress.gov Docs</a
			>
		</div>

		<div class="source-card">
			<div class="icon">💰</div>
			<h2>OpenFEC</h2>
			<p>
				The Federal Election Commission API provides real-time access to campaign finance data,
				donor tracking, and PAC contributions to politicians.
			</p>
			<a href="https://api.open.fec.gov/developers/" target="_blank" rel="noreferrer"
				>View FEC Docs</a
			>
		</div>

		<div class="source-card">
			<div class="icon">📈</div>
			<h2>Quiver Quantitative / Stock APIs</h2>
			<p>
				Aggregates financial disclosures under the STOCK Act to track the trading activity of
				representatives and senators.
			</p>
			<a href="https://api.quiverquant.com/" target="_blank" rel="noreferrer"
				>View Quiver API Docs</a
			>
		</div>

		<div class="source-card">
			<div class="icon">🧠</div>
			<h2>OpenRouter & OpenAI</h2>
			<p>
				We use state-of-the-art Generative AI to parse 20,000+ word documents into readable
				summaries. Our free tier utilizes Gemma through OpenRouter, while our Pro tier uses GPT-5
				models.
			</p>
			<a href="https://openrouter.ai/" target="_blank" rel="noreferrer">View OpenRouter</a>
		</div>
	</div>
</section>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Inter:wght@400;500&display=swap');

	.sources-container {
		font-family: var(--font-family);
		max-width: 1100px;
		margin: 0 auto;
		padding: 4rem 2rem;
		color: var(--text-primary);
	}

	.header {
		text-align: center;
		margin-bottom: 4rem;
		max-width: 700px;
		margin-left: auto;
		margin-right: auto;
	}

	.header h1 {
		font-size: 3rem;
		font-weight: 800;
		margin-bottom: 1rem;
		color: var(--text-primary);
	}

	.header p {
		font-size: 1.15rem;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
	}

	.source-card {
		background: var(--bg-elevated);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 2.5rem;
		transition:
			transform var(--transition-base),
			border-color var(--transition-base);
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-soft);
	}

	.source-card:hover {
		transform: translateY(-5px);
		border-color: rgba(241, 58, 55, 0.4);
	}

	.icon {
		font-size: 2.5rem;
		margin-bottom: 1rem;
	}

	.source-card h2 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 1rem;
		color: var(--text-primary);
	}

	.source-card p {
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 1.5rem;
		flex-grow: 1;
	}

	.source-card a {
		color: var(--accent);
		text-decoration: none;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.source-card a:hover {
		text-decoration: underline;
	}
</style>
