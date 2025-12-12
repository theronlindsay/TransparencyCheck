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

let promptText;

// Server-side validation rules
function validateRequest(prompt, requestData) {
	const errors = [];

	// Rule 2: Validate reading level if present in prompt
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

	// Rule 3: Check for malicious content or injection attempts
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

	// Rule 4: Validate tools array if provided
	if (requestData.tools) {
		if (!Array.isArray(requestData.tools)) {
			errors.push('Tools must be an array');
		} else {
			for (const tool of requestData.tools) {
				if (!tool.type || typeof tool.type !== 'string') {
					errors.push('Each tool must have a valid type');
					break;
				}
				// Only allow specific tool types
				const allowedToolTypes = ['web_search', 'code_interpreter'];
				if (!allowedToolTypes.includes(tool.type)) {
					errors.push(`Invalid tool type: ${tool.type}`);
					break;
				}
			}
		}
	}

	// Rule 5: Rate limiting check - prompt shouldn't be exactly the same as last one
	if (promptText && prompt === promptText) {
		errors.push('Duplicate request detected - please wait before resubmitting');
	}

	// Rule 6: Validate bill text length if present
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
        //wait for the prompt and optional tools
		const { prompt, tools } = await request.json();

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

		// Call printPrompt function and get the response
		const response = await printPrompt(prompt, tools);

		return json({ success: true, response, prompt }, { headers: corsHeaders });
	} catch (error) {
		console.error('Error in openAI endpoint:', error);
		return json({ error: error.message, success: false }, { status: 500, headers: corsHeaders });
	}
}

async function printPrompt(prompt, tools) {
	console.log(prompt);
	if (tools) {
		console.log('Tools enabled:', tools);
	}
    promptText = prompt;
    return await requestAI(promptText, tools);
}

async function requestAI(prompt, tools) {
    const client = new OpenAI({
        apiKey: OPENAI_API_KEY
    });

	const requestOptions = {
		model: 'gpt-4o-mini',
		messages: [
			{
				role: 'user',
				content: prompt
			}
		]
	};

	// Add tools if provided
	if (tools && Array.isArray(tools) && tools.length > 0) {
		requestOptions.tools = tools;
	}

	const chatGPTResponse = await client.chat.completions.create(requestOptions);

	console.log('OpenAI Response:', chatGPTResponse);
	
	// Extract the text content from the response
	const responseText = chatGPTResponse.choices?.[0]?.message?.content || '';
	return responseText;
}

