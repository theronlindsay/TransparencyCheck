import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import mongo from './db/mongo.js';

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

const defaultTrustedOrigins = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'https://transparencycheck.app',
	'https://www.transparencycheck.app'
];

const trustedOriginsFromEnv = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || '')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);

const trustedOrigins = [...new Set([...defaultTrustedOrigins, ...trustedOriginsFromEnv])];

let authPromise;

// Lazily initialize auth so image builds do not require a live MongoDB host.
export function getAuth() {
	if (!authPromise) {
		authPromise = (async () => {
			const db = await mongo();

			return betterAuth({
				database: mongodbAdapter(db),
				trustedOrigins,
				user: {
					additionalFields: {
						subscriptionTier: {
							type: "string",
							required: false,
							defaultValue: "free"
						}
					}
				},
				emailAndPassword: {
					enabled: true
				},
				// Register GitHub only when both credentials are present to avoid noisy warnings.
				socialProviders:
					githubClientId && githubClientSecret
						? {
								github: {
									clientId: githubClientId,
									clientSecret: githubClientSecret
								}
							}
						: undefined,
				experimental: { joins: true }
			});
		})();
	}

	return authPromise;
}
