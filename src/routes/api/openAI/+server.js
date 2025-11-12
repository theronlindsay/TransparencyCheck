import { json } from '@sveltejs/kit';
import { OpenAI } from 'openai'
import { OPENAI_API_KEY } from '$env/static/private';

let promptText;

export async function POST({ request }) {
	try {
        //wait for the prompt
		const { prompt } = await request.json();

        //catch error if we didn't get it.
		if (!prompt) {
			return json({ error: 'No prompt provided' }, { status: 400 });
		}

		// Call printPrompt function and get the response
		const response = await printPrompt(prompt);

		return json({ success: true, response, prompt });
	} catch (error) {
		console.error('Error in openAI endpoint:', error);
		return json({ error: error.message, success: false }, { status: 500 });
	}
}

async function printPrompt(prompt) {
	console.log(prompt);
    promptText = prompt;
    return await requestAI(promptText);
}

async function requestAI(prompt) {
    const client = new OpenAI({
        apiKey: OPENAI_API_KEY
    });

	const chatGPTResponse = await client.chat.completions.create({
		model: 'gpt-4o-mini',
		messages: [
			{
				role: 'user',
				content: prompt
			}
		]
	});

	console.log('OpenAI Response:', chatGPTResponse);
	
	// Extract the text content from the response
	const responseText = chatGPTResponse.choices?.[0]?.message?.content || '';
	return responseText;
}

