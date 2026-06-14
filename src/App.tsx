import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Send,
  Copy,
  Check,
  Settings,
  Activity,
  X,
  AlertTriangle,
  Lightbulb,
  Plus,
  Trash2,
  Edit3,
  Github,
  Mail,
  ChevronRight,
  BookOpen,
  Menu,
  CheckCircle2
} from "lucide-react";
import { ChatMessage, IdeaState, RefineResponse } from "./types";
import { LOCAL_STORAGE_KEYS, SUGGESTION_CHIPS } from "./shared";
import { handleOnlineRefine } from "./utils/aiRefiner";

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
  ideaState: IdeaState;
}

// Preset Themes config
const themes: Record<string, {
  light: {
    bg: string;
    text: string;
    muted: string;
    lightMuted: string;
    border: string;
    panel: string;
    accent: string;
    dark: string;
    card: string;
    subtle: string;
  };
  dark: {
    bg: string;
    text: string;
    muted: string;
    lightMuted: string;
    border: string;
    panel: string;
    accent: string;
    dark: string;
    card: string;
    subtle: string;
  };
}> = {
  sage: {
    light: {
      bg: "#FDFCFB",
      text: "#4A443F",
      muted: "#8E8883",
      lightMuted: "#A8A29D",
      border: "#EAE7E2",
      panel: "#F9F8F6",
      accent: "#8C927D",
      dark: "#4A443F",
      card: "#FFFFFF",
      subtle: "#F4F1EC"
    },
    dark: {
      bg: "#121211",
      text: "#E5E1DC",
      muted: "#A29D98",
      lightMuted: "#797571",
      border: "#2C2A28",
      panel: "#1A1918",
      accent: "#BAC1AF",
      dark: "#F5F2EE",
      card: "#252321",
      subtle: "#1F1D1C"
    }
  },
  slate: {
    light: {
      bg: "#F3F4F6",
      text: "#1F2937",
      muted: "#4B5563",
      lightMuted: "#9CA3AF",
      border: "#E5E7EB",
      panel: "#FFFFFF",
      accent: "#4B5563",
      dark: "#1F2937",
      card: "#FFFFFF",
      subtle: "#F9FAFB"
    },
    dark: {
      bg: "#0B0F19",
      text: "#E2E8F0",
      muted: "#94A3B8",
      lightMuted: "#475569",
      border: "#1E293B",
      panel: "#111827",
      accent: "#64748B",
      dark: "#F8FAFC",
      card: "#1E293B",
      subtle: "#0F172A"
    }
  },
  ocean: {
    light: {
      bg: "#F0F5FA",
      text: "#0F172A",
      muted: "#475569",
      lightMuted: "#94A3B8",
      border: "#D2E2F0",
      panel: "#FFFFFF",
      accent: "#0284C7",
      dark: "#0F172A",
      card: "#FFFFFF",
      subtle: "#F8FAFC"
    },
    dark: {
      bg: "#081325",
      text: "#E0F2FE",
      muted: "#7DD3FC",
      lightMuted: "#0369A1",
      border: "#132D50",
      panel: "#0B1E36",
      accent: "#38BDF8",
      dark: "#F0F9FF",
      card: "#112240",
      subtle: "#0A192F"
    }
  },
  purple: {
    light: {
      bg: "#FAF5FF",
      text: "#3B0764",
      muted: "#701A75",
      lightMuted: "#D8B4FE",
      border: "#EAD6FC",
      panel: "#FFFFFF",
      accent: "#9333EA",
      dark: "#3B0764",
      card: "#FFFFFF",
      subtle: "#FAF5FF"
    },
    dark: {
      bg: "#120224",
      text: "#F3E8FF",
      muted: "#D8B4FE",
      lightMuted: "#7E22CE",
      border: "#4A0E80",
      panel: "#1D0936",
      accent: "#C084FC",
      dark: "#FAF5FF",
      card: "#2E1065",
      subtle: "#1E1B4B"
    }
  }
};

// Helper to detect if content is RTL (Persian, Arabic, Urdu, Hebrew, etc.)
const isRTL = (text: string): boolean => {
  if (!text) return false;
  const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return rtlRegex.test(text);
};

