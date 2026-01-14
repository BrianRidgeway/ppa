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
- Plan element extraction heuristics in `src/lib/planExtractor.ts` (extracts title, weight, description, objectives, results, metrics)
- AI provider abstraction in `src/lib/ai/*`
- Prompting utilities in `src/lib/prompting.ts` (review and final rating generation)
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
  - plan elements (titles + descriptions + weights),
  - relevant activities,
  - time window,
  - desired tone and format.
- Do not include entire extracted plan text if not needed.
- Respect `MAX_PROMPT_CHARS` (50000 chars max for full activity content).
- Final rating prompts use weighted scoring: 5=470-500, 4=380-469, 3=290-379, 2=200-289, 1=100-199 points.

## UI
- No build step for frontend (vanilla HTML/JS with fetch calls).
- Keep it readable and minimal.
- Placeholders (yellow ⏳ indicators) show while AI requests process with auto-refresh on timeout.
- Color-coded status: ✓ green = complete, ⚠️ red = incomplete, ⏳ yellow = generating.
- API requests have 2-minute default timeout, 5-minute timeout for final rating generation.

## REST API endpoints
- `POST /api/plans/upload` - upload and extract PDF
- `POST /api/plans/:planId/reparse` - re-extract elements from existing PDF
- `DELETE /api/plans/:planId` - delete plan and associated PDF
- `POST /api/reviews/generate` - generate period review (2-minute timeout)
- `POST /api/ratings/generate` - generate final annual rating (5-minute timeout)
- `DELETE /api/ratings/:ratingId` - delete final rating
- Provider/model endpoints: `GET /api/ai/providers`, `GET /api/ai/models`

## Testing
- If you add non-trivial logic, add a simple node test script (no full test framework required).

## Key data models
- **PlanElement**: id, title, description, weight (numeric), objectives, resultsOfActivities, metrics
- **ReviewDraft**: review markdown with promptMeta (provider, model, truncated flag)
- **PerformanceRating**: fiscal year (Oct-Sep), overallRating (1-5), elementRatings (array with rating/score/summary), totalScore, narrativeSummary, outputMarkdown

## Common tasks
- Element weight extraction: PDF format is "Element Weight:" on one line, number on next
- Fiscal year calculation: Oct 1 of previous calendar year through Sep 30 of current year
- Activity extraction from reviews: regex pattern `## Critical Element: {title}` to find section, extract markdown bullets
- Final rating scoring: multiply element weight × rating level to get score
