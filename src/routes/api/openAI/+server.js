import { json } from '@sveltejs/kit';
import { OpenAI } from 'openai'
import { env } from '$env/dynamic/private';

const OPENAI_API_KEY = env.OPENAI_API_KEY;

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type'
};

export async function OPTIONS() {
	return new Response(null, { headers: corsHeaders });
}

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
		const hasValidLevel = allowedLevels.some(level => 
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
				// Only allow specific tool types (OpenAI Responses API)
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

	return {
		isValid: errors.length === 0,
		errors
	};
}

export async function POST({ request }) {
	try {
        //wait for the prompt, optional tools, and optional conversation ID
		const { prompt, tools, conversationId } = await request.json();

		// Server-side validation
		const validation = validateRequest(prompt, { tools });
		if (!validation.isValid) {
			console.error('Validation failed:', validation.errors);
			return json({ 
				error: validation.errors.join('; '),
				validationErrors: validation.errors,
				success: false 
			}, { status: 400 });
		}

		// Call requestAI function and get the response
		const result = await requestAI(prompt, tools, conversationId);

		return json({ 
			success: true, 
			response: result.text, 
			conversationId: result.conversationId,
			prompt 
		}, { headers: corsHeaders });
	} catch (error) {
		console.error('Error in openAI endpoint:', error);
		return json({ error: error.message, success: false }, { status: 500, headers: corsHeaders });
	}
}

async function requestAI(prompt, tools, conversationId = null) {
    const client = new OpenAI({
        apiKey: OPENAI_API_KEY
    });

	console.log('Prompt:', prompt);
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

	// Add tools if provided (Responses API supports web_search_preview, etc.)
	if (tools && Array.isArray(tools) && tools.length > 0) {
		requestOptions.tools = tools;
	}

	// Continue conversation if conversationId provided
	if (conversationId) {
		requestOptions.previous_response_id = conversationId;
	}

	const response = await client.responses.create(requestOptions);

	console.log('OpenAI Response:', response);
	
	// Extract the text content and conversation ID from the Responses API output
	const outputText = response.output_text || '';
	return {
		text: outputText,
		conversationId: response.id
	};
}

