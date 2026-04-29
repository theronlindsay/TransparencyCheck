<script>
	import { apiUrl } from '$lib/config.js';
	import AISummarizer from '$lib/Components/AISummarizer.svelte';

	let {
		isOpen = false,
		context = {
			pageType: 'generic',
			pageLabel: 'Current Page',
			data: {},
			dataSources: [],
			suggestions: []
		},
		onClose = () => {}
	} = $props();

	function getIntroMessage(pageLabel) {
		return {
			id: 'intro',
			role: 'assistant',
			type: 'text',
			content: `Hi, I am your page-aware assistant for ${pageLabel}. Ask a question about what you are viewing.`
		};
	}

	let messages = $state([getIntroMessage('this page')]);
	let inputMessage = $state('');
	let isSending = $state(false);
	let conversationId = $state(null);
	let hasSummarizedBill = $state(false);
	let showSummarizerConfigurator = $state(false);
	let lastContextKey = $state('');
	const MAX_BILL_TEXT_CONTEXT_CHARS = 12000;
	const DEFAULT_TOOLS = [{ type: 'web_search_preview' }];

	const canSuggestSummarizer = $derived(
		context.pageType === 'bill' &&
			Array.isArray(context.suggestions) &&
			context.suggestions.some((item) => item.action === 'open-summarizer')
	);

	function addMessage(message) {
		messages = [...messages, { id: crypto.randomUUID(), ...message }];
	}

	function handleSummarizerSuggestion() {
		if (showSummarizerConfigurator) return;
		showSummarizerConfigurator = true;
	}

	async function handleSummarizerReady(result) {
		showSummarizerConfigurator = false;
		hasSummarizedBill = true;

		const prompt = result?.prompt?.trim();
		if (!prompt) {
			addMessage({
				role: 'assistant',
				type: 'text',
				content: 'I could not build a summary prompt. Please try again.'
			});
			return;
		}

		await submitQuestion(prompt, {
			displayQuestion: result?.userMessage || 'Summarize this bill with the selected options.',
			tools: result?.enableWebSearch ? [{ type: 'web_search_preview' }] : undefined
		});
	}

	function buildContextPrompt(question) {
		const sources = (context.dataSources || [])
			.map((source) => `- ${source.id}: ${source.description}`)
			.join('\n');
		const billInfo =
			context.pageType === 'bill'
				? `Bill: ${context.data?.billNumber || 'Unknown'}\nTitle: ${context.data?.billTitle || 'Unknown'}`
				: '';
		const billText = context.pageType === 'bill' ? (context.data?.billText || '').trim() : '';
		const billTextForContext = billText ? billText.slice(0, MAX_BILL_TEXT_CONTEXT_CHARS) : '';
		const billTextContext = billTextForContext
			? `Bill text context${billText.length > MAX_BILL_TEXT_CONTEXT_CHARS ? ' (truncated)' : ''}:\n${billTextForContext}`
			: 'Bill text context not available.';

		return [
			'You are an assistant embedded in Transparency Check.',
			`Current page type: ${context.pageType}`,
			`Current page label: ${context.pageLabel}`,
			sources ? `Available page data sources:\n${sources}` : 'No page data sources provided.',
			billInfo,
			billTextContext,
			`User question: ${question}`
		]
			.filter(Boolean)
			.join('\n\n');
	}

	async function submitQuestion(question, options = {}) {
		if (!question?.trim() || isSending) return;

		const { displayQuestion = question, tools = DEFAULT_TOOLS } = options;

		isSending = true;

		addMessage({ role: 'user', type: 'text', content: displayQuestion });

		try {
			const requestBody = {
				prompt: buildContextPrompt(question),
				conversationId
			};

			const mergedTools = Array.isArray(tools)
				? [...DEFAULT_TOOLS, ...tools.filter((tool) => tool?.type !== 'web_search_preview')]
				: DEFAULT_TOOLS;
			requestBody.tools = mergedTools;

			const response = await fetch(apiUrl('/api/openAI'), {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});
			const data = await response.json();

			if (data?.success && data?.response) {
				conversationId = data.conversationId || conversationId;
				addMessage({ role: 'assistant', type: 'text', content: data.response });
			} else {
				addMessage({
					role: 'assistant',
					type: 'text',
					content: data?.error || 'I could not answer that right now. Please try again.'
				});
			}
		} catch (error) {
			addMessage({
				role: 'assistant',
				type: 'text',
				content: `Network issue: ${error.message}`
			});
		} finally {
			isSending = false;
		}
	}

	async function sendMessage(event) {
		event?.preventDefault();
		if (!inputMessage.trim() || isSending) return;

		const question = inputMessage.trim();
		inputMessage = '';
		await submitQuestion(question);
	}

	function handleInputKeydown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	$effect(() => {
		const contextKey = `${context.sourceId || 'none'}:${context.pathname || 'none'}`;
		if (!contextKey) return;

		if (lastContextKey === '') {
			messages = [getIntroMessage(context.pageLabel || 'this page')];
			lastContextKey = contextKey;
			return;
		}

		if (contextKey !== lastContextKey) {
			messages = [getIntroMessage(context.pageLabel || 'this page')];
			inputMessage = '';
			conversationId = null;
			hasSummarizedBill = false;
			showSummarizerConfigurator = false;
			isSending = false;
			lastContextKey = contextKey;
		}
	});
