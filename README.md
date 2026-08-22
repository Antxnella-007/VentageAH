# BillSpark

English-only invoice desk for a large group: many companies, many branches, many invoices.

Drop one file or a whole folder. Each invoice is extracted to **plain text on the server**, clipped, sent to **Gemini**, **saved**, and rolled into company / branch totals — the same loop a finance team runs on a stack.

Folder layout that works well:

```
Pacific Retail Group/
  San José/
    july/
      vendor-a.pdf
  Cartago/
    vendor-b.pdf
Other Company/
  Headquarters/
    rent.pdf
```

You get per invoice: fields, summary, advice, flags. You get for the group: spend, flags, suppliers, and a saved ledger.

## Run locally

```bash
npm install
cp .env.example .env
# set GEMINI_API_KEY
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Open `http://127.0.0.1:43123`

Never commit API keys. Rotate any key that was pasted in chat.

## Put it on Vercel so other people can open a link

1. Push this repo to GitHub (or GitLab / Bitbucket).
2. Go to [vercel.com](https://vercel.com), sign in, **Add New → Project**, import the repo.
3. Framework preset: **Next.js**.
4. Environment variables (Production + Preview):

| Name | Value |
| --- | --- |
| `GEMINI_API_KEY` | your Gemini key |
| `GEMINI_MODEL` | `gemini-3.6-flash` |
| `GEMINI_MAX_CHARS` | `8000` |
| `DATABASE_URL` | `file:/tmp/billspark.db` |

5. Build command stays `prisma generate && next build` (already in `npm run build`).
6. Deploy. Vercel gives you a public URL such as `https://your-app.vercel.app`. Share that link.

Hobby plans cap each upload request around **4.5 MB** and about **10 seconds**. The page therefore sends invoices in small waves. For a production AP desk, upgrade the plan and attach **Vercel Postgres** (change `DATABASE_URL` to the Postgres URL and `provider` in `prisma/schema.prisma` to `postgresql`). SQLite on Vercel lives in `/tmp`, so the ledger can reset when a new serverless instance boots. Local `npm run dev` keeps a durable `dev.db`.

CLI alternative after `npm i -g vercel`:

```bash
npx vercel login
npx vercel env add GEMINI_API_KEY
npx vercel --prod
```
