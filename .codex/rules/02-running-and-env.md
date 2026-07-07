# Running And Environment

Local development flow is documented in `README.md`.

Typical first-time setup:

```bash
npm install
npx prisma dev -d
npx prisma db push
npx prisma generate
npx prisma db seed
npm run dev
```

Then open `http://localhost:3000`.

Shortcut scripts:

- `./run.sh` on macOS/Linux.
- `run.bat` on Windows.

Environment variables:

- `DATABASE_URL`: runtime database connection.
- `DIRECT_URL`: direct database connection for migrations.
- `SHADOW_DATABASE_URL`: only needed for local `prisma migrate dev`.
- `NEXTAUTH_URL`: canonical app URL.
- `NEXTAUTH_SECRET`: JWT signing secret.
- `BLOB_READ_WRITE_TOKEN`: required for Vercel Blob uploads and private Blob
  proxy reads.
- `OPENAI_API_KEY`: required for AI auto task generation from project
  documents.
- `AI_TASK_MODEL`: optional OpenAI model override for AI auto task generation;
  defaults to `gpt-5.5` in code when unset.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: optional seed inputs.

Safety rules:

- Never print secret values from `.env`.
- `.env*` files are ignored and should remain untracked.
- If a command fails because the database or network is unavailable, report that
  clearly instead of guessing.
- Use `npm` for this project because `package-lock.json` is present.
