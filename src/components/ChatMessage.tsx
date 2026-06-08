import { ChatMessage as ChatMessageType } from '../types';

const isRTL = (text: string): boolean => {
  if (!text) return false;
  return /[؀-ۿݐ-ݿ֐-׿ﭐ-﷿ﹰ-﻿]/.test(text);
};

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const rtl = isRTL(message.content);
  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-1.5 mb-1 text-[10px] text-[var(--color-natural-light-muted)] font-semibold px-1 ${rtl ? 'flex-row-reverse' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
        <span>{isUser ? 'You' : 'Coach Agent'}</span>
        <span>•</span>
        <span>{message.timestamp}</span>
      </div>
      <div
        dir={rtl ? 'rtl' : 'ltr'}
        className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-xs leading-relaxed shadow-xs whitespace-pre-wrap ${rtl ? 'text-right' : 'text-left'} ${
          isUser
            ? 'bg-natural-accent text-white font-semibold rounded-tr-none shadow-sm'
            : 'bg-[var(--color-natural-card)] border border-natural-border text-[var(--color-natural-text)] rounded-tl-none font-medium'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
