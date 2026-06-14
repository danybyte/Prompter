import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import {
  getSystemInstruction,
  sanitizeRefineResponse as sanitizeRefineResponseBase,
  repairJson,
  getAlternatingMessages,
  buildClaudeMessages,
  buildOpenAIMessages,
  buildGeminiContents,
  GEMINI_MODELS_TO_TRY
} from "./src/shared";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "100kb" }));
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please slow down." },
});
app.use("/api/", limiter);

// API: Check status of API keys (whether the system has a built-in key configured)
app.get("/api/config/status", (req, res) => {
  res.json({
    hasSystemGeminiKey: false,
    hasSystemZenKey: false,
  });
});



// Re-export sanitize with server-specific fallback
function sanitizeRefineResponse(payload: any) {
  const result = sanitizeRefineResponseBase(payload);
  return result;
}

// REST Endpoint: Idea Refinement
app.post("/api/refine", async (req, res) => {
  const { 
    idea, 
    messages, 
    customGeminiKey, 
    customOpenAIKey, 
    customClaudeKey,
    customZenKey,
    targetModel = 'general',
    forceGenerate = false 
  } = req.body;

  if (!idea) {
    return res.status(400).json({ error: "An initial idea is required." });
  }

  // Collect configured providers
  const configuredProviders: Array<{ name: string; fn: () => Promise<any> }> = [];

  // Helper function to try Gemini
  async function tryGemini(): Promise<any> {
    if (!customGeminiKey && !process.env.GEMINI_API_KEY) return null;
    const activeKey = (customGeminiKey || process.env.GEMINI_API_KEY)?.replace(/[^\x20-\x7E]/g, '').trim();
    if (!activeKey || !activeKey.startsWith('AIzaSy')) return null;
    const ai = new GoogleGenAI({
      apiKey: activeKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const systemPromptMessage = getSystemInstruction(targetModel);
    const contentsPayload = buildGeminiContents(getAlternatingMessages(messages), forceGenerate);

    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash"
    ];

    let response = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Server attempting content generation using model: ${modelName}`);
        response = await ai.models.generateContent({
          model: modelName,
          contents: contentsPayload,
          config: {
            systemInstruction: systemPromptMessage,
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                message: {
                  type: Type.STRING,
                  description: "The coaching message, summary update, and the ONE question to propose next."
                },
                aspects: {
                  type: Type.OBJECT,
                  properties: {
                    primaryGoal: { type: Type.STRING, description: "Core purpose or application." },
                    targetAudience: { type: Type.STRING, description: "Who is this prompt made for?" },
                    toneStyle: { type: Type.STRING, description: "Required writing tone, format style, or custom persona." },
                    inputsRequired: { type: Type.STRING, description: "Runtime pieces, arguments, context, source material required." },
                    formatOutput: { type: Type.STRING, description: "Output specifications (e.g. bullet points, markdown, JSON, source block)." },
                    constraints: { type: Type.STRING, description: "Strict negative rules, boundaries, word limit." },
                  },
                  description: "The complete accumulated aspects extracted and cataloged so far."
                },
                progressScore: {
                  type: Type.INTEGER,
                  description: "Refinement maturity score from 0 to 100."
                },
                isCompleted: {
                  type: Type.BOOLEAN,
                  description: "True if we are finishing the interaction and outputting the prompt."
                },
                finalPrompt: {
                  type: Type.STRING,
                  description: "The finalized Prompt string. Include structured segments, details, and variables. Set to empty string if isCompleted is false."
                }
              },
              required: ["message", "aspects", "progressScore", "isCompleted", "finalPrompt"]
            }
          }
        });
        if (response && response.text) {
          console.log(`Server successfully generated content using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        const errMsg = err.message || String(err);
        const isRateLimit = errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('quota');
        console.warn(`Server model attempt failed for ${modelName}:`, errMsg);
        lastError = err;
        if (isRateLimit) {
          console.log(`Rate limit detected for ${modelName}, continuing to next model...`);
        }
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("All tried Gemini models failed to generate content.");
    }

    let cleanedText = response.text.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```(?:json)?\n?|```$/gi, "").trim();
    }
    const repairedText = repairJson(cleanedText);
    const payload = JSON.parse(repairedText);
    return sanitizeRefineResponse(payload);
  }

  // Helper function to try Claude
  async function tryClaude(): Promise<any> {
    if (!customClaudeKey) return null;
    const systemInst = getSystemInstruction(targetModel);
    const alternating = getAlternatingMessages(messages);
    const claudeMessages: any[] = [];
    for (let i = 0; i < alternating.length; i++) {
      const m = alternating[i];
      const role = m.role === 'model' ? 'assistant' : 'user';
      if (i === alternating.length - 1) {
        let contentText = m.content;
        if (forceGenerate) {
          contentText += `\n\n[SYSTEM DIRECTIVE]: Please finalize the interaction immediately. Set isCompleted to true, fill out all captured aspects, analyze the final maturity score, and compile the final Prompt in the "finalPrompt" field.`;
        } else {
          contentText += `\n\n[SYSTEM DIRECTIVE]: Analyze the user's newest input, update the captured aspects, analyze and calculate the prompt's maturity score from 0-100 following the rubric, specify what details are missing, formulate exactly one clarifying question or coaching suggestion, and output them in the required JSON format.`;
        }
        claudeMessages.push({ role, content: contentText });
      } else {
        claudeMessages.push({ role, content: m.content });
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": customClaudeKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: systemInst,
        messages: claudeMessages
      })
    });

    if (!response.ok) {
      const errVal = await response.text();
      throw new Error(`Claude API error: ${response.status} ${errVal}`);
    }

    const info = await response.json();
    const content = info.content?.[0]?.text;
    if (!content) {
      throw new Error("No textual response from Claude API.");
    }

    const cleanedContent = content.trim();
    const repaired = repairJson(cleanedContent);
    const parsed = JSON.parse(repaired);
    return sanitizeRefineResponse(parsed);
  }

  // Helper function to try OpenAI
  async function tryOpenAI(): Promise<any> {
    if (!customOpenAIKey) return null;
    const openAIMessages = buildOpenAIMessages(getAlternatingMessages(messages), getSystemInstruction(targetModel), forceGenerate);

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${customOpenAIKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: openAIMessages
      })
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.json();
      throw new Error(errorData.error?.message || `OpenAI returned status ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const content = openAIData.choices[0].message.content;
    const cleanedContent = content.trim();
    const repaired = repairJson(cleanedContent);
    const parsed = JSON.parse(repaired);
    return sanitizeRefineResponse(parsed);
  }

  // Helper function to try Zen
  async function tryZen(): Promise<any> {
    if (!customZenKey) return null;
    const cleanKey = customZenKey.replace(/[^\x20-\x7E]/g, '').trim();
    if (!cleanKey) return null;
    const zenMessages = buildOpenAIMessages(getAlternatingMessages(messages), getSystemInstruction(targetModel), forceGenerate);

    try {
      const zenResponse = await fetch("https://opencode.ai/zen/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: "big-pickle",
          response_format: { type: "json_object" },
          messages: zenMessages
        })
      });

      if (!zenResponse.ok) {
        const errorData = await zenResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Zen returned status ${zenResponse.status}`);
      }

      const zenData = await zenResponse.json();
      const content = zenData.choices[0].message.content;
      const cleanedContent = content.trim();
      const repaired = repairJson(cleanedContent);
      const parsed = JSON.parse(repaired);
      return sanitizeRefineResponse(parsed);
    } catch (err: any) {
      if (err.message?.includes('fetch') || err.message?.includes('ENOTFOUND') || err.message?.includes('ECONNREFUSED') || err.message?.includes('NetworkError')) {
        throw new Error('Zen: Network unavailable - opencode.ai may be down or unreachable');
      }
      throw err;
    }
  }

  // Build provider chain based on target model preference
  // Only include Zen when explicitly selected as target model
  const providerChain: Array<{ name: string; fn: () => Promise<any> }> = [];
  
  if (targetModel === 'gemini') {
    providerChain.push({ name: 'Gemini', fn: tryGemini });
    if (customOpenAIKey) providerChain.push({ name: 'OpenAI', fn: tryOpenAI });
    if (customClaudeKey) providerChain.push({ name: 'Claude', fn: tryClaude });
  } else if (targetModel === 'claude') {
    providerChain.push({ name: 'Claude', fn: tryClaude });
    if (customGeminiKey || process.env.GEMINI_API_KEY) providerChain.push({ name: 'Gemini', fn: tryGemini });
    if (customOpenAIKey) providerChain.push({ name: 'OpenAI', fn: tryOpenAI });
  } else if (targetModel === 'gpt') {
    providerChain.push({ name: 'OpenAI', fn: tryOpenAI });
    if (customGeminiKey || process.env.GEMINI_API_KEY) providerChain.push({ name: 'Gemini', fn: tryGemini });
    if (customClaudeKey) providerChain.push({ name: 'Claude', fn: tryClaude });
  } else if (targetModel === 'zen') {
    providerChain.push({ name: 'Zen', fn: tryZen });
    if (customGeminiKey || process.env.GEMINI_API_KEY) providerChain.push({ name: 'Gemini', fn: tryGemini });
    if (customClaudeKey) providerChain.push({ name: 'Claude', fn: tryClaude });
    if (customOpenAIKey) providerChain.push({ name: 'OpenAI', fn: tryOpenAI });
  } else {
    // Default order for general/other models
    if (customGeminiKey || process.env.GEMINI_API_KEY) providerChain.push({ name: 'Gemini', fn: tryGemini });
    if (customClaudeKey) providerChain.push({ name: 'Claude', fn: tryClaude });
    if (customOpenAIKey) providerChain.push({ name: 'OpenAI', fn: tryOpenAI });
  }

  // Validate that at least one provider is configured
  if (providerChain.length === 0) {
    return res.status(400).json({ 
      error: "No AI providers configured. Please add an API key in Settings." 
    });
  }

  // Try each provider sequentially until one succeeds
  const errors: string[] = [];
  for (const provider of providerChain) {
    try {
      const result = await provider.fn();
      if (result) return res.json(result);
    } catch (err: any) {
      errors.push(`${provider.name}: ${err.message}`);
      console.error(`${provider.name} refinement error:`, err);
    }
  }

  // All providers failed
  const configuredNames = providerChain.map(p => p.name);
  return res.status(500).json({ 
    error: `All AI providers failed: ${errors.join('; ')}. Configured providers: ${configuredNames.join(', ')}. Check your API keys in Settings.` 
  });
});



// Integrate Vite Dev Server Middleware or Serve Build
async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Idea to Prompt Server configured on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("CRITICAL: Failed to start server:", err);
  }
}

startServer();
