import { ChatMessage, IdeaState, RefinedAspects, RefineResponse } from "../types";
import {
  isPureGreeting,
  repairJson,
  getSystemInstruction,
  buildClaudeMessages,
  buildOpenAIMessages,
  buildGeminiContents,
  GREETING_RESPONSE,
  formatApiError,
  sanitizeRefineResponse
} from "../shared";
import { getAlternatingMessages } from "../shared/messageUtils";



// Client Side Online Refinement with provider fallback chain
export async function handleOnlineRefine(
  messages: ChatMessage[],
  currentState: IdeaState,
  keys: { gemini: string; openai: string; claude: string },
  forceComplete: boolean = false
): Promise<RefineResponse> {
  const targetModel = currentState.targetModel || 'general';
  const operationalIdea = (currentState.originalIdea && !isPureGreeting(currentState.originalIdea))
    ? currentState.originalIdea : (messages[0]?.content || '');

  if (isPureGreeting(operationalIdea) && messages.length <= 1) {
    return { message: GREETING_RESPONSE, aspects: {}, progressScore: 0, isCompleted: false, finalPrompt: null };
  }

  const systemInst = getSystemInstruction(targetModel);
  const alternating = getAlternatingMessages(messages);
  const errors: string[] = [];

  async function tryClaude(): Promise<RefineResponse | null> {
    if (!keys.claude) return null;
    try {
      const serverRes = await fetch("/api/refine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: operationalIdea, messages, customGeminiKey: keys.gemini, customOpenAIKey: keys.openai, customClaudeKey: keys.claude, targetModel, forceGenerate: forceComplete })
      });
      if (serverRes.ok) return await serverRes.json();
      const claudeMsg = buildClaudeMessages(alternating, forceComplete);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": keys.claude, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-3-5-sonnet-20241022", max_tokens: 4000, system: systemInst, messages: claudeMsg })
      });
      if (!res.ok) throw new Error(formatApiError(res.status, await res.text()));
      const info = await res.json();
      const text = info.content?.[0]?.text;
      if (!text) throw new Error("No response from Claude.");
      return sanitizeRefineResponse(JSON.parse(repairJson(text.trim())));
    } catch (err: any) { errors.push(`Claude: ${err.message}`); return null; }
  }

  async function tryOpenAI(): Promise<RefineResponse | null> {
    if (!keys.openai) return null;
    try {
      const serverRes = await fetch("/api/refine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: operationalIdea, messages, customGeminiKey: keys.gemini, customOpenAIKey: keys.openai, customClaudeKey: keys.claude, targetModel, forceGenerate: forceComplete })
      });
      if (serverRes.ok) return await serverRes.json();
      const openAIMsg = buildOpenAIMessages(alternating, systemInst, forceComplete);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${keys.openai}` },
        body: JSON.stringify({ model: "gpt-4o-mini", response_format: { type: "json_object" }, messages: openAIMsg })
      });
      if (!res.ok) throw new Error(formatApiError(res.status, JSON.stringify(await res.json().catch(() => ({})))));
      const data = await res.json();
      return sanitizeRefineResponse(JSON.parse(repairJson(data.choices[0].message.content.trim())));
    } catch (err: any) { errors.push(`OpenAI: ${err.message}`); return null; }
  }

  async function tryGemini(): Promise<RefineResponse | null> {
    if (!keys.gemini) return null;
    try {
      const serverRes = await fetch("/api/refine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: operationalIdea, messages, customGeminiKey: keys.gemini, customOpenAIKey: keys.openai, customClaudeKey: keys.claude, targetModel, forceGenerate: forceComplete })
      });
      if (serverRes.ok) return await serverRes.json();
      const geminiContents = buildGeminiContents(alternating, forceComplete);
      const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
      let lastErr: Error | null = null;
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys.gemini}`;
          const res = await fetch(url, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: geminiContents, systemInstruction: { parts: [{ text: systemInst }] },
              generationConfig: { responseMimeType: "application/json", responseSchema: {
                type: "OBJECT", properties: {
                  message: { type: "STRING" },
                  aspects: { type: "OBJECT", properties: {
                    primaryGoal: { type: "STRING" }, targetAudience: { type: "STRING" },
                    toneStyle: { type: "STRING" }, inputsRequired: { type: "STRING" },
                    formatOutput: { type: "STRING" }, constraints: { type: "STRING" }
                  }},
                  progressScore: { type: "INTEGER" }, isCompleted: { type: "BOOLEAN" }, finalPrompt: { type: "STRING" }
                }, required: ["message", "aspects", "progressScore", "isCompleted", "finalPrompt"]
              }}
            })
          });
          if (!res.ok) throw new Error(formatApiError(res.status, await res.text()));
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) throw new Error("No response from Gemini.");
          return sanitizeRefineResponse(JSON.parse(repairJson(rawText.trim())));
        } catch (err: any) {
          lastErr = err;
          if (err.message.includes('Rate limit') || err.message.includes('quota')) break;
        }
      }
      if (lastErr) throw lastErr;
      return null;
    } catch (err: any) { errors.push(`Gemini: ${err.message}`); return null; }
  }

  // Provider fallback chain
  if (targetModel === 'claude') {
    const result = await tryClaude() ?? await tryOpenAI() ?? await tryGemini();
    if (result) return result;
  } else if (targetModel === 'gpt') {
    const result = await tryOpenAI() ?? await tryGemini() ?? await tryClaude();
    if (result) return result;
  } else {
    const result = await tryGemini() ?? await tryOpenAI() ?? await tryClaude();
    if (result) return result;
  }

  const summary = errors.length > 0
    ? `All AI providers failed: ${errors.join('; ')}. Check your API keys in Settings.`
    : "No AI providers configured. Please add an API key in Settings.";
  throw new Error(summary);
}
