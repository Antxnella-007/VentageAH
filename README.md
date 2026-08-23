# Vantage

Invoice control for a large group: many companies, many branches, many invoices.

Drop one file or a whole folder. Each invoice is read **on the server**, saved to the ledger, and rolled into company / branch totals.

## Gemini (server-side only)

The reader lives in `lib/gemini.ts` and is called only from `/api/analyze`. The key is never sent to the browser.

Put your key in **`.env.local`** (this file is gitignored):

```
GEMINI_API_KEY=your_key_here
```

Do not paste the key into TypeScript or JavaScript files. Do not use `NEXT_PUBLIC_GEMINI_API_KEY`.

## Run locally

```bash
npm install
cp .env.example .env.local
# add GEMINI_API_KEY in .env.local
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Open `http://127.0.0.1:43123`

## Vercel

Set `GEMINI_API_KEY` in the Vercel project environment variables (never in the repo). Also set `GEMINI_MODEL=gemini-3.6-flash` and `DATABASE_URL=file:/tmp/billspark.db` for a demo host.
