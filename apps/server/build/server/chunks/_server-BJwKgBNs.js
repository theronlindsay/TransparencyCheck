import { j as json } from './index-CoD1IJuy.js';
import { OpenAI } from 'openai';
import { b as private_env } from './shared-server-DaWdgxVh.js';

const OPENAI_API_KEY = private_env.OPENAI_API_KEY;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}
function validateRequest(prompt, requestData) {
  const errors = [];
  const readingLevelMatch = prompt.match(/Reading Level: (.+)/);
  if (readingLevelMatch) {
    const allowedLevels = [
      "elementary school reading level",
      "middle school reading level",
      "high school reading level",
      "general adult audience",
      "expertise in policy"
    ];
    const hasValidLevel = allowedLevels.some(
      (level) => readingLevelMatch[1].toLowerCase().includes(level)
    );
    if (!hasValidLevel) {
      errors.push("Invalid reading level specified");
    }
  }
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
      errors.push("Prompt contains potentially malicious content");
      break;
    }
  }
  if (requestData.tools) {
    if (!Array.isArray(requestData.tools)) {
      errors.push("Tools must be an array");
    } else {
      for (const tool of requestData.tools) {
        if (!tool.type || typeof tool.type !== "string") {
          errors.push("Each tool must have a valid type");
          break;
        }
        const allowedToolTypes = ["web_search_preview", "function"];
        if (!allowedToolTypes.includes(tool.type)) {
          errors.push(`Invalid tool type: ${tool.type}`);
          break;
        }
      }
    }
  }
  const billTextMatch = prompt.match(/Bill Text:\n(.+)/s);
  if (billTextMatch && billTextMatch[1].length > 2e5) {
    errors.push("Bill text exceeds maximum length of 200,000 characters");
  }
  const summaryLengthMatch = prompt.match(/Summary Length: (\d+)-(\d+)/);
  if (summaryLengthMatch) {
    const minLength = parseInt(summaryLengthMatch[1], 10);
    const maxLength = parseInt(summaryLengthMatch[2], 10);
    if (isNaN(minLength) || isNaN(maxLength) || minLength < 50 || maxLength > 500 || minLength >= maxLength) {
      errors.push("Invalid summary length range. Must be between 50-500 characters, with min < max.");
    }
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}
async function POST({ request }) {
  try {
    const { prompt, tools, conversationId } = await request.json();
    const validation = validateRequest(prompt, { tools });
    if (!validation.isValid) {
      console.error("Validation failed:", validation.errors);
      return json({
        error: validation.errors.join("; "),
        validationErrors: validation.errors,
        success: false
      }, { status: 400 });
    }
    const result = await requestAI(prompt, tools, conversationId);
    return json({
      success: true,
      response: result.text,
      conversationId: result.conversationId,
      prompt
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error in openAI endpoint:", error);
    return json({ error: error.message, success: false }, { status: 500, headers: corsHeaders });
  }
}
async function requestAI(prompt, tools, conversationId = null) {
  const client = new OpenAI({
    apiKey: OPENAI_API_KEY
  });
  console.log("Prompt:", prompt);
  if (tools) {
    console.log("Tools enabled:", tools);
  }
  if (conversationId) {
    console.log("Continuing conversation:", conversationId);
  }
  const requestOptions = {
    model: "gpt-4o-mini",
    input: prompt
  };
  if (tools && Array.isArray(tools) && tools.length > 0) {
    requestOptions.tools = tools;
  }
  if (conversationId) {
    requestOptions.previous_response_id = conversationId;
  }
  const response = await client.responses.create(requestOptions);
  console.log("OpenAI Response:", response);
  const outputText = response.output_text || "";
  return {
    text: outputText,
    conversationId: response.id
  };
}

export { OPTIONS, POST };
//# sourceMappingURL=_server-BJwKgBNs.js.map
