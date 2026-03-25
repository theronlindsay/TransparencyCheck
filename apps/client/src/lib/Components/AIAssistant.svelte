<script>
	import posthog from 'posthog-js';
	import AIAssistantLauncher from '$lib/Components/AIAssistantLauncher.svelte';
	import AIAssistantPanel from '$lib/Components/AIAssistantPanel.svelte';
	import { assistantPageContext } from '$lib/stores/assistant-context.js';

	let isOpen = $state(false);
	let lastPathname = $state(null);

	function toggle() {
		const opening = !isOpen;
		isOpen = opening;
		if (opening) {
			posthog.capture('ai_assistant_opened', {
				page_type: $assistantPageContext.pageType,
				pathname: $assistantPageContext.pathname
			});
		}
	}

	$effect(() => {
		const pathname = $assistantPageContext.pathname;
		if (!pathname) return;

		if (lastPathname === null) {
			lastPathname = pathname;
			return;
		}

		if (pathname !== lastPathname) {
			isOpen = false;
			lastPathname = pathname;
		}
	});
</script>

<AIAssistantLauncher {isOpen} onClick={toggle} />
<AIAssistantPanel {isOpen} context={$assistantPageContext} onClose={() => (isOpen = false)} />