</script>

{#if isOpen}
	<div class="assistant-panel" role="dialog" aria-label="AI Assistant Popup">
		<header class="panel-header">
			<div>
				<p class="eyebrow">{context.pageLabel}</p>
				<h3>AI Assistant</h3>
			</div>
			<button
				class="close-button"
				type="button"
				onpointerdown={(event) => event.stopPropagation()}
				onclick={(event) => {
					event.stopPropagation();
					onClose();
				}}
				aria-label="Close AI assistant"
			>
				✖
			</button>
		</header>

		<div class="messages">
			{#each messages as message (message.id)}
				<div class={`message ${message.role}`}>
					<p>{message.content}</p>
				</div>
			{/each}
		</div>

		<div class="input-area">
			{#if canSuggestSummarizer && !hasSummarizedBill && !showSummarizerConfigurator}
				<button class="suggestion" type="button" onclick={handleSummarizerSuggestion}>
					✨ Summarize this bill
				</button>
			{/if}

			{#if canSuggestSummarizer && showSummarizerConfigurator}
				<div class="summarizer-card-window">
					<AISummarizer
						billNumber={context.data?.billNumber || ''}
						billTitle={context.data?.billTitle || ''}
						billText={context.data?.billText || ''}
						embedded={true}
						onSummaryReady={handleSummarizerReady}
					/>
				</div>
			{/if}

			<form class="chat-form" onsubmit={sendMessage}>
				<textarea
					bind:value={inputMessage}
					placeholder="Ask about this page..."
					onkeydown={handleInputKeydown}
					disabled={isSending}
				></textarea>
				<button class="send" type="submit" disabled={isSending || !inputMessage.trim()}>
					{isSending ? '...' : 'Send'}
				</button>
			</form>
		</div>
	</div>
{/if}

<style>
	.assistant-panel {
		position: fixed;
		right: 1rem;
		bottom: calc(156px + env(safe-area-inset-bottom));
		width: min(430px, calc(100vw - 2rem));
		height: min(72vh, 760px);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		background: linear-gradient(160deg, rgba(18, 20, 24, 0.99), rgba(12, 14, 18, 0.99));
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 20px;
		z-index: 129;
		box-shadow:
			0 24px 44px rgba(0, 0, 0, 0.42),
			0 38px 72px rgba(0, 0, 0, 0.24),
			inset 0 1px 0 rgba(255, 255, 255, 0.12);
		overflow: hidden;
		isolation: isolate;
	}

	.assistant-panel::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(160deg, rgba(18, 20, 24, 0.985), rgba(12, 14, 18, 0.985));
		z-index: 0;
	}

	.assistant-panel > * {
		position: relative;
		z-index: 1;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(241, 58, 55, 0.9);
	}

	h3 {
		margin: 0.15rem 0 0;
		font-size: 1.06rem;
	}

	.close-button {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		color: var(--text-primary);
		width: 2.35rem;
		height: 2.35rem;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex: 0 0 auto;
		position: relative;
		z-index: 2;
	}

	.messages {
		overflow-y: auto;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		min-height: 0;
		overscroll-behavior: contain;
	}

	.message {
		align-self: flex-start;
		display: block;
		flex: 0 0 auto;
		width: auto;
		max-width: 92%;
		height: auto;
		min-height: 0;
		padding: 0.7rem 0.82rem;
		border-radius: 13px;
		font-size: 0.92rem;
		line-height: 1.45;
		box-sizing: border-box;
	}

	.message p {
		margin: 0;
		display: block;
		color: inherit;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.message.assistant {
		background: rgba(28, 32, 40, 0.94);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	.message.user {
		background: rgba(120, 23, 22, 0.94);
		border: 1px solid rgba(241, 58, 55, 0.35);
		color: #ffe6e5;
		align-self: flex-end;
	}

	.input-area {
		padding: 0.8rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		display: grid;
		gap: 0.55rem;
		background: rgba(10, 12, 16, 0.97);
	}

	.suggestion {
		justify-self: start;
		padding: 0.45rem 0.8rem;
		border-radius: 999px;
		border: 1px solid rgba(241, 58, 55, 0.45);
		background: rgba(241, 58, 55, 0.15);
		color: #ffd8d7;
		font-weight: 700;
		cursor: pointer;
	}

	.summarizer-card-window {
		max-height: 52vh;
		overflow: auto;
		padding: 0.35rem;
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.02);
	}

	.chat-form {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
	}

	textarea {
		min-height: 48px;
		max-height: 150px;
		resize: vertical;
	}

	.send {
		padding: 0.6rem 0.9rem;
		border: 0;
		border-radius: 12px;
		font-weight: 700;
		cursor: pointer;
		color: #fff;
		background: linear-gradient(165deg, #ff5a53, #de2e2e);
	}

	.send:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.assistant-panel {
			right: 0.8rem;
			bottom: calc(148px + env(safe-area-inset-bottom));
			width: calc(100vw - 1.2rem);
			height: min(68vh, 680px);
		}
	}
</style>
