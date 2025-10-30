<script>
	let { billNumber, billTitle, billText = '' } = $props();

	// State for all options $state allows any reference to the variable in the UI to dynamically update whenever the variable changes.
	let readingLevel = $state('general');
	let enableWebSearch = $state(false);
	let getOpinion = $state(false);
	let specificQuestion = $state('');
	let focusTopic = $state('');
	let generatedPrompt = $state('');
	let showPrompt = $state(false);

	function generatePrompt() {
		let prompt = `Please summarize bill ${billNumber}\n\n`;

		prompt += `Follow these parameters in your summary:\n\n`;

		// Reading Level Dictionary
		const readingLevels = {
			'elementary': 'Explain this at an elementary school reading level (ages 6-10), using very simple words and short sentences.',
			'middle-school': 'Explain this at a middle school reading level (ages 11-13), using clear and straightforward language.',
			'high-school': 'Explain this at a high school reading level (ages 14-18), using accessible but more sophisticated language.',
			'general': 'Explain this for a general adult audience with clear, professional language.',
			'expert': 'Provide a detailed, technical summary for someone with expertise in policy and legislation.'
		};
		prompt += `Reading Level: ${readingLevels[readingLevel]}\n\n`;

		// Add web search option
		if (enableWebSearch) {
			prompt += `Web Search Enabled: (I believe this is a parameter to put into the API request but it goes here for now)\n\n`;
		}

		// Add opinion/implications
		if (getOpinion) {
			prompt += 'Provide Analysis: Please provide your analysis of the potential implications of this bill, including:\n';
			prompt += `- Potential positive impacts\n`;
			prompt += `- Potential negative impacts\n`;
			prompt += `- Groups or industries that may be affected\n`;
			prompt += `- Economic, social, or political considerations\n\n`;
		}

		// Add specific question
		if (specificQuestion.trim()) {
			prompt += `Make sure to answer the following question: ${specificQuestion.trim()}\n\n`;
		}

		// Add focus topic
		if (focusTopic.trim()) {
			prompt += `Focus: Please focus specifically on aspects related to: ${focusTopic.trim()}\n\n`;
		}

		prompt += `Please provide a comprehensive yet concise summary that addresses all the points above. `;

        // Add the bill text if available
		if (billText && billText.trim()) {
			// Strip HTML tags for cleaner prompt
			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = billText;
			let plainText = tempDiv.textContent || tempDiv.innerText || '';
			
			// Remove everything before and including <DOC>
			const docIndex = plainText.indexOf('<DOC>');
			if (docIndex !== -1) {
				plainText = plainText.substring(docIndex + 5); // +5 to skip "<DOC>"
			}
			
			prompt += `Bill Text:\n${plainText.trim()}\n\n---\n\n`;
		}

		generatedPrompt = prompt;
		showPrompt = true;
	}

	function resetForm() {
		readingLevel = 'general';
		enableWebSearch = false;
		getOpinion = false;
		specificQuestion = '';
		focusTopic = '';
		generatedPrompt = '';
		showPrompt = false;
	}
</script>

