
export const SYSTEM_DIRECTIVE_ANALYZE = `
[SYSTEM DIRECTIVE]: Analyze the user's newest input, update the captured aspects, analyze and calculate the prompt's maturity score from 0-100 following the rubric, specify what details are missing, formulate exactly one clarifying question or coaching suggestion, and output them in the required JSON format.`;
export const SYSTEM_DIRECTIVE_FINALIZE = `
[SYSTEM DIRECTIVE]: Please finalize the interaction immediately. Set isCompleted to true, fill out all captured aspects, analyze the final maturity score, and compile the final Prompt in the "finalPrompt" field.`;

export const SUGGESTION_CHIPS = {
  initial: [
    "A fitness habit builder for busy parents",
    "A script that extracts keywords from PDFs",
    "A personal chef meal-planner prompt",
    "A customer support email replying assistant"
  ],
  completed: [
    "Make the tone more professional",
    "Make it more concise & brief",
    "Add a strict negative constraint",
    "Show step-by-step thinking process"
  ],
  inProgress: [
    "I want to keep it simple and under 3 paragraphs",
    "No special external parameters are needed",
    "Generate my prompt now with current state"
  ]
};
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  gemini: "Gemini",
  gpt: "ChatGPT",
  claude: "Claude",
  zen: "Zen"
};
export const GEMINI_MODELS_TO_TRY = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash"
];
export const LOCAL_STORAGE_KEYS = {
  geminiKey: "prompter_custom_gemini_key",
  openaiKey: "prompter_custom_openai_key",
  claudeKey: "prompter_custom_claude_key",
  zenKey: "prompter_custom_zen_key",
  theme: "prompter_settings_theme",
  fontSize: "prompter_settings_fontSize",
  darkMode: "prompter_settings_darkMode",
  sessions: "prompter_refiner_sessions"
} as const;

export const API_ERROR_MESSAGES: Record<number, string> = {
  429: "Rate limit reached. The AI service is temporarily unavailable. Try again in a moment, or add another provider key in Settings for automatic fallback.",
  401: "Invalid API key. Please check your key in Settings and try again.",
  403: "Access denied. Your API key may not have permission for this model.",
  500: "The AI service encountered an internal error. Please try again.",
  503: "The AI service is temporarily unavailable. Please retry shortly."
};

export function formatApiError(status: number, body: string): string {
  const friendly = API_ERROR_MESSAGES[status];
  if (friendly) return friendly;
  try {
    const parsed = JSON.parse(body);
    if (parsed.error?.message) {
      const msg = parsed.error.message.split(String.fromCharCode(10))[0];
      const short = msg.length > 80 ? msg.substring(0, 77) + "..." : msg;
      return `API Error (${status}): ${short}`;
    }
  } catch (_) {}
  return `API request failed with status ${status}.`;
}
