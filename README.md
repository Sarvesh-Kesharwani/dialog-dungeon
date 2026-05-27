# DialogDungeon

Gamified English practice from movie scenes.

- Import public YouLearn space links.
- Watch videos with synced transcript/dialogues.
- Save hard dialogues and add custom transcript lines.
- Process saved dialogue with a custom DeepSeek prompt.
- Practice 5 saved dialogues daily with score tracking and spaced repetition sets.
- Sync local app state to the isolated `dialog_dungeon` schema in the TodoTrails Supabase project.

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
SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Without `DEEPSEEK_API_KEY`, the app uses demo fallback responses.
Without Supabase vars, the app keeps using local browser storage.
