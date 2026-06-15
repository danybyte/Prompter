import { ChatMessage, IdeaState, RefineResponse } from "../types";
import {
  repairJson,
  getSystemInstruction,
  buildGeminiContents,
  formatApiError,
  sanitizeRefineResponse
} from "../shared";
import { getAlternatingMessages } from "../shared/messageUtils";



// Client Side Online Refinement with provider fallback chain
export async function handleOnlineRefine(
  messages: ChatMessage[],
  currentState: IdeaState,
  keys: { gemini: string },
  forceComplete: boolean = false
): Promise<RefineResponse> {
  const operationalIdea = currentState.originalIdea || (messages[0]?.content || '');

  const systemInst = getSystemInstruction();
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
        forceGenerate: forceComplete
      })
    });
    if (serverRes.ok) return await serverRes.json();
    // If server fails, fall through to direct API calls below
  } catch (serverErr: any) {
    // Server unavailable, fall through to direct API calls
  }

  // Direct API fallback (only used if server endpoint fails)
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
      const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
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

  // Try Gemini directly
  const result = await tryGemini();
  if (result) return result;

  if (errors.length > 0) {
    throw new Error(`Gemini failed: ${errors.join('; ')}. Check your API key in Settings.`);
  }
  throw new Error("No AI provider responded. Check your Gemini API key in Settings.");
}
