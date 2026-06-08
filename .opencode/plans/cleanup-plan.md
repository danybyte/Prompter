# Project Cleanup Plan

## New File Structure
```
src/
├── shared/
│   ├── constants.ts          # Greetings, directives, storage keys, suggestion chips
│   ├── repairJson.ts         # JSON self-healing repair function
│   ├── messageUtils.ts       # Message alternation, provider message building
│   ├── sanitizeResponse.ts   # isPureGreeting, sanitizeRefineResponse
│   ├── getSystemInstruction.ts # System prompt generator
│   └── index.ts              # Barrel exports
├── components/
│   ├── SettingsModal.tsx     # Settings/API keys modal
│   ├── ChatMessage.tsx       # Single message bubble
│   ├── ChatArea.tsx          # Message list + loading + error display
│   ├── SessionList.tsx       # Sidebar session items
│   ├── ControlPanel.tsx      # Dashboard + session list wrapper
│   ├── ConfirmDialog.tsx     # Reusable confirmation modal
│   ├── SuggestionChips.tsx   # Quick suggestion buttons
│   └── FinalPromptCard.tsx   # Completed prompt display
├── utils/
│   └── aiRefiner.ts          # Refactored: uses shared utils, handles online/offline
├── types.ts                  # Unchanged
├── App.tsx                   # Refactored: uses extracted components
├── main.tsx                  # Unchanged
└── index.css                 # Unchanged

server.ts                     # Refactored: uses shared utils
```

## Key Changes

### 1. Data Isolation (localStorage prefix)
All localStorage keys changed to use `prompter_` prefix:
- `custom_gemini_key` → `prompter_custom_gemini_key`
- `custom_openai_key` → `prompter_custom_openai_key`
- `custom_claude_key` → `prompter_custom_claude_key`
- `settings_theme` → `prompter_settings_theme`
- `settings_fontSize` → `prompter_settings_fontSize`
- `settings_darkMode` → `prompter_settings_darkMode`
- `prompt_refiner_sessions` → `prompter_refiner_sessions`

This prevents collisions with any other apps on the same domain.

### 2. Deduplication
- `isPureGreeting()` - was in 2 files, now in 1 (`shared/sanitizeResponse.ts`)
- `repairJSON()` - was in 2 files, now in 1 (`shared/repairJson.ts`)
- `getAlternatingMessages()` - was in 2 files, now in 1 (`shared/messageUtils.ts`)
- `sanitizeRefineResponse()` - was in 2 files, now in 1 (`shared/sanitizeResponse.ts`)
- `getSystemInstruction()` - was in 2 files, now in 1 (`shared/getSystemInstruction.ts`)
- System directive text - was repeated 6x, now 2 constants
- Greeting responses - were repeated 3x, now 2 constants

### 3. App.tsx Split (1578 lines → ~200 lines)
Extracted components:
- `SettingsModal` - theme, font, dark mode, API keys
- `ChatMessage` - user/model message rendering with RTL
- `ChatArea` - message list, loading spinner, error display, input
- `SessionList` - session items with rename/delete
- `ControlPanel` - maturity dashboard + session list
- `ConfirmDialog` - reusable delete/reset confirmation
- `SuggestionChips` - quick action buttons
- `FinalPromptCard` - completed prompt display with copy

### 4. Server.ts Refactor (659 lines → ~200 lines)
- Import shared utilities instead of duplicating
- Single message builder for all 3 providers
- DRY API handling flow

### 5. Cleanup
- Remove unused `React` import (modern JSX transform)
- Remove Persian comments, replace with English
- Replace inline `<style>` font overrides with CSS variable approach
- Remove dead code paths
