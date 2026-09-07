import { AsyncLocalStorage } from 'node:async_hooks';

// One API instance per Compose stack. Nested jobs reuse the owner's slot.
export function createJobGuard() {
	const context = new AsyncLocalStorage();
	let active = null;
	return async function runExclusive(name, task) {
		if (active && context.getStore() === active) return await task();
		if (active)
			throw Object.assign(new Error(`Background job already running: ${active.name}`), {
				status: 409
			});
		const owner = { name };
		active = owner;
		try {
			return await context.run(owner, task);
		} finally {
			active = null;
		}
	};
}

export const runExclusiveJob = createJobGuard();
