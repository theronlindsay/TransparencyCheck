<script>
	import { fade, scale } from 'svelte/transition';
	import { UploadDropzone } from '@uploadthing/svelte';
	import { apiUrl } from '$lib/config.js';

	let { show = $bindable(false), pagePath = '/' } = $props();

	let title = $state('');
	let description = $state('');
	let email = $state('');
	let attachment = $state(null);
	let isUploading = $state(false);
	let isSubmitting = $state(false);
	let submitError = $state('');
	let submitSuccess = $state('');
	let dropzoneShell = $state();
	function resolveDevUploadthingUrl() {
		const configuredBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

		try {
			const parsed = new URL(configuredBase);
			if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
				parsed.protocol = 'http:';
			}
			parsed.pathname = '/api/uploadthing';
			parsed.search = '';
			parsed.hash = '';
			return parsed.toString();
		} catch {
			return 'http://localhost:3000/api/uploadthing';
		}
	}
	const uploadThingUrl = $derived(
		import.meta.env.DEV ? resolveDevUploadthingUrl() : apiUrl('/api/uploadthing')
	);
	let uploader = $derived({
		endpoint: 'bugAttachment',
		url: uploadThingUrl,
		config: { mode: 'auto' },
		onUploadBegin() {
			isUploading = true;
			submitError = '';
		},
		onClientUploadComplete(files) {
			attachment = files?.[0]
				? {
						fileKey: files[0].serverData?.fileKey || files[0].key || '',
						url: files[0].serverData?.url || files[0].ufsUrl || files[0].url || '',
						name: files[0].name || '',
						size: Number(files[0].size) || 0,
						type: files[0].type || ''
					}
				: null;
			isUploading = false;
		},
		onUploadError(error) {
			isUploading = false;
			submitError = error?.message || 'Attachment upload failed.';
		}
	});

	function closeModal() {
		if (isSubmitting) {
			return;
		}

		show = false;
		resetFields();
		resetFormState();
	}

	function resetFields() {
		title = '';
		description = '';
		email = '';
		attachment = null;
	}

	function resetFormState() {
		isUploading = false;
		isSubmitting = false;
		submitError = '';
		submitSuccess = '';
	}

	function openFilePickerFromShell() {
		if (!dropzoneShell || isSubmitting || isUploading) {
			return;
		}

		const input = dropzoneShell.querySelector('input[type="file"]');
		if (input instanceof HTMLInputElement) {
			input.click();
		}
	}

	async function submitReport() {
		submitError = '';
		submitSuccess = '';

		if (!title.trim() || !description.trim()) {
			submitError = 'Please include a title and description.';
			return;
		}

		if (isUploading) {
			submitError = 'Please wait for the file upload to finish.';
			return;
		}

		isSubmitting = true;

		try {
			const response = await fetch(apiUrl('/api/bug-reports'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title,
					description,
					email,
					pageUrl:
						typeof window !== 'undefined' ? `${window.location.origin}${pagePath}` : pagePath,
					attachment
				})
			});

			const body = await response.json();
			if (!response.ok) {
				throw new Error(body?.error || 'Failed to submit bug report.');
			}

			submitSuccess = 'Bug report sent. Thank you.';
			resetFields();
			setTimeout(() => {
				show = false;
				resetFormState();
			}, 1200);
		} catch (error) {
			submitError = error?.message || 'Failed to submit bug report.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if show}
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 180 }}
		onclick={closeModal}
		role="presentation"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="modal-content elevated-surface"
			transition:scale={{ duration: 180, start: 0.96 }}
			onclick={(event) => event.stopPropagation()}
			role="dialog"
			aria-label="Bug report form"
			tabindex="-1"
		>
			<button
				type="button"
				class="close-button"
				onpointerdown={(event) => event.stopPropagation()}
				onclick={(event) => {
					event.stopPropagation();
					closeModal();
				}}
				aria-label="Close"
			>
				&times;
			</button>

			<div class="modal-header">
				<p class="eyebrow">Feedback</p>
				<h2>Find a bug?</h2>
				<p>Send a bug report directly to our admin inbox. Attach one file up to 1 MB if useful.</p>
			</div>

			<div class="modal-body">
				<label class="field">
					<span>Title</span>
					<input bind:value={title} maxlength="160" placeholder="Short bug summary" />
				</label>

				<label class="field">
					<span>Description</span>
					<textarea
						bind:value={description}
						rows="6"
						maxlength="6000"
						placeholder="What happened, what you expected, and how to reproduce it"
					></textarea>
				</label>

				<label class="field">
					<span>Email (optional)</span>
					<input bind:value={email} maxlength="255" placeholder="you@example.com" />
				</label>

				<div class="field">
					<span>Attachment</span>
					<div
						class="dropzone-shell"
						bind:this={dropzoneShell}
						onclick={openFilePickerFromShell}
						role="button"
						tabindex="0"
						aria-label="Choose a bug report attachment"
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								openFilePickerFromShell();
							}
						}}
					>
						<UploadDropzone {uploader}>
							<span slot="label" let:state>
								{state.isUploading ? 'Uploading attachment...' : 'Drop a file here or browse'}
							</span>
							<span slot="button-content" let:state>
								{state.isUploading ? 'Uploading...' : 'Choose file'}
							</span>
							<span slot="allowed-content">1 file max, 1 MB limit</span>
						</UploadDropzone>
					</div>

					{#if attachment?.url}
						<p class="attachment-note">
							Attached: <a href={attachment.url} target="_blank" rel="noreferrer"
								>{attachment.name}</a
							>
						</p>
					{/if}
				</div>

				{#if submitError}
					<p class="status error">{submitError}</p>
				{/if}

				{#if submitSuccess}
					<p class="status success">{submitSuccess}</p>
				{/if}
			</div>

			<div class="modal-actions">
				<button type="button" class="btn-raised-neutral cancel" onclick={closeModal}>Cancel</button>
				<button
					type="button"
					class="depth-button-primary"
					onclick={submitReport}
					disabled={isSubmitting || isUploading}
				>
					{isSubmitting ? 'Sending...' : 'Send bug report'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(10, 8, 8, 0.82);
		backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 1200;
	}

	.modal-content {
		position: relative;
		width: min(680px, 100%);
		max-height: min(88vh, 760px);
		overflow: auto;
	}

	.modal-content.elevated-surface {
		padding: 0;
	}

	.close-button {
		position: absolute;
		top: 1rem;
		right: 1rem;
		border: 0;
		background: none;
		color: var(--text-secondary);
		font-size: 1.6rem;
		cursor: pointer;
		z-index: 2;
		width: 2.5rem;
		height: 2.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		line-height: 1;
	}

	.close-button:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	.modal-header,
	.modal-body,
	.modal-actions {
		padding: 1.35rem 1.5rem;
	}

	.modal-header {
		padding-bottom: 0.75rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.75rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text-secondary);
	}

	.modal-header h2 {
		margin: 0 0 0.5rem;
		font-size: clamp(1.5rem, 3vw, 2rem);
	}

	.modal-header p {
		margin: 0;
	}

	.modal-body {
		display: grid;
		gap: 1rem;
	}

	.field {
		display: grid;
		gap: 0.45rem;
	}

	.field > span {
		font-weight: 600;
		color: var(--text-primary);
	}

	input,
	textarea {
		width: 100%;
		border-radius: var(--radius-sm);
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.04);
		box-shadow: var(--input-inset-depth);
		color: var(--text-primary);
		font: inherit;
		padding: 0.9rem 1rem;
	}

	textarea {
		resize: vertical;
		min-height: 140px;
	}

	.dropzone-shell {
		width: min(100%, 380px);
		padding: 0.55rem;
		border-radius: var(--radius-sm);
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.025);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.05),
			0 10px 24px rgba(0, 0, 0, 0.18);
		overflow: hidden;
	}

	.dropzone-shell :global([data-ut-element='container']) {
		background: rgba(255, 255, 255, 0.03);
		border: 1px dashed rgba(255, 255, 255, 0.16);
		border-radius: var(--radius-sm);
		padding: 0.75rem 0.8rem;
		min-height: 150px;
		color: var(--text-primary);
	}

	.dropzone-shell :global([data-ut-element='upload-icon']) {
		width: 2.2rem;
		height: 2.2rem;
	}

	.dropzone-shell :global([data-ut-element='label']) {
		width: auto;
		margin-top: 0.65rem;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.dropzone-shell :global([data-ut-element='button']) {
		border-radius: 999px;
		background: rgba(241, 58, 55, 0.18);
		color: var(--text-primary);
		border: 1px solid rgba(241, 58, 55, 0.3);
		padding: 0.45rem 0.9rem;
		font-size: 0.85rem;
	}

	.dropzone-shell :global([data-ut-element='allowed-content']) {
		font-size: 0.72rem;
		line-height: 1.35;
		margin-top: 0.45rem;
	}

	.dropzone-shell :global([data-ut-element='allowed-content']),
	.dropzone-shell :global([data-ut-element='label']) {
		color: var(--text-secondary);
	}

	.attachment-note,
	.status {
		margin: 0;
	}

	.status {
		padding: 0.85rem 1rem;
		border-radius: var(--radius-sm);
	}

	.status.error {
		background: rgba(143, 35, 35, 0.22);
		color: #ffb2b2;
	}

	.status.success {
		background: rgba(37, 99, 235, 0.18);
		color: #d2e6ff;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		border-top: 1px solid var(--border-color);
		background: rgba(0, 0, 0, 0.16);
	}

	.cancel {
		padding: 0.85rem 1.2rem;
	}

	@media (max-width: 640px) {
		.modal-actions {
			flex-direction: column-reverse;
		}

		.modal-actions button {
			width: 100%;
		}
	}
</style>