<div class="ai-summarizer">
	<div class="summarizer-header">
		<h3>AI Bill Summarizer</h3>
    </div>

	<div class="summarizer-form">
		<!-- Reading Level Selector -->
		<div class="form-group">
			<label for="reading-level">Reading Level</label>
			<select id="reading-level" bind:value={readingLevel} class="select-input">
				<option value="elementary">Elementary School</option>
				<option value="middle-school">Middle School</option>
				<option value="high-school">High School</option>
				<option value="general">General Adult</option>
				<option value="expert">Expert/Technical</option>
			</select>
		</div>

		<!-- Web Search Toggle -->
		<div class="form-group checkbox-group">
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={enableWebSearch} />
				<span class="checkbox-text">
					<span class="checkbox-title">Enable Web Search</span>
					<span class="checkbox-description">Include recent news and analysis</span>
				</span>
			</label>
		</div>

		<!-- Opinion/Implications Checkbox -->
		<div class="form-group checkbox-group">
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={getOpinion} />
				<span class="checkbox-text">
					<span class="checkbox-title">Analyze Implications</span>
					<span class="checkbox-description">Get AI's analysis of potential impacts</span>
				</span>
			</label>
		</div>

		<!-- Specific Question -->
		<div class="form-group">
			<label for="specific-question">Ask a Specific Question</label>
			<textarea
				id="specific-question"
				bind:value={specificQuestion}
				placeholder="e.g., How does this bill affect small businesses?"
				class="textarea-input"
				rows="3"
			></textarea>
		</div>

		<!-- Focus Topic -->
		<div class="form-group">
			<label for="focus-topic">Focus on a Topic(s)</label>
			<input
				id="focus-topic"
				type="text"
				bind:value={focusTopic}
				placeholder="e.g., environmental impact, healthcare, taxation"
				class="text-input"
			/>
		</div>

		<!-- Action Buttons -->
		<div class="action-buttons">
			<button onclick={generatePrompt} class="btn btn-primary">
				Summarize
			</button>
			{#if showPrompt}
				<button onclick={resetForm} class="btn btn-secondary">
					🔄️Reset
				</button>
			{/if}
		</div>

		<!-- Generated Prompt Display -->
		{#if showPrompt}
			<div class="prompt-display">
				<div class="prompt-header">
					<h4>Generated Prompt</h4>
					<button
						onclick={() => {
							navigator.clipboard.writeText(generatedPrompt);
						}}
						class="btn btn-copy"
						title="Copy to clipboard"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
						</svg>
						Copy
					</button>
				</div>
				<div class="prompt-content">
					<pre>{generatedPrompt}</pre>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.ai-summarizer {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		height: fit-content;
	}

	.summarizer-header {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid var(--border-color);
	}

	.summarizer-header h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.4rem;
		color: var(--text-primary);
		font-weight: 700;
	}

	.header-description {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.summarizer-form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
		letter-spacing: 0.02em;
	}

	.select-input {
		padding: 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.95rem;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.select-input option {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		padding: 0.5rem;
	}

	.select-input:hover {
		border-color: var(--accent);
	}

	.select-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(241, 58, 55, 0.1);
	}

	.text-input,
	.textarea-input {
		padding: 0.75rem;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.95rem;
		font-family: inherit;
		transition: all 0.2s ease;
		resize: vertical;
	}

	.text-input:hover,
	.textarea-input:hover {
		border-color: var(--accent);
	}

	.text-input:focus,
	.textarea-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(241, 58, 55, 0.1);
	}

	.text-input::placeholder,
	.textarea-input::placeholder {
		color: var(--text-secondary);
		opacity: 0.6;
	}

	.checkbox-group {
		padding: 0.75rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		transition: all 0.2s ease;
	}

	.checkbox-group:hover {
		border-color: var(--border-color);
		background: rgba(0, 0, 0, 0.3);
	}

	.checkbox-label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		cursor: pointer;
		user-select: none;
	}

	.checkbox-label input[type="checkbox"] {
		margin-top: 0.2rem;
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: var(--accent);
		flex-shrink: 0;
	}

	.checkbox-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.checkbox-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.checkbox-description {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.action-buttons {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		border: none;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		flex: 1;
	}

	.btn-primary {
		background: var(--accent);
		color: white;
	}

	.btn-primary:hover {
		background: #ff5b58;
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(241, 58, 55, 0.4);
	}

	.btn-secondary {
		background: rgba(241, 58, 55, 0.1);
		color: var(--text-primary);
		border: 1px solid rgba(241, 58, 55, 0.3);
	}

	.btn-secondary:hover {
		background: rgba(241, 58, 55, 0.2);
		border-color: rgba(241, 58, 55, 0.5);
		transform: translateY(-2px);
	}

	.btn-copy {
		padding: 0.5rem;
		background: rgba(241, 58, 55, 0.1);
		color: var(--text-primary);
		border: 1px solid rgba(241, 58, 55, 0.3);
		flex: 0;
	}

	.btn-copy:hover {
		background: var(--accent);
		color: white;
	}

	.prompt-display {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		overflow: hidden;
		margin-top: 0.5rem;
	}

	.prompt-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.2);
		border-bottom: 1px solid var(--border-color);
	}

	.prompt-header h4 {
		margin: 0;
		font-size: 1rem;
		color: var(--text-primary);
		font-weight: 600;
	}

	.prompt-content {
		padding: 1rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.prompt-content pre {
		margin: 0;
		font-family: 'Courier New', Courier, monospace;
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--text-primary);
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	/* Scrollbar styling */
	.prompt-content::-webkit-scrollbar {
		width: 8px;
	}

	.prompt-content::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 4px;
	}

	.prompt-content::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 4px;
	}

	.prompt-content::-webkit-scrollbar-thumb:hover {
		background: var(--accent);
	}
</style>
