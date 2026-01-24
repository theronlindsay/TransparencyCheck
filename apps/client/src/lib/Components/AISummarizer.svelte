<script>
	import { browser } from '$app/environment';
	import { apiUrl } from '$lib/config.js';

	let { billNumber, billTitle, billText = '' } = $props();

	// State for all options $state allows any reference to the variable in the UI to dynamically update whenever the variable changes.
	let readingLevel = $state('general');
	let enableWebSearch = $state(false);
	let getOpinion = $state(false);
	let specificQuestion = $state('');
	let outputLength = $state(100);
	let generatedPrompt = $state('');
	let aiResponse = $state('');
	let showPrompt = $state(false);
	let isLoading = $state(false);
	
	// Validation errors from server
	let serverErrors = $state([]);
	
	// Chat state
	let conversationId = $state(null);
	let chatMessages = $state([]);
	let followUpQuestion = $state('');
	let isSendingFollowUp = $state(false);

	async function generatePrompt() {
		if (!browser) return; // Only run on client

		// Clear previous server errors
		serverErrors = [];

		isLoading = true;
		
		// Show spinner using classList
		const spinner = document.querySelector('.btn-primary .spinner');
		if (spinner) {
			spinner.classList.add('visible');
		}
		
		// Add loading state to form using classList
		const form = document.querySelector('.summarizer-form');
		if (form) {
			form.classList.add('processing');
		}
		
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

		// Add character limit
		if (outputLength) {
			prompt += `Please keep the summary under ${outputLength} words\n\n`;
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

		// Call API endpoint to send prompt to Node Server
		try {
			const requestBody = { prompt };
			
			// Add tools array if web search is enabled
			if (enableWebSearch) {
				requestBody.tools = [{ type: "web_search_preview" }];
			}
			
			const response = await fetch(apiUrl('/api/openAI'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				console.error('Failed to send prompt to server:', response.statusText);
				const errorData = await response.json();
				
				// Display server validation errors
				if (errorData.validationErrors) {
					serverErrors = errorData.validationErrors;
				} else {
					serverErrors = [errorData.error || 'Failed to generate summary'];
				}
				return;
			}

			const data = await response.json();

			if (data.success && data.response) {
				// API call succeeded, show the response
				aiResponse = data.response;
				conversationId = data.conversationId; // Save for follow-up questions
				
				// Add initial exchange to chat history
				chatMessages = [{
					role: 'user',
					content: 'Summarize this bill with the selected options'
				}, {
					role: 'assistant',
					content: data.response
				}];
				
				serverErrors = []; // Clear any errors
			} else {
				// If API succeeded but no response, keep showing the prompt
				console.warn('No response from AI');
				serverErrors = ['No response received from AI'];
			}
		} catch (error) {
			console.error('Error calling API endpoint:', error);
			serverErrors = ['Network error: ' + error.message];
		} finally {
			isLoading = false;
			showPrompt = true;
			
			// Hide spinner using classList
			const spinner = document.querySelector('.btn-primary .spinner');
			if (spinner) {
				spinner.classList.remove('visible');
			}
			
			// Remove loading state from form using classList
			const form = document.querySelector('.summarizer-form');
			if (form) {
				form.classList.remove('processing');
			}
			
			// Add success indicator to prompt display
			setTimeout(() => {
				const promptDisplay = document.querySelector('.prompt-display');
				if (promptDisplay) {
					promptDisplay.classList.add('visible');
				}
			}, 50);
		}
	}

	function resetForm() {
		readingLevel = 'general';
		enableWebSearch = false;
		getOpinion = false;
		specificQuestion = '';
		focusTopic = '';
		generatedPrompt = '';
		aiResponse = '';
		showPrompt = false;
		conversationId = null;
		chatMessages = [];
		outputLength = 100;
		
		// Remove visible class from prompt display
		const promptDisplay = document.querySelector('.prompt-display');
		if (promptDisplay) {
			promptDisplay.classList.remove('visible');
		}
	}
	
	// Send follow-up question in chat
	async function sendFollowUp() {
		if (!followUpQuestion.trim() || !conversationId || isSendingFollowUp) return;
		
		const question = followUpQuestion.trim();
		followUpQuestion = '';
		isSendingFollowUp = true;
		
		// Add user message to chat
		chatMessages = [...chatMessages, { role: 'user', content: question }];
		
		try {
			const requestBody = { 
				prompt: question,
				conversationId: conversationId
			};
			
			// Add tools if web search was enabled
			if (enableWebSearch) {
				requestBody.tools = [{ type: "web_search_preview" }];
			}
			
			const response = await fetch(apiUrl('/api/openAI'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});
			
			const data = await response.json();
			
			if (data.success && data.response) {
				// Update conversation ID and add response to chat
				conversationId = data.conversationId;
				chatMessages = [...chatMessages, { role: 'assistant', content: data.response }];
				aiResponse = data.response; // Update main response too
			} else {
				chatMessages = [...chatMessages, { 
					role: 'error', 
					content: data.error || 'Failed to get response' 
				}];
			}
		} catch (error) {
			chatMessages = [...chatMessages, { 
				role: 'error', 
				content: 'Network error: ' + error.message 
			}];
		} finally {
			isSendingFollowUp = false;
			
			// Scroll chat to bottom
			setTimeout(() => {
				const chatContainer = document.querySelector('.chat-messages');
				if (chatContainer) {
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}
			}, 50);
		}
	}
	
	function handleChatKeydown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendFollowUp();
		}
	}
	
	// Add interactive highlighting using classList
	function handleFocus(event) {
		const formGroup = event.target.closest('.form-group');
		if (formGroup) {
			formGroup.classList.add('focused');
		}
	}
	
	function handleBlur(event) {
		const formGroup = event.target.closest('.form-group');
		if (formGroup) {
			formGroup.classList.remove('focused');
		}
	}
	
	function handleCheckboxToggle(event) {
		const checkboxGroup = event.target.closest('.checkbox-group');
		if (checkboxGroup) {
			// Toggle active state based on checkbox
			if (event.target.checked) {
				checkboxGroup.classList.add('active');
			} else {
				checkboxGroup.classList.remove('active');
			}
		}
	}
