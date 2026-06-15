import { ChatMessage } from '../types';
import { SYSTEM_DIRECTIVE_ANALYZE, SYSTEM_DIRECTIVE_FINALIZE } from './constants';

export interface AlternatingMessage {
  role: 'user' | 'model';
  content: string;
}

export function getAlternatingMessages(messages: ChatMessage[]): AlternatingMessage[] {
  const result: AlternatingMessage[] = [];
  if (!messages || !Array.isArray(messages)) return result;
  for (const m of messages) {
    const role = m.role === 'model' ? 'model' : 'user';
    if (result.length > 0 && result[result.length - 1].role === role) {
      result[result.length - 1].content += '\n\n' + m.content;
    } else {
      result.push({ role, content: m.content });
    }
  }
  return result;
}

export function appendSystemDirective(content: string, forceComplete: boolean): string {
  return content + (forceComplete ? SYSTEM_DIRECTIVE_FINALIZE : SYSTEM_DIRECTIVE_ANALYZE);
}

export function buildGeminiContents(alternating: AlternatingMessage[], forceComplete: boolean) {
  const contents: any[] = [];
  for (let i = 0; i < alternating.length; i++) {
    const m = alternating[i];
    const role = m.role === 'model' ? 'model' : 'user';
    const contentText = i === alternating.length - 1 ? appendSystemDirective(m.content, forceComplete) : m.content;
    contents.push({ role, parts: [{ text: contentText }] });
  }
  return contents;
}
