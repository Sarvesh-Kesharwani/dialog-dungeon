# DialogDungeon

Gamified English practice from movie scenes.

- Pick a movie and scene.
- Get a Hindi/Hinglish explanation.
- Translate it in your own English.
- Save vocabulary, phrases, proverbs, articles, and grammar fixes with scene context.

## Local Setup

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## DeepSeek

Create `.env.local`:

```env
DEEPSEEK_API_KEY=your_key
DEEPSEEK_MODEL=deepseek-v4-flash
```

Without `DEEPSEEK_API_KEY`, the app uses demo fallback responses.
