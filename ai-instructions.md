# AI Maintenance Instructions (Copilot / Claude / etc.)

You are working in a small local-only TypeScript Node project.

## Core non-negotiables
1. **Never upload or transmit the PDF file** to any AI provider.
2. Only text extracted locally may be used in prompts.
3. All storage stays local (JSON files in `DATA_DIR`).
4. Keep it simple: no heavy frameworks unless clearly justified.

## Architecture summary
- Express server in `src/server.ts`
- File storage helpers in `src/lib/storage.ts`
- PDF text extraction in `src/lib/pdf.ts`
- Plan element extraction heuristics in `src/lib/planExtractor.ts`
- AI provider abstraction in `src/lib/ai/*`
- Static UI in `public/` that calls REST endpoints.

## When adding features
- Prefer additive changes.
- Add zod validation for new request payloads.
- Keep endpoints small and focused.
- If you change data models, write a **small migration** that:
  - reads existing JSON,
  - transforms safely,
  - writes back atomically.

## AI provider adapters
- The selected provider comes from `AI_PROVIDER` env var: `openai` or `anthropic`.
- Use `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`.
- Models are configurable via `OPENAI_MODEL` / `ANTHROPIC_MODEL`.

## Prompting rules
- Keep prompts short and structured.
- Include:
  - plan elements (titles + descriptions),
  - relevant activities,
  - time window,
  - desired tone and format.
- Do not include entire extracted plan text if not needed.
- Respect `MAX_PROMPT_CHARS`.

## UI
- No build step.
- Plain HTML/JS with fetch calls is preferred.
- Keep it readable and minimal.

## Testing
- If you add non-trivial logic, add a simple node test script (no full test framework required).
