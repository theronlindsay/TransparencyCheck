// Shares active refreshes and bounds both concurrent work and retained query keys.
export function createRefreshCache({
	ttlMs = 300000,
	maxKeys = 100,
	maxActive = 1,
	now = Date.now
} = {}) {
	const entries = new Map();
	let active = 0;
	return function refresh(key, task) {
		const existing = entries.get(key);
		if (existing?.promise) return existing.promise;
		if (existing && existing.expires > now()) return Promise.resolve(false);
		if (active >= maxActive) return Promise.resolve(false);
		entries.delete(key);
		while (entries.size >= maxKeys) {
			const oldest = [...entries].find(([, entry]) => !entry.promise);
			if (!oldest) return Promise.resolve(false);
			entries.delete(oldest[0]);
		}
		active++;
		const entry = { promise: null, expires: 0 };
		entry.promise = Promise.resolve()
			.then(task)
			.then(() => true)
			.finally(() => {
				active--;
				entry.promise = null;
				// Back off after upstream failures as well as successful refreshes.
				entry.expires = now() + ttlMs;
			});
		entries.set(key, entry);
		return entry.promise;
	};
}
