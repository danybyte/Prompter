# Opencode Zen API Integration Plan

## Overview
Add Opencode Zen API as a 4th provider alongside Gemini, GPT, and Claude. Default model: `big-pickle`.

## Files to Modify

### 1. `src/types.ts` (line 24)
**Change:**
```typescript
// FROM:
targetModel: 'gemini' | 'gpt' | 'claude';

// TO:
targetModel: 'gemini' | 'gpt' | 'claude' | 'zen';
```

### 2. `src/shared/constants.ts`

**Add to `LOCAL_STORAGE_KEYS` (around line 39):**
```typescript
zenKey: "prompter_custom_zen_key",
```

**Add to `MODEL_DISPLAY_NAMES` (around line 26-30):**
```typescript
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  gemini: "Gemini",
  gpt: "ChatGPT",
  claude: "Claude",
  zen: "Zen"
};
```

### 3. `server.ts`

**Update `/api/config/status` endpoint (around line 29-33):**
```typescript
app.get("/api/config/status", (req, res) => {
  res.json({
    hasSystemGeminiKey: false,
    hasSystemZenKey: false,
  });
});
```

**Update `/api/refine` endpoint body destructuring (around line 45-53):**
```typescript
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
```

**Add Zen validation (after line 68):**
```typescript
if (targetModel === 'zen' && !customZenKey) {
  return res.status(400).json({ error: "No active Zen Key provided. Please set keys in Settings." });
}
```