</script>

<div class="ai-summarizer">
	<div class="summarizer-header">
		<h3>AI Bill Summarizer</h3>
    </div>

	<div class="summarizer-form">
		<!-- Reading Level Selector -->
		<div class="form-group">
			<label for="reading-level" class="text-label">Reading Level</label>
			<select 
				id="reading-level" 
				bind:value={readingLevel} 
				class="select-input"
				onfocus={handleFocus}
				onblur={handleBlur}
			>
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
				<input 
					type="checkbox" 
					bind:checked={enableWebSearch}
					onchange={handleCheckboxToggle}
				/>
				<span class="checkbox-text">
					<span class="checkbox-title">Enable Web Search</span>
					<span class="checkbox-description">Include recent news and analysis</span>
				</span>
			</label>
		</div>

		<!-- Opinion/Implications Checkbox -->
		<div class="form-group checkbox-group">
			<label class="checkbox-label">
				<input 
					type="checkbox" 
					bind:checked={getOpinion}
					onchange={handleCheckboxToggle}
				/>
				<span class="checkbox-text">
					<span class="checkbox-title">Analyze Implications</span>
					<span class="checkbox-description">Get AI's analysis of potential impacts</span>
				</span>
			</label>
		</div>

		<!-- Specific Question -->
		<div class="form-group">
			<label for="specific-question" class="text-label">
				Ask a Specific Question
				<span class="char-count">{specificQuestion.length}/500</span>
			</label>
			<textarea
				id="specific-question"
				bind:value={specificQuestion}
				placeholder="e.g., How does this bill affect small businesses?"
				class="textarea-input"
				rows="3"
				maxlength="500"
				onfocus={handleFocus}
				onblur={handleBlur}
			></textarea>
		</div>

		<!-- Focus Topic -->
		<!-- <div class="form-group">
			<label for="focus-topic" class="text-label">
				Focus on a Topic(s)
				<span class="char-count">{focusTopic.length}/200</span>
			</label>
			<input
				id="focus-topic"
				type="text"
				bind:value={focusTopic}
				placeholder="e.g., environmental impact, healthcare, taxation"
				class="text-input"
				maxlength="200"
				onfocus={handleFocus}
				onblur={handleBlur}
			/>
		</div> -->

		<div class="form-group">
			<label for="output-length" class="text-label">
				Summary Length (words)
				<span class="char-count">{outputLength}</span>
			</label>
			<input
				id="output-length"
				type="range"
				min="50"
				max="600"
				step="50"
				bind:value={outputLength}
				class="range-input"
				onfocus={handleFocus}
				onblur={handleBlur}
			/>
			<input
				type="number"
				min="50"
				max="600"
				bind:value={outputLength}
				class="text-input output-length-input"
				onfocus={handleFocus}
				onblur={handleBlur}
			/>

		</div>

		<!-- Action Buttons -->
		<div class="action-buttons">
			{#if serverErrors.length > 0}
				<div class="error-banner">
					<span class="error-icon">⚠️</span>
					<div class="error-list">
						{#each serverErrors as error}
							<div>{error}</div>
						{/each}
					</div>
				</div>
			{/if}
			<button onclick={generatePrompt} disabled={isLoading} class="btn btn-primary">
				<span class="spinner"></span>
				<span class="button-text">{isLoading ? 'Generating...' : 'Summarize'}</span>
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
					<h4>{aiResponse ? 'AI Summary' : 'Generated Prompt'}</h4>
					<button
						onclick={() => {
							navigator.clipboard.writeText(aiResponse || generatedPrompt);
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
					<pre>{aiResponse || generatedPrompt}</pre>
				</div>
				
				<!-- Chat Interface for Follow-up Questions -->
				{#if conversationId}
					<div class="chat-section">
						<div class="chat-header">
							<h5>💬 Ask Follow-up Questions</h5>
						</div>
						
						<div class="chat-messages">
							{#each chatMessages.slice(2) as message}
								<div class="chat-message {message.role}">
									{#if message.role === 'user'}
										<div class="message-label">You</div>
									{:else if message.role === 'assistant'}
										<div class="message-label">AI</div>
									{:else}
										<div class="message-label">Error</div>
									{/if}
									<div class="message-content">
										<pre>{message.content}</pre>
									</div>
								</div>
							{/each}
							
							{#if isSendingFollowUp}
								<div class="chat-message assistant loading">
									<div class="message-label">AI</div>
									<div class="message-content">
										<div class="typing-indicator">
											<span></span>
											<span></span>
											<span></span>
										</div>
									</div>
								</div>
							{/if}
						</div>
						
						<div class="chat-input-area">
							<textarea
								bind:value={followUpQuestion}
								placeholder="Ask a follow-up question..."
								class="chat-input"
								rows="2"
								maxlength="1000"
								onkeydown={handleChatKeydown}
								disabled={isSendingFollowUp}
							></textarea>
							<button 
								onclick={sendFollowUp} 
								disabled={!followUpQuestion.trim() || isSendingFollowUp}
								class="btn btn-send"
								title="Send message"
							>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<line x1="22" y1="2" x2="11" y2="13"></line>
									<polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
								</svg>
							</button>
						</div>
					</div>
				{/if}
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
		margin-left: 1em;
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
	
	.text-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	
	.char-count {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 400;
		margin-left: auto;
	}
	
	.error-banner {
		width: 100%;
		padding: 0.75rem 1rem;
		background: rgba(255, 107, 107, 0.1);
		border: 1px solid rgba(255, 107, 107, 0.3);
		border-radius: var(--radius-md);
		color: #ff6b6b;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
		animation: slideDown 0.3s ease-out;
	}
	
	.error-list {
		flex: 1;
	}
	
	.error-list div {
		margin: 0.25rem 0;
	}
	
	.error-icon {
		font-size: 1.2rem;
		flex-shrink: 0;
	}
	
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
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

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary:disabled:hover {
		transform: none;
		box-shadow: none;
	}

	/* Spinner styles */
	.spinner {
		display: none;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	
	.btn-primary :global(.spinner.visible) {
		display: inline-block;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Interactive state styles using classList */
	.form-group :global(.focused) {
		background: rgba(241, 58, 55, 0.05);
		border-radius: var(--radius-md);
		padding: 0.5rem;
		margin: -0.5rem;
		transition: all 0.3s ease;
	}

	.checkbox-group :global(.active) {
		background: rgba(241, 58, 55, 0.15);
		border-color: rgba(241, 58, 55, 0.5);
		box-shadow: 0 0 0 2px rgba(241, 58, 55, 0.1);
	}

	.summarizer-form :global(.processing) {
		opacity: 0.7;
		pointer-events: none;
		position: relative;
	}

	.summarizer-form :global(.processing)::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent, rgba(241, 58, 55, 0.1), transparent);
		animation: shimmer 2s infinite;
	}

	@keyframes shimmer {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	.prompt-display :global(.visible) {
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
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
		width: 12px;
	}

	.prompt-content::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 6px;
	}

	.prompt-content::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 6px;
	}

	.prompt-content::-webkit-scrollbar-thumb:hover {
		background: var(--accent);
	}

	/* Chat Section Styles */
	.chat-section {
		margin-top: 1rem;
		border-top: 1px solid var(--border-color);
		padding-top: 1rem;
	}

	.chat-header {
		margin-bottom: 0.75rem;
	}

	.chat-header h5 {
		margin: 0;
		font-size: 0.95rem;
		color: var(--text-primary);
		font-weight: 600;
	}

	.chat-messages {
		max-height: 300px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}

	.chat-message {
		padding: 0.75rem;
		border-radius: var(--radius-md);
		animation: fadeIn 0.3s ease-out;
	}

	.chat-message.user {
		background: rgba(var(--accent-rgb, 241, 58, 55), 0.1);
		border-left: 3px solid var(--accent);
	}

	.chat-message.assistant {
		background: rgba(255, 255, 255, 0.05);
		border-left: 3px solid var(--text-secondary);
	}

	.chat-message.error {
		background: rgba(255, 107, 107, 0.1);
		border-left: 3px solid #ff6b6b;
	}

	.message-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
		color: var(--text-secondary);
	}

	.message-content {
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.message-content pre {
		margin: 0;
		font-family: inherit;
		font-size: inherit;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.typing-indicator {
		display: flex;
		gap: 4px;
		padding: 0.5rem 0;
	}

	.typing-indicator span {
		width: 8px;
		height: 8px;
		background: var(--text-secondary);
		border-radius: 50%;
		animation: bounce 1.4s infinite ease-in-out both;
	}

	.typing-indicator span:nth-child(1) {
		animation-delay: -0.32s;
	}

	.typing-indicator span:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes bounce {
		0%, 80%, 100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.chat-input-area {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
		align-items: flex-end;
	}

	.chat-input {
		flex: 1;
		padding: 0.75rem;
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-size: 0.9rem;
		resize: none;
		transition: border-color 0.2s;
	}

	.chat-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.chat-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-send {
		padding: 0.75rem;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn-send:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(241, 58, 55, 0.3);
	}

	.btn-send:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.chat-messages::-webkit-scrollbar {
		width: 8px;
	}

	.chat-messages::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 4px;
	}

	.chat-messages::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 4px;
	}
</style>
