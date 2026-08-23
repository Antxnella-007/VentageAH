# Vantage

Invoice control for a group with many companies, many branches, and many invoices.

Upload one file or a whole folder. Each invoice is read **on the server**, saved to the ledger, and rolled into company and branch totals. There is no sample invoice in the app: you only load real files. **Reset ledger** clears every saved invoice so you can start a new batch from zero.

## Gemini API key (server-side only)

The reader lives in `lib/gemini.ts` and is called only from `POST /api/analyze`. The key is never sent to the browser.

1. Copy `.env.example` to `.env.local` (gitignored).
2. Set:

```
GEMINI_API_KEY=your_key_here
```

Do not put the key in TypeScript or JavaScript. Do not use `NEXT_PUBLIC_GEMINI_API_KEY`.

`.env.example` keeps `GEMINI_API_KEY=` empty on purpose.

## Run locally

```bash
npm install
cp .env.example .env.local
# add GEMINI_API_KEY in .env.local
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123)

Optional seed data (`npx tsx prisma/seed.ts`) fills a demo ledger. Use **Reset ledger** in the UI to wipe it.

## Vercel

In the Vercel project → Settings → Environment Variables (Production and Preview):

| Name | Value |
| --- | --- |
| `GEMINI_API_KEY` | your key |
| `GEMINI_MODEL` | `gemini-3.6-flash` |
| `GEMINI_MAX_CHARS` | `8000` |
| `DATABASE_URL` | `file:/tmp/billspark.db` |

Never commit `.env` or `.env.local`. Hobby SQLite on `/tmp` can reset when a new instance boots.
