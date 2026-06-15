<img src="favicon.png" alt="Prompter" width="100" height="100" />

# Prompter

## Prompter is a opensource project that can make your idea to a powerful prompt to make them with AIs.

The user fully explains the main idea to the AI, the AI ​​understands the idea and tries to add more details to that idea, for example, if the user wants to make a photo, it asks the user to tell him the type of photo (realistic, anime...) or the technologies he wants to use for a site. When Clarified reaches 100%, the user receives the final prompt

## How to Run

Install dependencies:

```bash
npm install
```

Start the dev server (port 3000):

```bash
npm run dev
```

Then open [local on 3000 port](127.0.0.1:3000) in browser

## How to Get an API Key

You need a **Google Gemini API key**. You can provide it in two ways:
1. **Get free API** Get your free key at [Google AI Studio](https://aistudio.google.com/apikey).

2. **Add API key** 
- **via the app UI** — Open Settings in the app and paste your key.
- **via environment variable** — Create a `.env` file in the project root:

   ```
   GEMINI_API_KEY=your_api_key_here
   ```
