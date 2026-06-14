import { ChatMessage, IdeaState, RefinedAspects, RefineResponse } from "../types";
import {
  repairJson,
  getSystemInstruction,
  buildClaudeMessages,
  buildOpenAIMessages,
  buildGeminiContents,
  formatApiError,
  sanitizeRefineResponse
} from "../shared";
import { getAlternatingMessages } from "../shared/messageUtils";



// Client Side Online Refinement with provider fallback chain
export async function handleOnlineRefine(
  messages: ChatMessage[],
  currentState: IdeaState,
  keys: { gemini: string; openai: string; claude: string; zen: string },
  forceComplete: boolean = false
): Promise<RefineResponse> {
  const targetModel = currentState.targetModel || 'general';
  const operationalIdea = currentState.originalIdea || (messages[0]?.content || '');

  const systemInst = getSystemInstruction(targetModel);
  const alternating = getAlternatingMessages(messages);
  const errors: string[] = [];

  // First, try the server endpoint ONCE (avoids duplicate requests)
  try {
    const serverRes = await fetch("/api/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea: operationalIdea,
        messages,
        customGeminiKey: keys.gemini,
        customOpenAIKey: keys.openai,
        customClaudeKey: keys.claude,
        customZenKey: keys.zen,
        targetModel,
        forceGenerate: forceComplete
      })
    });
    if (serverRes.ok) return await serverRes.json();
    // If server fails, fall through to direct API calls below
  } catch (serverErr: any) {
    // Server unavailable, fall through to direct API calls
  }

  // Direct API fallback (only used if server endpoint fails)
  async function tryClaude(): Promise<RefineResponse | null> {
    if (!keys.claude) return null;
    try {
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
      const cleanKey = keys.gemini.replace(/[^\x20-\x7E]/g, '').trim();
      if (!cleanKey) { errors.push('Gemini: Invalid API key format'); return null; }
      if (!cleanKey.startsWith('AIzaSy') && !cleanKey.startsWith('AQ.')) {
        errors.push('Gemini: Invalid API key format (expected AIzaSy or AQ. prefix)');
        return null;
      }
      const geminiContents = buildGeminiContents(alternating, forceComplete);
      const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
      let lastErr: Error | null = null;
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
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
          if (!res.ok) {
            const errorText = await res.text();
            lastErr = new Error(formatApiError(res.status, errorText));
            console.warn(`Gemini model ${model} failed:`, res.status, errorText);
            continue;
          }
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) throw new Error("No response from Gemini.");
          return sanitizeRefineResponse(JSON.parse(repairJson(rawText.trim())));
        } catch (err: any) {
          lastErr = err;
          console.warn(`Gemini model ${model} failed:`, err.message);
        }
      }
      if (lastErr) {
        errors.push(`Gemini: ${lastErr.message}`);
      }
      return null;
    } catch (err: any) {
      errors.push(`Gemini: ${err.message}`);
      return null;
    }
  }

  async function tryZen(): Promise<RefineResponse | null> {
    if (!keys.zen) return null;
    try {
      const cleanKey = keys.zen.replace(/[^\x20-\x7E]/g, '').trim();
      if (!cleanKey) { errors.push('Zen: Invalid API key format'); return null; }
      const openAIMsg = buildOpenAIMessages(alternating, systemInst, forceComplete);
      try {
        const res = await fetch("https://opencode.ai/zen/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cleanKey}` },
          body: JSON.stringify({ model: "big-pickle", response_format: { type: "json_object" }, messages: openAIMsg })
        });
        if (!res.ok) throw new Error(formatApiError(res.status, JSON.stringify(await res.json().catch(() => ({})))));
        const data = await res.json();
        return sanitizeRefineResponse(JSON.parse(repairJson(data.choices[0].message.content.trim())));
      } catch (netErr: any) {
        if (netErr.message?.includes('fetch') || netErr.message?.includes('NetworkError') || netErr.name === 'TypeError') {
          throw new Error('Zen: Network unavailable - opencode.ai may be down or unreachable');
        }
        throw netErr;
      }
    } catch (err: any) { errors.push(`Zen: ${err.message}`); return null; }
  }

  // Provider fallback chain - only include Zen when explicitly selected
  const gemini = { name: 'Gemini', fn: tryGemini };
  const openai = { name: 'OpenAI', fn: tryOpenAI };
  const claude = { name: 'Claude', fn: tryClaude };
  const zen = { name: 'Zen', fn: tryZen };

  let orderedProviders: Array<{ name: string; fn: () => Promise<RefineResponse | null> }>;
  if (targetModel === 'claude') {
    orderedProviders = [claude, openai, gemini];
  } else if (targetModel === 'gpt') {
    orderedProviders = [openai, gemini, claude];
  } else if (targetModel === 'zen') {
    orderedProviders = [zen, gemini, openai, claude];
  } else {
    // gemini or general - try gemini first, then mainstream providers, skip zen
    orderedProviders = [gemini, openai, claude];
  }

  // Try each provider sequentially until one succeeds
  for (const provider of orderedProviders) {
    try {
      const result = await provider.fn();
      if (result) return result;
    } catch (err) {
      // Continue to next provider
    }
  }

  // Build a helpful error message based on what happened
  const configuredProviders = orderedProviders.filter(p => {
    if (p.name === 'Gemini') return !!keys.gemini;
    if (p.name === 'OpenAI') return !!keys.openai;
    if (p.name === 'Claude') return !!keys.claude;
    if (p.name === 'Zen') return !!keys.zen;
    return false;
  }).map(p => p.name);
  
  if (configuredProviders.length === 0) {
    throw new Error("No AI providers configured. Please add an API key in Settings.");
  }
  
  if (errors.length > 0) {
    throw new Error(`All AI providers failed: ${errors.join('; ')}. Configured providers: ${configuredProviders.join(', ')}. Check your API keys in Settings.`);
  } else {
    throw new Error("No AI providers responded. Configured: " + configuredProviders.join(', ') + ". Check your API keys in Settings.");
  }
}