**Add Zen provider route (before the Gemini default path, around line 168):**
```typescript
// 4. Opencode Zen Path
if (customZenKey && (targetModel === 'zen' || (!customGeminiKey && !customOpenAIKey && !customClaudeKey && !process.env.GEMINI_API_KEY))) {
  try {
    const zenMessages = buildOpenAIMessages(getAlternatingMessages(messages), getSystemInstruction(targetModel), forceGenerate);

    const zenResponse = await fetch("https://opencode.ai/zen/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${customZenKey}`
      },
      body: JSON.stringify({
        model: "big-pickle",
        response_format: { type: "json_object" },
        messages: zenMessages
      })
    });

    if (!zenResponse.ok) {
      const errorData = await zenResponse.json();
      throw new Error(errorData.error?.message || `Zen returned status ${zenResponse.status}`);
    }

    const zenData = await zenResponse.json();
    const content = zenData.choices[0].message.content;
    const cleanedContent = content.trim();
    const repaired = repairJson(cleanedContent);
    const parsed = JSON.parse(repaired);
    const sanitized = sanitizeRefineResponse(parsed);
    return res.json(sanitized);
  } catch (zenErr: any) {
    console.error("Zen error:", zenErr);
    return res.status(500).json({ error: `Zen Service Error: ${zenErr.message}` });
  }
}
```

### 4. `src/utils/aiRefiner.ts`

**Update function signature (line 19):**
```typescript
keys: { gemini: string; openai: string; claude: string; zen: string },
```

**Add `tryZen()` function (after `tryGemini()`, before provider fallback chain):**
```typescript
async function tryZen(): Promise<RefineResponse | null> {
  if (!keys.zen) return null;
  try {
    const serverRes = await fetch("/api/refine", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: operationalIdea, messages, customGeminiKey: keys.gemini, customOpenAIKey: keys.openai, customClaudeKey: keys.claude, customZenKey: keys.zen, targetModel, forceGenerate: forceComplete })
    });
    if (serverRes.ok) return await serverRes.json();
    const openAIMsg = buildOpenAIMessages(alternating, systemInst, forceComplete);
    const res = await fetch("https://opencode.ai/zen/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${keys.zen}` },
      body: JSON.stringify({ model: "big-pickle", response_format: { type: "json_object" }, messages: openAIMsg })
    });
    if (!res.ok) throw new Error(formatApiError(res.status, JSON.stringify(await res.json().catch(() => ({})))));
    const data = await res.json();
    return sanitizeRefineResponse(JSON.parse(repairJson(data.choices[0].message.content.trim())));
  } catch (err: any) { errors.push(`Zen: ${err.message}`); return null; }
}
```

**Update provider fallback chain (around line 117-127):**
```typescript
// Provider fallback chain
if (targetModel === 'claude') {
  const result = await tryClaude() ?? await tryOpenAI() ?? await tryGemini() ?? await tryZen();
  if (result) return result;
} else if (targetModel === 'gpt') {
  const result = await tryOpenAI() ?? await tryGemini() ?? await tryClaude() ?? await tryZen();
  if (result) return result;
} else if (targetModel === 'zen') {
  const result = await tryZen() ?? await tryOpenAI() ?? await tryGemini() ?? await tryClaude();
  if (result) return result;
} else {
  const result = await tryGemini() ?? await tryOpenAI() ?? await tryClaude() ?? await tryZen();
  if (result) return result;
}
```

### 5. `src/App.tsx`

**Add Zen key state (around line 183-185):**
```typescript
const [customZenKey, setCustomZenKey] = useState<string>(() => {
  return localStorage.getItem(LOCAL_STORAGE_KEYS.zenKey) || "";
});
```

**Add applyZenKey function (around line 227-229):**
```typescript
const applyZenKey = (value: string) => {
  setCustomZenKey(value);
  localStorage.setItem(LOCAL_STORAGE_KEYS.zenKey, value);
};
```

**Update `isConfigured` (around line 315):**
```typescript
const isConfigured = hasSystemKey || !!(customGeminiKey || customOpenAIKey || customClaudeKey || customZenKey);
```

**Update `handleOnlineRefine` call (around line 485-497):**
```typescript
const data = await handleOnlineRefine(
  nextMessages,
  {
    ...ideaState,
    originalIdea: operationalIdea
  },
  {
    gemini: customGeminiKey,
    openai: customOpenAIKey,
    claude: customClaudeKey,
    zen: customZenKey
  },
  forceComplete
);
```

**Update Zen error alerts (around line 526-534):**
```typescript
if (errMsg.includes('Zen') || errMsg.includes('opencode')) {
  setWarningMsg("Your Opencode Zen API key may be invalid or expired. Please check or update it in Settings.");
}
```

**Update `handleModelChange` type (line 566):**
```typescript
const handleModelChange = async (model: 'gemini' | 'gpt' | 'claude' | 'zen') => {
```

**Update `handleModelChange` keys object (around line 579-583):**
```typescript
{
  gemini: customGeminiKey,
  openai: customOpenAIKey,
  claude: customClaudeKey,
  zen: customZenKey
}
```

**Update `modelDisplayNames` (around line 627-631):**
```typescript
const modelDisplayNames: Record<string, string> = {
  gemini: "Gemini",
  gpt: "ChatGPT",
  claude: "Claude",
  zen: "Zen"
};
```

**Update `isActiveModelConfigured` (around line 634-637):**
```typescript
const isActiveModelConfigured =
  (ideaState.targetModel === 'gemini' && (hasSystemKey || !!customGeminiKey)) ||
  (ideaState.targetModel === 'gpt' && !!customOpenAIKey) ||
  (ideaState.targetModel === 'claude' && !!customClaudeKey) ||
  (ideaState.targetModel === 'zen' && !!customZenKey);
```

**Update `getActiveKeyInfo()` (around line 639-651):**
```typescript
const getActiveKeyInfo = () => {
  const name = modelDisplayNames[ideaState.targetModel] || "AI";

  if (ideaState.targetModel === 'gemini') {
    if (hasSystemKey) return "System Gemini Key (Active)";
    if (customGeminiKey) return "Custom Gemini Key (Active)";
  }
  if (ideaState.targetModel === 'gpt' && customOpenAIKey) return "Custom OpenAI Key (Active)";
  if (ideaState.targetModel === 'claude' && customClaudeKey) return "Custom Claude Key (Active)";
  if (ideaState.targetModel === 'zen' && customZenKey) return "Custom Zen Key (Active)";

  return `${name} API not added, you can change API in setting`;
};
```

**Update model selector buttons (around line 688-706):**
```typescript
{[
  { id: "gemini", label: "Gemini" },
  { id: "gpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "zen", label: "Zen" }
].map((item) => (
```

**Add Zen API key input in Settings modal (after Claude key input, around line 1429):**
```typescript
<div>
  <label className="text-[10px] tracking-wider uppercase font-bold text-[var(--color-natural-muted)] block mb-1">
    Opencode Zen API Key
  </label>
  <input
    name="zKey"
    type="password"
    value={customZenKey}
    onChange={(e) => applyZenKey(e.target.value)}
    placeholder="Zen API Key..."
    className="w-full bg-[var(--color-natural-card)] border border-natural-border p-2 rounded text-xs focus:ring-1 focus:ring-natural-accent focus:outline-none"
  />
  <span className="text-[9px] text-[var(--color-natural-light-muted)] block mt-0.5">
    Opencode Zen (big-pickle model). OpenAI-compatible format.
  </span>
</div>
```

**Update initial session bootstrap targetModel (around line 291 and 409):**
```typescript
targetModel: "gemini" as const
```
(Or change to "zen" if you want Zen as default)

**Update derived ideaState default targetModel (around line 311):**
```typescript
targetModel: "gemini" as const
```
