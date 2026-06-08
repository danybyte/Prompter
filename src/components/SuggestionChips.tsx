import { Lightbulb } from 'lucide-react';
import { SUGGESTION_CHIPS } from '../shared';

interface SuggestionChipsProps {
  state: 'initial' | 'completed' | 'inProgress' | 'none';
  onSuggestion: (chip: string, forceComplete?: boolean) => void;
}

export default function SuggestionChips({ state, onSuggestion }: SuggestionChipsProps) {
  const chips = state === 'none' ? [] : SUGGESTION_CHIPS[state] || [];
  if (chips.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t border-natural-border flex items-center gap-2 overflow-x-auto whitespace-nowrap bg-[var(--color-natural-bg)]">
      <Lightbulb className="h-3 w-3 text-natural-accent shrink-0 animate-pulse" />
      <div className="flex gap-1.5">
        {chips.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSuggestion(chip, chip.includes('Generate my prompt'))}
            className="px-2.5 py-1 text-[11px] font-bold text-[var(--color-natural-text)] hover:text-[var(--color-natural-dark)] bg-[var(--color-natural-card)] border border-natural-border hover:border-natural-accent rounded-full transition shadow-xs cursor-pointer animate-fade-in"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
