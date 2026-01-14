# Performance Review Local App (PDF -> Elements -> Activities -> AI Draft)

A tiny **local-only** helper app to write performance plan progress reviews.

- Upload a performance plan PDF (stored locally).
- The server extracts text from the PDF (locally) and attempts to parse **plan elements**.
- Record **activities** over time for yourself and your employees.
- Generate AI-assisted draft review narratives *without sending the PDF file* to any AI provider.
  - Only **text extracted locally** is included in prompts.
- Data is stored locally as JSON files (no database).

## Tech
- Backend: TypeScript + Node + Express
- PDF text extraction: `pdf-parse` (local)
- Storage: JSON files in `./data`
- UI: Static HTML/JS served by Express (no build step)
- AI providers: OpenAI or Anthropic (Claude), chosen via env vars

## Quick start (local)

```bash
npm install
cp .env.example .env
# set AI Provider API keys in .env
cp <path-to-ca-certificates> ./certs/ca-certificates.crt # optional, for custom CA trust
npm run dev
```

Open: http://localhost:3000

## Run with Docker

```bash
docker build -t perf-review-local-app .
docker run --rm -p 3000:3000 \
  -e AI_PROVIDER=openai \
  -e OPENAI_API_KEY=YOUR_KEY \
  -v "$(pwd)/data:/app/data" \
  perf-review-local-app
```

## Data layout

All files live in `DATA_DIR` (default `./data`):

- `employees.json` – employees you manage (including yourself as an employee record)
- `plans.json` – uploaded performance plans + extracted text + parsed elements
- `activities.json` – dated activity entries associated to a plan + employee
- `reviews.json` – generated review outputs (saved for later edits/copy/paste)
- `uploads/` – stored PDFs (local disk)

> Tip: add `./data` to your `.gitignore` so local content is never committed.

## How plan elements are detected

By default this app uses heuristics to split extracted PDF text into element-like chunks:
- Lines containing phrases like `Plan Element`, `Element`, or numbered headings.
- "Heading-like" lines followed by description text.

You can always **edit/rename** extracted elements from the UI.

## API overview

- `POST /api/plans/upload` – upload a plan PDF (multipart form)
- `GET /api/plans` – list plans
- `GET /api/plans/:planId` – get a plan (includes elements)
- `PUT /api/plans/:planId/elements` – replace elements (manual edits)
- `POST /api/employees` – create employee
- `GET /api/employees` – list employees
- `POST /api/activities` – create activity
- `GET /api/activities?employeeId=&planId=` – list activities
- `POST /api/reviews/generate` – generate review draft via AI
- `GET /api/reviews?employeeId=&planId=` – list saved reviews

## Notes / safety

- This is intended for **local-only** usage.
- The PDF file itself is never transmitted to AI providers.
- If your plan text contains sensitive internal details, consider:
  - limiting what goes into prompts (see `MAX_PROMPT_CHARS`)
  - removing or anonymizing sensitive details in activity entries

## License
MIT (feel free to change).
