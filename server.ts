import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import {
  getSystemInstruction,
  isPureGreeting,
  sanitizeRefineResponse as sanitizeRefineResponseBase,
  repairJson,
  getAlternatingMessages,
  buildClaudeMessages,
  buildOpenAIMessages,
  buildGeminiContents,
  GREETING_RESPONSE,
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
    targetModel = 'general',
    forceGenerate = false 
  } = req.body;

  if (!idea) {
    return res.status(400).json({ error: "An initial idea is required." });
  }

  // Pure Greeting fast-path bypass if conversation is just starting
  const isInitialGreeting = isPureGreeting(idea) && (!messages || messages.length <= 1);
  if (isInitialGreeting) {
    return res.json({
      message: "Hello! I am your Prompt Engineering Coach. My goal is to help you design, refine, and optimize a professional-grade prompt for your specific needs. To get us started, what is the raw idea, task, or goal you want this prompt to accomplish? (e.g., 'An AI tutor for learning coding', 'A cold outreach email generator', etc.)",
      aspects: {},
      progressScore: 0,
      isCompleted: false,
      finalPrompt: null
    });
  }

  // --- Validate targetModel keys explicitly first to avoid misleading fallbacks ---
  if (targetModel === 'claude' && !customClaudeKey) {
    return res.status(400).json({ error: "No active Claude Key provided. Please set keys in Settings." });
  }
  if (targetModel === 'gpt' && !customOpenAIKey) {
    return res.status(400).json({ error: "No active OpenAI Key provided. Please set keys in Settings." });
  }
  if (targetModel === 'gemini' && !customGeminiKey) {
    return res.status(400).json({ error: "No active Gemini Key provided. Please set keys in Settings." });
  }

  // 1. Anthropic (Claude) Path
  if (customClaudeKey && (targetModel === 'claude' || (!customGeminiKey && !customOpenAIKey && !process.env.GEMINI_API_KEY))) {
    try {
      const systemInst = getSystemInstruction(targetModel);

      // Format messages into Claude standard role alternates without duplicate user triggers
      const claudeMessages: any[] = [];
      const alternating = getAlternatingMessages(messages);
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
        console.error("Claude API error:", response.status, errVal);
        throw new Error("The Claude service returned an error. Please check your key and try again.");
      }

      const info = await response.json();
      const content = info.content?.[0]?.text;
      if (!content) {
        throw new Error("No textual response from Claude API.");
      }

      const cleanedContent = content.trim();
      const repaired = repairJson(cleanedContent);
      const parsed = JSON.parse(repaired);
      const sanitized = sanitizeRefineResponse(parsed);
      return res.json(sanitized);
    } catch (claudeErr: any) {
      console.error("Claude processing error:", claudeErr);
      return res.status(500).json({ error: `Claude API Error: ${claudeErr.message}` });
    }
  }

  // 2. OpenAI (GPT) Path
  if (customOpenAIKey && (targetModel === 'gpt' || (!customGeminiKey && !process.env.GEMINI_API_KEY))) {
    try {
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
      const sanitized = sanitizeRefineResponse(parsed);
      return res.json(sanitized);
    } catch (openaiErr: any) {
      console.error("OpenAI error:", openaiErr);
      return res.status(500).json({ error: `OpenAI Service Error: ${openaiErr.message}` });
    }
  }

// 3. Default Path: Google Gemini
try {
  const activeKey = customGeminiKey;
  if (!activeKey) {
    return res.status(401).json({
      error: "No operational API Key detected. Please configure your own Gemini, GPT, or Claude key in the Settings modal."
    });
  }

  const ai = new GoogleGenAI({
    apiKey: activeKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

    const systemPromptMessage = getSystemInstruction(targetModel);

    // Format chat conversation roles correctly for Gemini API (alternating user/model)
    const contentsPayload = buildGeminiContents(getAlternatingMessages(messages), forceGenerate);

    const modelsToTry = [
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview"
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
        console.warn(`Server model attempt failed for ${modelName}:`, err.message || err);
        lastError = err;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("All tried Gemini models failed to generate content.");
    }

    let cleanedText = response.text.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```(?:json)?\n?|```$/gi, "").trim();
    }
    let payload;
    try {
      const repairedText = repairJson(cleanedText);
      payload = JSON.parse(repairedText);
      } catch (parseErr: any) {
        console.error("JSON PARSE FAILURE! Raw content length:", cleanedText.length);
        throw parseErr;
      }
    const sanitized = sanitizeRefineResponse(payload);
    return res.json(sanitized);
  } catch (error: any) {
    console.error("Gemini refinement error:", error);
    return res.status(500).json({ error: `Gemini refinement error: ${error.message || error}` });
  }
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