export default function App() {
  // Config & API Keys state
  const [customGeminiKey, setCustomGeminiKey] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.geminiKey) || "";
  });
  const [customOpenAIKey, setCustomOpenAIKey] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.openaiKey) || "";
  });
  const [customClaudeKey, setCustomClaudeKey] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.claudeKey) || "";
  });
  const [customZenKey, setCustomZenKey] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.zenKey) || "";
  });

  // Settings customizable options
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.theme) || "sage";
  });
  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.fontSize) || "md";
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.darkMode) === "true";
  });
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Immediately apply and persist dark mode change
  const applyDarkMode = (value: boolean) => {
    setDarkMode(value);
    localStorage.setItem(LOCAL_STORAGE_KEYS.darkMode, value ? "true" : "false");
  };

  // Immediately apply and persist theme change
  const applyTheme = (value: string) => {
    setTheme(value);
    localStorage.setItem(LOCAL_STORAGE_KEYS.theme, value);
  };

  // Immediately apply and persist font size change
  const applyFontSize = (value: string) => {
    setFontSize(value);
    localStorage.setItem(LOCAL_STORAGE_KEYS.fontSize, value);
  };

  // Auto-persist API keys the moment they change (no Save button needed)
  const applyGeminiKey = (value: string) => {
    setCustomGeminiKey(value);
    localStorage.setItem(LOCAL_STORAGE_KEYS.geminiKey, value);
  };
  const applyOpenAIKey = (value: string) => {
    setCustomOpenAIKey(value);
    localStorage.setItem(LOCAL_STORAGE_KEYS.openaiKey, value);
  };
  const applyClaudeKey = (value: string) => {
    setCustomClaudeKey(value);
    localStorage.setItem(LOCAL_STORAGE_KEYS.claudeKey, value);
  };
  const applyZenKey = (value: string) => {
    setCustomZenKey(value);
    localStorage.setItem(LOCAL_STORAGE_KEYS.zenKey, value);
  };

  // Detection of system-configured Gemini API key on the backend
  const [hasSystemKey, setHasSystemKey] = useState<boolean>(false);
  useEffect(() => {
    fetch("/api/config/status")
      .then(res => res.json())
      .then(data => {
        setHasSystemKey(!!data.hasSystemGeminiKey);
      })
      .catch(err => console.error("Error loading system key configuration:", err));
  }, []);

  const [showMobileDrawer, setShowMobileDrawer] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState<boolean>(false);
  const lastSentInputRef = useRef<string>('');
  const [inputVal, setInputVal] = useState<string>("");

  // Iframe-safe, non-blocking modal confirmations & notifications
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  useEffect(() => {
    if (warningMsg) {
      const timer = setTimeout(() => setWarningMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [warningMsg]);

  // Rename session inline editing states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState<string>("");

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load and seed saved chat history sessions
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.sessions);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Error loading chat workspace sessions:", e);
      }
    }
    const bootstrapId = crypto.randomUUID();
    const initSession: ChatSession = {
      id: bootstrapId,
      title: "New Session",
      createdAt: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      messages: [],
      ideaState: {
        originalIdea: "",
        currentDraft: "",
        aspects: {},
        progressScore: 0,
        isCompleted: false,
        finalPrompt: null,
        targetModel: "gemini"
      }
    };
    return [initSession];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || "";
  });

  // Derived working states
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages || [];
  const ideaState = activeSession?.ideaState || {
    originalIdea: "",
    currentDraft: "",
    aspects: {},
    progressScore: 0,
    isCompleted: false,
    finalPrompt: null,
    targetModel: "gemini"
  };

  // Helper selectors
  const isConfigured = hasSystemKey || !!(customGeminiKey || customOpenAIKey || customClaudeKey || customZenKey);
  const activeTheme = darkMode
    ? (themes[theme]?.dark || themes.sage.dark)
    : (themes[theme]?.light || themes.sage.light);

  // Sync workbook to localstorage on change
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.sessions, JSON.stringify(sessions));
  }, [sessions]);

  // Scroll chat to bottom on new updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loadingSessionId]);

  // Auto-grow the message textarea to fit its content (up to a cap, then scroll)
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [inputVal]);

  // Unified mutators that save states directly back into the workbook array
  const setMessages = (vals: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          const updatedMsgs = typeof vals === "function" ? vals(s.messages) : vals;
          return { ...s, messages: updatedMsgs };
        }
        return s;
      })
    );
  };

  const setIdeaState = (vals: IdeaState | ((prev: IdeaState) => IdeaState)) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          const updatedState = typeof vals === "function" ? vals(s.ideaState) : vals;
          return { ...s, ideaState: updatedState };
        }
        return s;
      })
    );
  };

  const updateSessionWithAIResponse = (nextMessages: ChatMessage[], nextState: IdeaState) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          let title = s.title;
          if (title === "New Session" || title === "") {
            const firstUserMsg = nextMessages.find(m => m.role === 'user');
            if (firstUserMsg && firstUserMsg.content) {
              const cleaned = firstUserMsg.content.trim();
              title = cleaned.length > 25 ? cleaned.slice(0, 23) + "..." : cleaned;
            }
          }
          return {
            ...s,
            title,
            messages: nextMessages,
            ideaState: nextState
          };
        }
        return s;
      })
    );
  };

  const handleSwitchSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setEditingSessionId(null);
  };

  const handleNewSession = () => {
    const newId = crypto.randomUUID();
    const fresh: ChatSession = {
      id: newId,
      title: "New Session",
      createdAt: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      messages: [],
      ideaState: {
        originalIdea: "",
        currentDraft: "",
        aspects: {},
        progressScore: 0,
        isCompleted: false,
        finalPrompt: null,
        targetModel: "gemini"
      }
    };
    setSessions(prev => [fresh, ...prev]);
    setActiveSessionId(newId);
    setEditingSessionId(null);
  };

  // Safe non-blocking trigger for Deletion overlay
  const handleDeleteSessionBtn = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      setWarningMsg("You must keep at least one active refinement session in your history!");
      return;
    }
    setDeleteTargetId(idToDelete);
  };

  const executeDeleteSession = () => {
    if (!deleteTargetId) return;
    const filtered = sessions.filter(s => s.id !== deleteTargetId);
    setSessions(filtered);
    if (activeSessionId === deleteTargetId) {
      setActiveSessionId(filtered[0].id);
    }
    setDeleteTargetId(null);
    setWarningMsg("Session deleted successfully!");
  };

  // Inline rename session title submit callback
  const handleRenameSessionSubmit = (idToRename: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedTitle = editingSessionTitle.trim();
    if (!trimmedTitle) {
      setEditingSessionId(null);
      return;
    }
    setSessions(prev =>
      prev.map(s => {
        if (s.id === idToRename) {
          return { ...s, title: trimmedTitle };
        }
        return s;
      })
    );
    setEditingSessionId(null);
  };

  const handleRefine = async (userInput: string, forceComplete: boolean = false) => {
    if (!userInput.trim() && !forceComplete) return;

    setLoadingSessionId(activeSessionId);

    const finalInput = userInput;
    lastSentInputRef.current = finalInput;
    setShowRetry(false);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: finalInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputVal("");

    const operationalIdea = ideaState.originalIdea || finalInput;

    try {
      const hasKey = hasSystemKey || !!(customGeminiKey || customOpenAIKey || customClaudeKey || customZenKey);
      if (!hasKey) {
        throw new Error("No API key configured. Please add an API key in Settings.");
      }

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

      const modelMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        content: data.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const finalMessages = [...nextMessages, modelMessage];
      const nextOriginalIdea = ideaState.originalIdea || finalInput;

      const nextState: IdeaState = {
        ...ideaState,
        originalIdea: nextOriginalIdea,
        aspects: { ...ideaState.aspects, ...(data.aspects || {}) },
        progressScore: Math.min(data.progressScore, 100),
        isCompleted: data.isCompleted,
        finalPrompt: data.finalPrompt
      };

      updateSessionWithAIResponse(finalMessages, nextState);

    } catch (err: any) {
      console.error(err);
      setShowRetry(true);
      const errMsg = err.message || "Failed to contact refinement server.";
      
      // Show API key alert for provider-specific errors
      if (errMsg.includes('Claude') || errMsg.includes('Anthropic')) {
        setWarningMsg("Your Claude (Anthropic) API key may be invalid or expired. Please check or update it in Settings.");
      } else if (errMsg.includes('OpenAI')) {
        setWarningMsg("Your OpenAI API key may be invalid or expired. Please check or update it in Settings.");
      } else if (errMsg.includes('Gemini') || errMsg.includes('Google')) {
        setWarningMsg("Your Gemini API key may be invalid or expired. Please check or update it in Settings.");
      } else if (errMsg.includes('Zen') || errMsg.includes('opencode')) {
        setWarningMsg("Your Opencode Zen API key may be invalid or expired. Please check or update it in Settings.");
      } else if (errMsg.includes('All AI providers failed') || errMsg.includes('Check your API keys')) {
        setWarningMsg("All AI providers failed. Please check your API keys in Settings.");
      }
      
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "model",
        content: "Error: " + errMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      const finalMessages = [...nextMessages, errorMessage];
      const nextOriginalIdea = ideaState.originalIdea || finalInput;
      const nextState: IdeaState = {
        ...ideaState,
        originalIdea: nextOriginalIdea
      };
      updateSessionWithAIResponse(finalMessages, nextState);
    } finally {
      setLoadingSessionId(null);
    }
  };

  const handleStop = () => {
    setLoadingSessionId(null);
    setShowRetry(true);
  };

  const handleRetry = () => {
    if (lastSentInputRef.current) {
      setShowRetry(false);
      handleRefine(lastSentInputRef.current);
    }
  };

  const handleModelChange = async (model: 'gemini' | 'gpt' | 'claude' | 'zen') => {
    setIdeaState(prev => ({ ...prev, targetModel: model }));

    const hasKey = hasSystemKey || !!(customGeminiKey || customOpenAIKey || customClaudeKey || customZenKey);
    if (messages.length > 0 && hasKey) {
      setLoadingSessionId(activeSessionId);
      try {
        const data = await handleOnlineRefine(
          messages,
          {
            ...ideaState,
            targetModel: model
          },
          {
            gemini: customGeminiKey,
            openai: customOpenAIKey,
            claude: customClaudeKey,
            zen: customZenKey
          },
          ideaState.isCompleted
        );

        setIdeaState(prev => ({
          ...prev,
          aspects: data.aspects || {},
          progressScore: Math.min(data.progressScore, 100),
          isCompleted: data.isCompleted,
          finalPrompt: data.finalPrompt
        }));
      } catch (err: any) {
        console.error("Failed to re-compile layout formats:", err);
        if (err.message && err.message.includes('API')) {
          setWarningMsg("API key error. Please check your keys in Settings.");
        }
      } finally {
        setLoadingSessionId(null);
      }
    }
  };

  const handleCopy = () => {
    if (ideaState.finalPrompt) {
      navigator.clipboard.writeText(ideaState.finalPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getSuggestionChips = () => {
    if (messages.length === 0) return SUGGESTION_CHIPS.initial;
    if (ideaState.isCompleted) return SUGGESTION_CHIPS.completed;
    if (ideaState.progressScore > 10 && ideaState.progressScore < 95) return SUGGESTION_CHIPS.inProgress;
    return [];
  };

  const getProgressColor = (score: number) => {
    if (score < 40) return "bg-natural-accent/50";
    if (score < 80) return "bg-natural-accent";
    return "bg-natural-dark";
  };

  // Model display names
  const modelDisplayNames: Record<string, string> = {
    gemini: "Gemini",
    gpt: "ChatGPT",
    claude: "Claude",
    zen: "Zen"
  };

  // Check if current model has API key
  const isActiveModelConfigured =
    (ideaState.targetModel === 'gemini' && (hasSystemKey || !!customGeminiKey)) ||
    (ideaState.targetModel === 'gpt' && !!customOpenAIKey) ||
    (ideaState.targetModel === 'claude' && !!customClaudeKey) ||
    (ideaState.targetModel === 'zen' && !!customZenKey);

  const getActiveKeyInfo = () => {
    const name = modelDisplayNames[ideaState.targetModel] || "AI";

    if (ideaState.targetModel === 'gemini') {
      if (hasSystemKey) return "System Gemini Key (Active)";
      if (customGeminiKey) return "Custom Gemini Key (Active)";
    }
    if (ideaState.targetModel === 'gpt' && customOpenAIKey) return "Custom OpenAI Key (Active)";
    if (ideaState.targetModel === 'claude' && customClaudeKey) return "Custom Claude Key (Active)";
    if (ideaState.targetModel === 'zen' && customZenKey) return "Custom Zen Key (Active)";

    // Current model has no key
    return `${name} API not added, you can change API in setting`;
  };

  const renderControlPanel = (isOnMobileDrawer: boolean = false) => {
    return (
      <>
        {/* Status Coach Panel */}
        <div className="bg-[var(--color-natural-panel)] border border-natural-border rounded-xl p-5 shadow-xs shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-natural-accent" />
              <h2 className="text-sm font-semibold tracking-tight text-[var(--color-natural-dark)]">Idea Maturity Dashboard</h2>
            </div>
            <span className="text-xs font-mono font-bold text-[var(--color-natural-text)] bg-[var(--color-natural-bg)] border border-natural-border rounded px-1.5 py-0.5">
              {ideaState.progressScore}% Clarified
            </span>
          </div>

          {/* Maturity score bar */}
          <div className="w-full bg-[var(--color-natural-subtle)] rounded-full h-2.5 overflow-hidden border border-natural-border">
            <motion.div
              className={`h-full ${getProgressColor(ideaState.progressScore)}`}
              initial={ { width: 0 } }
              animate={ { width: `${ideaState.progressScore}%` } }
              transition={ { duration: 0.5, ease: "easeOut" } }
            />
          </div>

          <p className="text-[11px] text-[var(--color-natural-muted)] mt-2">
            As each specification is clarified, the maturity score increases. Aim for 80%+ to generate a premium-grade instructing prompt.
          </p>

          {/* Target model selector */}
          <div className="mt-4 pt-4 border-t border-natural-border">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-natural-light-muted)] block mb-2">
              Target Output Framework
            </label>
            <div className="grid grid-cols-4 gap-1.5 bg-[var(--color-natural-subtle)] border border-natural-border p-1 rounded-lg">
              {[
                { id: "gemini", label: "Gemini" },
                { id: "gpt", label: "ChatGPT" },
                { id: "claude", label: "Claude" },
                { id: "zen", label: "Zen" }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleModelChange(item.id as any)}
                  className={`text-[11px] font-medium py-1.5 rounded-md transition cursor-pointer ${
                    ideaState.targetModel === item.id
                      ? "bg-[var(--color-natural-card)] text-[var(--color-natural-dark)] shadow-xs border border-natural-border font-semibold"
                      : "text-[var(--color-natural-muted)] hover:text-[var(--color-natural-dark)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Workbook History Panel */}
        <div className={`bg-[var(--color-natural-panel)] border border-natural-border rounded-xl p-4 shadow-xs flex flex-col ${
          isOnMobileDrawer ? "shrink-0" : "flex-1 overflow-hidden min-h-0"
        }`}>
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-natural-accent" />
              <h2 className="text-xs font-bold text-[var(--color-natural-text)] uppercase tracking-widest">
                History
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                handleNewSession();
                if (isOnMobileDrawer) {
                  setShowMobileDrawer(false);
                }
              }}
              className="p-1 px-2.5 bg-natural-accent hover:opacity-95 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
              title="Create a new draft prompt"
            >
              <Plus className="h-3 w-3" />
              <span>New Session</span>
            </button>
          </div>

          {/* Chat list history */}
          <div className={`space-y-2 pr-1 pt-1 ${
            isOnMobileDrawer ? "" : "flex-1 overflow-y-auto min-h-[220px]"
          }`}>
            {sessions.map((s) => {
              const isActive = s.id === activeSessionId;
              const score = s.ideaState?.progressScore || 0;
              const hasFinished = s.ideaState?.isCompleted;
              const activeModel = s.ideaState?.targetModel || "general";

              if (editingSessionId === s.id) {
                return (
                  <div
                    key={s.id}
                    onClick={(e) => e.stopPropagation()}
                    className="border border-natural-accent bg-natural-panel rounded-lg p-3 shadow-xs"
                  >
                    <form
                      onSubmit={(e) => handleRenameSessionSubmit(s.id, e)}
                      className="flex flex-col gap-2"
                    >
                      <input
                        type="text"
                        value={editingSessionTitle}
                        onChange={(e) => setEditingSessionTitle(e.target.value)}
                        className="w-full bg-[var(--color-natural-card)] border border-natural-border px-2 py-1 rounded text-xs focus:ring-1 focus:ring-natural-accent focus:outline-none"
                        placeholder="Session title..."
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingSessionId(null);
                        }}
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingSessionId(null)}
                          className="px-2 py-0.5 text-[10px] bg-[var(--color-natural-subtle)] hover:opacity-80 rounded font-semibold text-[var(--color-natural-muted)] transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-2 py-0.5 text-[10px] bg-natural-accent hover:opacity-90 text-white rounded font-semibold transition"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  </div>
                );
              }

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    handleSwitchSession(s.id);
                    if (isOnMobileDrawer) {
                      setShowMobileDrawer(false);
                    }
                  }}
                  className={`relative border rounded-lg p-3 transition duration-150 cursor-pointer group ${
                    isActive
                      ? "border-natural-accent bg-[var(--color-natural-subtle)] shadow-xs"
                      : "border-natural-border bg-[var(--color-natural-card)] hover:bg-[var(--color-natural-subtle)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0" dir={isRTL(s.title) ? "rtl" : "ltr"}>
                      <p className={`text-xs font-semibold text-[var(--color-natural-text)] truncate leading-snug ${
                        isRTL(s.title) ? 'text-right' : 'text-left'
                      }`}>
                        {s.title || "New Refinement Session"}
                      </p>
                      <p className={`text-[10px] text-[var(--color-natural-light-muted)] mt-1 flex items-center gap-1 ${
                        isRTL(s.title) ? 'justify-start flex-row-reverse' : 'justify-start'
                      }`}>
                        <span>{s.createdAt}</span>
                        <span>•</span>
                        <span className="uppercase font-semibold tracking-wider text-natural-accent text-[9px] bg-[var(--color-natural-subtle)] px-1 rounded">
                          {activeModel}
                        </span>
                      </p>
                    </div>

                    {/* Small badge display progress info & action triggers */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 ${
                        hasFinished
                          ? "bg-green-100 text-green-700 font-bold border border-green-200"
                          : "bg-[var(--color-natural-subtle)] text-[var(--color-natural-text)]"
                      }`}>
                        {hasFinished ? "Ready" : `${score}%`}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(s.id);
                          setEditingSessionTitle(s.title || "");
                        }}
                        className="p-1 hover:bg-[var(--color-natural-subtle)] text-[var(--color-natural-light-muted)] hover:text-[var(--color-natural-text)] rounded transition opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        title="Rename prompt session"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSessionBtn(s.id, e);
                        }}
                        className="p-1 hover:bg-red-50 text-[var(--color-natural-light-muted)] hover:text-red-500 rounded transition opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        title="Delete prompt chat"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  };

  return (
    <div
      className="h-screen overflow-hidden flex flex-col selection:bg-natural-accent/20"
      style={ {
        backgroundColor: activeTheme.bg,
        color: activeTheme.text,
        '--color-natural-bg': activeTheme.bg,
        '--color-natural-text': activeTheme.text,
        '--color-natural-muted': activeTheme.muted,
        '--color-natural-light-muted': activeTheme.lightMuted,
        '--color-natural-border': activeTheme.border,
        '--color-natural-panel': activeTheme.panel,
        '--color-natural-accent': activeTheme.accent,
        '--color-natural-dark': activeTheme.dark,
        '--color-natural-card': activeTheme.card,
        '--color-natural-subtle': activeTheme.subtle,
        fontSize: fontSize === 'sm' ? '12px' : fontSize === 'lg' ? '15.5px' : '14px'
      } as any}
    >
      <style>{`
        .text-xs { font-size: ${fontSize === 'sm' ? '11px' : fontSize === 'lg' ? '13px' : '12px'} !important; }
        .text-sm { font-size: ${fontSize === 'sm' ? '12px' : fontSize === 'lg' ? '15px' : '14px'} !important; }
        .text-base { font-size: ${fontSize === 'sm' ? '14px' : fontSize === 'lg' ? '18px' : '16px'} !important; }
        .text-lg { font-size: ${fontSize === 'sm' ? '15.5px' : fontSize === 'lg' ? '20px' : '18px'} !important; }
        .text-xl { font-size: ${fontSize === 'sm' ? '17.5px' : fontSize === 'lg' ? '23px' : '20px'} !important; }
        .text-2xl { font-size: ${fontSize === 'sm' ? '20px' : fontSize === 'lg' ? '27px' : '24px'} !important; }
        .text-3xl { font-size: ${fontSize === 'sm' ? '24px' : fontSize === 'lg' ? '33px' : '30px'} !important; }
      `}</style>

      {/* Header section */}
      <header 
        className={`border-b sticky top-0 z-10 px-4 md:px-6 py-3 flex items-center justify-between shrink-0 shadow-xs ${
          darkMode ? 'border-[#1f1d2b]' : 'border-neutral-200'
        }`}
        style={{ backgroundColor: darkMode ? '#0c0a11' : '#ffffff' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowMobileDrawer(true)}
            className={`lg:hidden p-1.5 rounded-lg transition ${
              darkMode ? 'hover:bg-[#1f1d2b] text-white' : 'hover:bg-neutral-100 text-neutral-700'
            }`}
            title="Open Control Panel & History"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo */}
          <div className="flex items-center justify-center">
            <img src="/favicon.png" alt="Prompter Logo" className="h-10 w-10 object-contain" />
          </div>
          
          <div>
            {/* Title text - Dark in light mode, White in dark mode */}
            <h1 className={`text-lg font-bold tracking-tight ${darkMode ? 'text-white' : 'text-neutral-900'}`}>Prompter</h1>
            <p className={`text-xs ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>Make your idea to a good prompt, then a good result.</p>
          </div>
        </div>

        {/* Global Control Bar */}
        <div className="flex items-center gap-3">
          <div className={`hidden sm:flex items-center gap-1 text-[11px] font-medium border rounded-full px-3 py-1 ${
            isActiveModelConfigured
              ? darkMode 
                ? 'text-neutral-300 bg-[#1f1d2b] border-[#2d2a3e]' 
                : 'text-neutral-700 bg-neutral-100 border-neutral-200'
              : 'text-red-600 bg-red-50 border-red-200'
          }`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${isActiveModelConfigured ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {getActiveKeyInfo()}
          </div>

          <a
            href="https://github.com/danybyte"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub Profile"
            className={`p-1.5 rounded-lg transition ${
              darkMode ? 'hover:bg-[#1f1d2b] text-white' : 'hover:bg-neutral-100 text-neutral-700'
            }`}
          >
            <Github className="h-4 w-4" />
          </a>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className={`p-1.5 rounded-lg transition relative ${
              darkMode ? 'hover:bg-[#1f1d2b] text-white' : 'hover:bg-neutral-100 text-neutral-700'
            }`}
            title="Customize and Keys Setup"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Dual Workspace Grid */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden min-h-0">

        {/* Left column: Status & Chat History Workbook */}
        <section className="hidden lg:flex lg:col-span-5 flex-col gap-4 lg:h-full lg:overflow-hidden min-h-0">
          {renderControlPanel(false)}
        </section>

        {/* Right column: Interactive Coach Session (Chat) */}
        <section className="lg:col-span-7 flex flex-col bg-[var(--color-natural-panel)] border border-natural-border rounded-xl shadow-sm overflow-hidden h-full min-h-0">

          {/* Interactive message rendering list */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 select-text bg-[var(--color-natural-bg)]"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
                <div className="h-12 w-12 bg-[var(--color-natural-subtle)] text-natural-accent border border-natural-border rounded-xl flex items-center justify-center mb-4 shadow-sm">
                  <img src="/favicon.png" alt="Prompter Logo" className="h-6 w-6 object-contain" />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-natural-dark)]">Let's refine your idea together</h3>
                <p className="text-xs text-[var(--color-natural-muted)] mt-1.5 leading-relaxed font-normal">
                  Add an API key in Settings, then provide your raw idea. The AI Coach will guide you step-by-step and compile a premium-grade structured system prompt.
                </p>

                {/* Initial suggestion prompts */}
                <div className="w-full mt-6 text-left shrink-0">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-natural-light-muted)] block mb-2.5 text-center">
                    Select a boilerplate catalyst to start:
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {getSuggestionChips().map((chip, idx) => {
                      const chipRtl = isRTL(chip);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleRefine(chip)}
                          dir={chipRtl ? "rtl" : "ltr"}
                          className={`text-xs text-[var(--color-natural-text)] hover:text-[var(--color-natural-dark)] bg-[var(--color-natural-card)] hover:bg-[var(--color-natural-subtle)] border border-natural-border p-2.5 rounded-lg transition flex items-center justify-between group cursor-pointer shadow-xs ${
                            chipRtl ? "text-right flex-row-reverse" : "text-left"
                          }`}
                        >
                          <span className="font-semibold">{chip}</span>
                          <ChevronRight className={`h-3.5 w-3.5 text-[var(--color-natural-light-muted)] group-hover:text-natural-accent transition shrink-0 ${chipRtl ? 'rotate-180' : ''}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => {
                  const mRtl = isRTL(m.content);
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`flex items-center gap-1.5 mb-1 text-[10px] text-[var(--color-natural-light-muted)] font-semibold px-1 ${
                        mRtl ? 'flex-row-reverse' : ''
                      }`} dir={mRtl ? 'rtl' : 'ltr'}>
                        <span>{m.role === 'user' ? 'You' : 'Coach Agent'}</span>
                        <span>•</span>
                        <span>{m.timestamp}</span>
                      </div>
                      <div
                        dir={mRtl ? "rtl" : "ltr"}
                        className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-xs leading-relaxed shadow-xs whitespace-pre-wrap ${
                          mRtl ? 'text-right' : 'text-left'
                        } ${
                          m.role === 'user'
                            ? 'bg-natural-accent text-white font-semibold rounded-tr-none shadow-sm'
                            : m.content.startsWith('Error:')
                              ? 'bg-red-50 border border-red-300 text-red-800 rounded-tl-none font-semibold'
                              : 'bg-[var(--color-natural-card)] border border-natural-border text-[var(--color-natural-text)] rounded-tl-none font-medium'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })}

                {/* Displaying Loading Block */}
                {loadingSessionId === activeSessionId && (
                  <div className="flex flex-col items-start animate-pulse">
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[var(--color-natural-light-muted)] font-semibold">
                      <span>Coach Agent has joined...</span>
                    </div>
                    <div className="bg-[var(--color-natural-card)] border border-natural-border rounded-2xl rounded-tl-none px-5 py-3 text-xs text-[var(--color-natural-muted)] flex items-center gap-2 shadow-xs">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-natural-accent rounded-full animate-bounce" style={ { animationDelay: '0ms' } } />
                        <span className="w-1.5 h-1.5 bg-natural-accent rounded-full animate-bounce" style={ { animationDelay: '150ms' } } />
                        <span className="w-1.5 h-1.5 bg-natural-accent rounded-full animate-bounce" style={ { animationDelay: '300ms' } } />
                      </div>
                      <span className="font-medium italic">Refining details...</span>
                    </div>
                  </div>
                )}


              </div>
            )}

            {/* Dynamic Finalized Prompt output */}
            {ideaState.isCompleted && ideaState.finalPrompt && (
              <motion.div
                initial={ { opacity: 0, y: 15 } }
                animate={ { opacity: 1, y: 0 } }
                transition={ { duration: 0.4 } }
                className="mt-6 border border-natural-accent/30 bg-[var(--color-natural-subtle)] rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3 border-b border-natural-border pb-3">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <h3 className="text-xs font-bold text-[var(--color-natural-text)] uppercase tracking-wider">Ultimate Formulated Prompt</h3>
                      <p className="text-[10px] text-[var(--color-natural-muted)]">Perfected format for {ideaState.targetModel.toUpperCase()}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1 px-3.5 bg-natural-dark hover:opacity-90 text-[var(--color-natural-bg)] rounded-full text-[11px] font-bold transition flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
                  >
                    {copied ? <Check className="h-3 w-3 animate-ping" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? 'Copied' : 'Copy Prompt'}</span>
                  </button>
                </div>

                <div className="bg-[var(--color-natural-card)] rounded-lg p-3.5 border border-natural-border shadow-inner relative overflow-hidden">
                  <div className="absolute top-2 right-2 rounded bg-[var(--color-natural-subtle)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--color-natural-muted)] border border-natural-border">
                    {ideaState.targetModel}
                  </div>
                  <pre
                    dir={isRTL(ideaState.finalPrompt || "") ? "rtl" : "ltr"}
                    className={`text-[11px] font-mono text-[var(--color-natural-text)] whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto select-all ${
                      isRTL(ideaState.finalPrompt || "") ? 'text-right' : 'text-left'
                    }`}
                  >
                    {ideaState.finalPrompt}
                  </pre>
                </div>

                <p className="text-[10px] text-[var(--color-natural-muted)] mt-2.5 leading-relaxed font-normal">
                  🎉 Congratulations! Your final prompt has been generated. Click "Copy Prompt" and use it immediately in {ideaState.targetModel.toUpperCase()}!
                </p>
              </motion.div>
            )}
          </div>

          {/* Retry button (visible after stop or error) */}
          {showRetry && messages.length > 0 && (
            <div className="px-4 py-3 border-t border-natural-border bg-[var(--color-natural-subtle)] flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-1.5 text-xs font-bold text-[var(--color-natural-text)] bg-[var(--color-natural-card)] border border-natural-accent hover:bg-[var(--color-natural-subtle)] rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Retry
              </button>
            </div>
          )}

          {/* Quick Suggestions Chips Section */}
          {messages.length > 0 && !loadingSessionId && getSuggestionChips().length > 0 && (
            <div className="px-4 py-2 border-t border-natural-border flex items-center gap-2 overflow-x-auto whitespace-nowrap bg-[var(--color-natural-bg)]">
              <Lightbulb className="h-3 w-3 text-natural-accent shrink-0 animate-pulse" />
              <div className="flex gap-1.5">
                {getSuggestionChips().map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (chip.includes("Generate my prompt")) {
                        handleRefine(chip, true);
                      } else {
                        handleRefine(chip);
                      }
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-[var(--color-natural-text)] hover:text-[var(--color-natural-dark)] bg-[var(--color-natural-card)] border border-natural-border hover:border-natural-accent rounded-full transition shadow-xs cursor-pointer animate-fade-in"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Message input footer */}
          <div className="p-4 border-t border-natural-border bg-[var(--color-natural-bg)]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRefine(inputVal);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={textareaRef}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!loadingSessionId && inputVal.trim()) {
                      handleRefine(inputVal);
                    }
                  }
                }}
                rows={1}
                placeholder={
                  messages.length === 0
                    ? "Describe your raw prompt idea in a single sentence... (Shift+Enter for new line)"
                    : ideaState.isCompleted
                      ? "Ask the coach to adjust or refine the completed prompt..."
                      : "Reply to the coach or append context parameters..."
                }
                disabled={loadingSessionId}
                dir={isRTL(inputVal) ? "rtl" : "ltr"}
                className={`flex-1 bg-[var(--color-natural-card)] border border-natural-border p-2.5 rounded-lg text-xs font-semibold placeholder:text-[var(--color-natural-light-muted)] focus:outline-none focus:ring-1 focus:ring-natural-accent focus:border-natural-accent disabled:opacity-60 resize-none max-h-40 overflow-y-auto leading-relaxed ${
                  isRTL(inputVal) ? 'text-right' : 'text-left'
                }`}
              />
              {loadingSessionId ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="p-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition cursor-pointer shrink-0"
                  title="Stop AI response"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputVal.trim()}
                  className="p-2.5 bg-natural-dark text-[var(--color-natural-bg)] rounded-lg hover:opacity-95 transition disabled:opacity-50 cursor-pointer shrink-0"
                  title="Send (Shift+Enter for new line)"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </form>
          </div>
        </section>
      </main>

      {/* Mobile Control Panel Drawer */}
      <AnimatePresence>
        {showMobileDrawer && (
          <div className="fixed inset-0 z-50 flex justify-start lg:hidden">
            {/* Backdrop */}
            <motion.div
              initial={ { opacity: 0 } }
              animate={ { opacity: 1 } }
              exit={ { opacity: 0 } }
              onClick={() => setShowMobileDrawer(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Panel */}
            <motion.div
              initial={ { x: "-100%" } }
              animate={ { x: 0 } }
              exit={ { x: "-100%" } }
              transition={ { type: "spring", damping: 25, stiffness: 220 } }
              className="relative w-[320px] max-w-[85vw] h-full bg-[var(--color-natural-panel)] border-r border-natural-border flex flex-col p-4 shadow-2xl z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-natural-border shrink-0">
                <div className="flex items-center gap-2">
                  <img src="/favicon.png" alt="Prompter Logo" className="h-5 w-5 object-contain" />
                  <span className="text-sm font-bold text-[var(--color-natural-dark)]">Prompter Board</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileDrawer(false)}
                  className="p-1 hover:bg-[var(--color-natural-subtle)] rounded-lg text-[var(--color-natural-muted)] hover:text-[var(--color-natural-dark)] transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 flex flex-col">
                {renderControlPanel(true)}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Settings Drawer/Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={ { opacity: 0 } }
              animate={ { opacity: 1 } }
              exit={ { opacity: 0 } }
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            <motion.div
              initial={ { opacity: 0, scale: 0.95, y: 15 } }
              animate={ { opacity: 1, scale: 1, y: 0 } }
              exit={ { opacity: 0, scale: 0.95, y: 15 } }
              className="bg-[var(--color-natural-panel)] border border-natural-border rounded-xl max-w-md w-full p-6 shadow-xl relative z-10 overflow-hidden text-[var(--color-natural-text)]"
            >
              <div className="flex items-center justify-between border-b border-natural-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-natural-accent" />
                  <h3 className="text-sm font-bold text-[var(--color-natural-dark)]">Customizations & API Setup</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="p-1 text-[var(--color-natural-light-muted)] hover:text-[var(--color-natural-dark)] rounded-lg hover:bg-[var(--color-natural-bg)] transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                {/* 1. Theme and appearance customizable options */}
                <div className="bg-[var(--color-natural-subtle)] p-3.5 rounded-lg border border-natural-border">
                  <h4 className="text-[11px] font-bold text-[var(--color-natural-muted)] uppercase tracking-wider mb-2.5">
                    Appearance Config
                  </h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--color-natural-text)] block mb-1">
                        Theme Colors
                      </label>
                      <select
                        name="prefTheme"
                        value={theme}
                        onChange={(e) => applyTheme(e.target.value)}
                        className="w-full bg-[var(--color-natural-card)] text-[var(--color-natural-dark)] border border-natural-border p-1.5 rounded text-xs focus:ring-1 focus:ring-natural-accent focus:outline-none"
                      >
                        <option value="sage">Sage Natural</option>
                        <option value="slate">Slate Space</option>
                        <option value="ocean">Ocean Blue</option>
                        <option value="purple">Deep Velvet</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--color-natural-text)] block mb-1">
                        Font Sizes
                      </label>
                      <select
                        name="prefFontSize"
                        value={fontSize}
                        onChange={(e) => applyFontSize(e.target.value)}
                        className="w-full bg-[var(--color-natural-card)] text-[var(--color-natural-dark)] border border-natural-border p-1.5 rounded text-xs focus:ring-1 focus:ring-natural-accent focus:outline-none"
                      >
                        <option value="sm">Small (Tighter)</option>
                        <option value="md">Medium (Balanced)</option>
                        <option value="lg">Large (Enlarged)</option>
                      </select>
                    </div>

                    {/* Dark & Light mode toggle row */}
                    <div className="col-span-2 mt-2 pt-2 border-t border-natural-border">
                      <label className="text-[10px] font-semibold text-[var(--color-natural-text)] block mb-1.5">
                        Theme Mode
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-[var(--color-natural-bg)] border border-natural-border p-1 rounded-lg">
                        <button
                          key="light"
                          type="button"
                          onClick={() => applyDarkMode(false)}
                          className={`text-xs font-semibold py-1.5 rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            !darkMode
                              ? "bg-[var(--color-natural-card)] text-[var(--color-natural-dark)] shadow-xs border border-natural-border font-bold"
                              : "text-[var(--color-natural-muted)] hover:text-[var(--color-natural-dark)]"
                          }`}
                        >
                          <span>☀️</span>
                          <span>Light</span>
                        </button>
                        <button
                          key="dark"
                          type="button"
                          onClick={() => applyDarkMode(true)}
                          className={`text-xs font-semibold py-1.5 rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            darkMode
                              ? "bg-[var(--color-natural-card)] text-[var(--color-natural-dark)] shadow-xs border border-natural-border font-bold"
                              : "text-[var(--color-natural-muted)] hover:text-[var(--color-natural-dark)]"
                          }`}
                        >
                          <span>🌙</span>
                          <span>Dark</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Chat history explanation */}
                <p className="text-xs text-[var(--color-natural-muted)] leading-relaxed font-normal">
                  Add your API keys below to enable AI-powered prompt refinement. Keys are stored strictly on-device in your browser and saved automatically as you type:
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] tracking-wider uppercase font-bold text-[var(--color-natural-muted)] block mb-1">
                      Gemini API Key
                    </label>
                    <input
                      name="gKey"
                      type="password"
                      value={customGeminiKey}
                      onChange={(e) => applyGeminiKey(e.target.value)}
                      placeholder="AI Studio API Key (Starts with 'AIzaSy')..."
                      className="w-full bg-[var(--color-natural-card)] border border-natural-border p-2 rounded text-xs focus:ring-1 focus:ring-natural-accent focus:outline-none"
                    />
                    <span className="text-[9px] text-[var(--color-natural-light-muted)] block mt-0.5">
                      Fully supports CORS client-side browser requests out-of-the-box.
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] tracking-wider uppercase font-bold text-[var(--color-natural-muted)] block mb-1">
                      OpenAI API Key
                    </label>
                    <input
                      name="oKey"
                      type="password"
                      value={customOpenAIKey}
                      onChange={(e) => applyOpenAIKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full bg-[var(--color-natural-card)] border border-natural-border p-2 rounded text-xs focus:ring-1 focus:ring-natural-accent focus:outline-none"
                    />
                    <span className="text-[9px] text-[var(--color-natural-light-muted)] block mt-0.5">
                      Used for ChatGPT formatting. Supports browser-side API headers.
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] tracking-wider uppercase font-bold text-[var(--color-natural-muted)] block mb-1">
                      Claude (Anthropic) API Key
                    </label>
                    <input
                      name="cKey"
                      type="password"
                      value={customClaudeKey}
                      onChange={(e) => applyClaudeKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full bg-[var(--color-natural-card)] border border-natural-border p-2 rounded text-xs focus:ring-1 focus:ring-natural-accent focus:outline-none"
                    />
                    <span className="text-[9px] text-[var(--color-natural-light-muted)] block mt-0.5">
                      Used for Claude XML blocks. Safe and secure.
                    </span>
                  </div>

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
                </div>

                {/* 3. Feedback Option (Email support direct contact render) */}
                <div className="bg-[var(--color-natural-subtle)] rounded-lg p-3.5 border border-natural-border mt-3 shrink-0">
                  <div className="flex items-center gap-1.5 text-[var(--color-natural-dark)] font-bold mb-1">
                    <Mail className="h-3.5 w-3.5 text-natural-accent" />
                    <span className="text-xs">Feedback & Support</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-natural-muted)] leading-normal">
                    Have questions or feedback on improving target aspect calculations? Reach the designer directly at:
                  </p>
                  <a
                    href="https://mail.google.com/mail/?view=cm&fs=1&to=thedanybyte@gmail.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-natural-accent hover:underline block mt-1 break-all"
                  >
                    thedanybyte@gmail.com
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern floating non-blocking auto-dismissing toast notifications */}
      <AnimatePresence>
        {warningMsg && (
          <motion.div
            initial={ { opacity: 0, y: 50, scale: 0.9 } }
            animate={ { opacity: 1, y: 0, scale: 1 } }
            exit={ { opacity: 0, scale: 0.9, y: 20 } }
            className="fixed bottom-6 left-6 z-50 bg-neutral-900 border border-neutral-800 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs max-w-sm tracking-wide font-medium"
          >
            <span className="w-2 h-2 rounded-full bg-natural-accent animate-pulse shrink-0" />
            <span>{warningMsg}</span>
            <button
              type="button"
              onClick={() => setWarningMsg(null)}
              className="ml-auto text-neutral-400 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom non-blocking Delete session confirm modal */}
      <AnimatePresence>
        {deleteTargetId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={ { opacity: 0 } }
              animate={ { opacity: 0.5 } }
              exit={ { opacity: 0 } }
              className="absolute inset-0 bg-black"
              onClick={() => setDeleteTargetId(null)}
            />
            <motion.div
              initial={ { opacity: 0, scale: 0.95, y: 15 } }
              animate={ { opacity: 1, scale: 1, y: 0 } }
              exit={ { opacity: 0, scale: 0.95, y: 15 } }
              className="bg-[var(--color-natural-panel)] border border-natural-border rounded-xl max-w-md w-full p-6 shadow-2xl relative z-10 overflow-hidden text-[var(--color-natural-text)]"
            >
              <div className="flex items-center gap-2 mb-3 text-red-500">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <h3 className="text-sm font-bold text-[var(--color-natural-dark)]">Delete Refinement Session?</h3>
              </div>
              <p className="text-xs text-[var(--color-natural-muted)] leading-relaxed mb-5">
                Are you sure you want to permanently delete this prompt refinement session? This action cannot be undone and will erase all conversation logs.
              </p>
              <div className="flex gap-2 justify-end pt-3 border-t border-natural-border">
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(null)}
                  className="px-3.5 py-2 bg-[var(--color-natural-subtle)] hover:opacity-90 text-[var(--color-natural-text)] border border-natural-border rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeDeleteSession}
                  className="px-3.5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
                >
                  Permanently Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      
    </div>
  );
}