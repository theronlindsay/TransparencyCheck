import { derived, writable } from 'svelte/store';
import { page } from '$app/stores';

const sourceRegistry = writable({});

export function registerAssistantSource(sourceId, sourceConfig) {
	sourceRegistry.update((registry) => ({
		...registry,
		[sourceId]: {
			...sourceConfig,
			sourceId
		}
	}));
}

export function updateAssistantSourceData(sourceId, data = {}) {
	sourceRegistry.update((registry) => {
		const current = registry[sourceId];
		if (!current) {
			return registry;
		}

		return {
			...registry,
			[sourceId]: {
				...current,
				data: {
					...(current.data || {}),
					...data
				}
			}
		};
	});
}

export function unregisterAssistantSource(sourceId) {
	sourceRegistry.update((registry) => {
		const next = { ...registry };
		delete next[sourceId];
		return next;
	});
}

function resolveActiveSource(pathname, registry) {
	const sources = Object.values(registry);
	for (const source of sources) {
		if (typeof source.isActive === 'function' && source.isActive(pathname)) {
			return source;
		}
	}
	return null;
}

export const assistantPageContext = derived([page, sourceRegistry], ([$page, $registry]) => {
	const pathname = $page.url.pathname;
	const activeSource = resolveActiveSource(pathname, $registry);

	if (!activeSource) {
		return {
			pathname,
			pageType: 'generic',
			pageLabel: 'Current Page',
			sourceId: null,
			data: {},
			dataSources: [],
			suggestions: []
		};
	}

	return {
		pathname,
		pageType: activeSource.pageType || 'generic',
		pageLabel: activeSource.pageLabel || 'Current Page',
		sourceId: activeSource.sourceId,
		data: activeSource.data || {},
		dataSources: activeSource.dataSources || [],
		suggestions: activeSource.suggestions || []
	};
});
