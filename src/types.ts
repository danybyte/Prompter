export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
}

export interface RefinedAspects {
  primaryGoal?: string;
  targetAudience?: string;
  toneStyle?: string;
  inputsRequired?: string;
  formatOutput?: string;
  constraints?: string;
}

export interface IdeaState {
  originalIdea: string;
  currentDraft: string;
  aspects: RefinedAspects;
  progressScore: number; // 0 to 100
  isCompleted: boolean;
  finalPrompt: string | null;
  targetModel: 'gemini' | 'gpt' | 'claude' | 'zen';
}

export interface RefineResponse {
  message: string;
  aspects: RefinedAspects;
  progressScore: number;
  isCompleted: boolean;
  finalPrompt: string | null;
}
