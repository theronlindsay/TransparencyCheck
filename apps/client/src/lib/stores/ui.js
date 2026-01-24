import { writable } from 'svelte/store';

// Store to control AI summarizer visibility
export const showAISummarizer = writable(false);

// Toggle function for convenience
export function toggleAISummarizer() {
	showAISummarizer.update(v => !v);
}
