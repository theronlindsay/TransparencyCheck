import { json } from '@sveltejs/kit';
import { OpenAI } from 'openai';
import { env } from '$env/dynamic/private';
import { getAuth } from '$lib/auth.js';

const OPENAI_API_KEY = env.OPENAI_API_KEY;
const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY || OPENAI_API_KEY;

// Server-side validation rules
function validateRequest(prompt, requestData) {
	const errors = [];

	// Rule 1: Validate reading level if present in prompt
	const readingLevelMatch = prompt.match(/Reading Level: (.+)/);
	if (readingLevelMatch) {
		const allowedLevels = [
			'elementary school reading level',
			'middle school reading level',
			'high school reading level',
			'general adult audience',
			'expertise in policy'
		];
		const hasValidLevel = allowedLevels.some((level) =>
			readingLevelMatch[1].toLowerCase().includes(level)
		);
		if (!hasValidLevel) {
			errors.push('Invalid reading level specified');
		}
	}

	// Rule 2: Check for malicious content or injection attempts
	const suspiciousPatterns = [
		/<script/i,
		/javascript:/i,
		/onerror=/i,
		/onclick=/i,
		/eval\(/i,
		/__proto__/i,
		/constructor\[/i
	];

	for (const pattern of suspiciousPatterns) {
		if (pattern.test(prompt)) {
			errors.push('Prompt contains potentially malicious content');
			break;
		}
	}

	// Rule 3: Validate tools array if provided
	if (requestData.tools) {
		if (!Array.isArray(requestData.tools)) {
			errors.push('Tools must be an array');
		} else {
			for (const tool of requestData.tools) {
				if (!tool.type || typeof tool.type !== 'string') {
					errors.push('Each tool must have a valid type');
					break;
				}
				const allowedToolTypes = ['web_search_preview', 'function'];
				if (!allowedToolTypes.includes(tool.type)) {
					errors.push(`Invalid tool type: ${tool.type}`);
					break;
				}
			}
		}
	}

	// Rule 4: Validate bill text length if present
	const billTextMatch = prompt.match(/Bill Text:\n(.+)/s);
	if (billTextMatch && billTextMatch[1].length > 200000) {
		errors.push('Bill text exceeds maximum length of 200,000 characters');
	}

	// Rule 5: Validate summary length if present in prompt
	const summaryLengthMatch = prompt.match(/Summary Length: (\d+)-(\d+)/);
	if (summaryLengthMatch) {
		const minLength = parseInt(summaryLengthMatch[1], 10);
		const maxLength = parseInt(summaryLengthMatch[2], 10);

		if (
			isNaN(minLength) ||
			isNaN(maxLength) ||
			minLength < 50 ||
			maxLength > 500 ||
			minLength >= maxLength
		) {
			errors.push(
				'Invalid summary length range. Must be between 50-500 characters, with min < max.'
			);
		}
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}

function resolveSubscriptionTier(sessionResponse) {
	const user =
		sessionResponse?.user ||
		sessionResponse?.data?.user ||
		sessionResponse?.session?.user;
	if (user) {
		return user.additionalFields?.subscriptionTier || 'free';
	}
	return 'free';
}

export async function POST({ request }) {
	try {
		const auth = await getAuth();
		const headers = new Headers();
		request.headers.forEach((value, key) => headers.set(key, value));

		let subscriptionTier = 'free';
		try {
			const sessionResponse = await auth.api.getSession({ headers });
			subscriptionTier = resolveSubscriptionTier(sessionResponse);
		} catch (sessionErr) {
			console.warn('[openAI] getSession failed, using free tier:', sessionErr?.message || sessionErr);
		}

		const { prompt, tools, conversationId } = await request.json();

		const validation = validateRequest(prompt, { tools });
		if (!validation.isValid) {
			console.error('Validation failed:', validation.errors);
			return json(
				{
					error: validation.errors.join('; '),
					validationErrors: validation.errors,
					success: false
				},
				{ status: 400 }
			);
		}

		const result = await requestAI(prompt, tools, conversationId, subscriptionTier);

		return json({
			success: true,
			response: result.text,
			conversationId: result.conversationId,
			prompt
		});
	} catch (error) {
		console.error('Error in openAI endpoint:', error);
		return json({ error: error.message, success: false }, { status: 500 });
	}
}

async function requestAI(prompt, tools, conversationId = null, tier = 'free') {
	const isPro = tier === 'pro';

	if (isPro && !OPENAI_API_KEY?.trim()) {
		throw new Error('OpenAI API key is not configured for Pro tier.');
	}
	if (!isPro && !OPENROUTER_API_KEY?.trim()) {
		throw new Error(
			'No API key configured for free tier. Set OPENROUTER_API_KEY (or OPENAI_API_KEY as fallback) on the server.'
		);
	}

	if (!isPro) {
		const client = new OpenAI({
			apiKey: OPENROUTER_API_KEY,
			baseURL: 'https://openrouter.ai/api/v1',
			defaultHeaders: {
				'HTTP-Referer': 'https://transparencycheck.app',
				'X-Title': 'TransparencyCheck'
			}
		});

		const response = await client.chat.completions.create({
			model: 'openrouter/free',
			messages: [{ role: 'user', content: prompt }]
		});

		return {
			text: response.choices[0].message.content,
			conversationId: response.id
		};
	}

	const client = new OpenAI({ apiKey: OPENAI_API_KEY });

	console.log('Prompt (Pro):', prompt);
	if (tools) {
		console.log('Tools enabled:', tools);
	}
	if (conversationId) {
		console.log('Continuing conversation:', conversationId);
	}

	const requestOptions = {
		model: 'gpt-4o-mini',
		input: prompt
	};

	if (tools && Array.isArray(tools) && tools.length > 0) {
		requestOptions.tools = tools;
	}

	if (conversationId) {
		requestOptions.previous_response_id = conversationId;
	}

	const response = await client.responses.create(requestOptions);

	console.log('OpenAI Response:', response);

	const outputText = response.output_text || '';
	return {
		text: outputText,
		conversationId: response.id
	};
}
