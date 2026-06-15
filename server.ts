import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import {
  getSystemInstruction,
  sanitizeRefineResponse,
  repairJson,
  getAlternatingMessages,
  buildGeminiContents
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



// REST Endpoint: Idea Refinement
app.post("/api/refine", async (req, res) => {
  const { 
    idea, 
    messages, 
    customGeminiKey,
    forceGenerate = false 
  } = req.body;

  if (!idea) {
    return res.status(400).json({ error: "An initial idea is required." });
  }

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

    const systemPromptMessage = getSystemInstruction();
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

  // Use Gemini only
  if (!customGeminiKey && !process.env.GEMINI_API_KEY) {
    return res.status(400).json({ 
      error: "No Gemini API key configured. Please add an API key in Settings." 
    });
  }

  try {
    const result = await tryGemini();
    if (result) return res.json(result);
  } catch (err: any) {
    console.error('Gemini refinement error:', err);
    return res.status(500).json({ 
      error: `Gemini failed: ${err.message}. Check your API key in Settings.` 
    });
  }

  return res.status(500).json({ 
    error: "Gemini failed to respond. Check your API key in Settings." 
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
