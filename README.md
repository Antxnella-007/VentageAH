# BillSpark

English-only invoice analyzer for companies with many branches.

Drop a PDF, image, Word file, or text. The app turns it into **plain text on the server**, clips it, then calls **Gemini** so you do not spend tokens on the raw file.

You get:

- key fields (supplier, total, tax, due date, branch, lines)
- a short summary
- practical advice for this invoice
- flags and questions for AP

## Run

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

Use **Try the sample** if you do not have a file handy.

Never commit API keys. Rotate any key that was pasted in chat.
