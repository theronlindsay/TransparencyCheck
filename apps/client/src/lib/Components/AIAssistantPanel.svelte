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
	let showSummarizerCard = $state(false);
	let lastContextKey = $state('');
	const MAX_BILL_TEXT_CONTEXT_CHARS = 12000;

	const canSuggestSummarizer = $derived(
		context.pageType === 'bill' &&
			Array.isArray(context.suggestions) &&
			context.suggestions.some((item) => item.action === 'open-summarizer')
	);

	function addMessage(message) {
		messages = [...messages, { id: crypto.randomUUID(), ...message }];
	}

	function handleSummarizerSuggestion() {
		if (showSummarizerCard) return;
		showSummarizerCard = true;
		addMessage({
			role: 'assistant',
			type: 'summarizer-card'
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
		const billTextForContext = billText
			? billText.slice(0, MAX_BILL_TEXT_CONTEXT_CHARS)
			: '';
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

	async function sendMessage(event) {
		event?.preventDefault();
		if (!inputMessage.trim() || isSending) return;

		const question = inputMessage.trim();
		inputMessage = '';
		isSending = true;

		addMessage({ role: 'user', type: 'text', content: question });

		try {
			const response = await fetch(apiUrl('/api/openAI'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt: buildContextPrompt(question),
					tools: [{ type: 'web_search_preview' }],
					conversationId
				})
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
			showSummarizerCard = false;
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
			<button class="close-button" type="button" onclick={onClose}>✖</button>
		</header>

		<div class="messages">
			{#each messages as message (message.id)}
				<div class={`message ${message.role} ${message.type === 'summarizer-card' ? 'card' : ''}`}>
					{#if message.type === 'summarizer-card'}
						<p>{message.content}</p>
						<div class="summarizer-card">
							<AISummarizer
								billNumber={context.data?.billNumber || ''}
								billTitle={context.data?.billTitle || ''}
								billText={context.data?.billText || ''}
							/>
						</div>
					{:else}
						<p>{message.content}</p>
					{/if}
				</div>
			{/each}
		</div>

		<div class="input-area">
			{#if canSuggestSummarizer && !showSummarizerCard}
				<button class="suggestion" type="button" onclick={handleSummarizerSuggestion}>
					✨ Summarize this bill
				</button>
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
		grid-template-rows: auto 1fr auto;
		background: linear-gradient(160deg, rgba(29, 25, 25, 0.96), rgba(18, 15, 15, 0.94));
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 20px;
		z-index: 129;
		box-shadow:
			0 24px 44px rgba(0, 0, 0, 0.42),
			0 38px 72px rgba(0, 0, 0, 0.24),
			inset 0 1px 0 rgba(255, 255, 255, 0.12);
		overflow: hidden;
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
		padding: 0.4rem 0.55rem;
		cursor: pointer;
	}

	.messages {
		overflow-y: auto;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.message {
		align-self: flex-start;
		width: fit-content;
		max-width: 92%;
		height: auto;
		min-height: 0;
		padding: 0.7rem 0.82rem;
		border-radius: 13px;
		font-size: 0.92rem;
		line-height: 1.45;
	}

	.message.card {
		width: 100%;
		max-width: 100%;
	}

	.message p {
		margin: 0;
		color: inherit;
	}

	.message.assistant {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	.message.user {
		background: rgba(241, 58, 55, 0.2);
		border: 1px solid rgba(241, 58, 55, 0.35);
		color: #ffe6e5;
		align-self: flex-end;
	}

	.summarizer-card {
		margin-top: 0.55rem;
		padding: 0;
		border-radius: 8px;
		background: transparent;
		border: none;
		max-height: 440px;
		overflow: auto;
	}

	.input-area {
		padding: 0.8rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		display: grid;
		gap: 0.55rem;
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
