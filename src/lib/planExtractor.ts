import { PlanElement } from "./types.js";
import { newId } from "./id.js";

/**
 * Heuristic extraction of plan elements from extracted PDF text.
 * This is intentionally simple and safe; users can edit results in the UI.
 */
export function extractPlanElements(text: string): PlanElement[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  // A heading-like line: short-ish and not ending with period, often upper/title case.
  const isHeading = (l: string) => {
    if (l.length < 4 || l.length > 140) return false;
    if (/[.!?]$/.test(l)) return false;
    // contains "Element" or is numbered
    if (/^(plan\s*)?element\b/i.test(l)) return true;
    if (/^(\d+\.|\d+\)|[A-Z]\.|[IVX]+\.)\s+/.test(l)) return true;
    // looks like a section title
    if (l === l.toUpperCase() && l.length <= 80) return true;
    if (/^[A-Z][\w\s,&/-]{3,}$/.test(l) && l.split(" ").length <= 10) return true;
    return false;
  };

  // Build chunks: heading + following paragraph-ish lines until next heading
  const chunks: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    if (isHeading(l)) {
      if (current && current.body.join(" ").trim().length > 0) {
        chunks.push(current);
      }
      current = { title: cleanTitle(l), body: [] };
      continue;
    }

    if (!current) {
      // Create a synthetic first heading if the document starts with body text
      current = { title: "Plan Overview", body: [l] };
      continue;
    }

    current.body.push(l);
  }

  if (current && current.body.join(" ").trim().length > 0) {
    chunks.push(current);
  }

  // Post-process: merge tiny chunks, drop obvious non-elements
  const elements: PlanElement[] = [];
  for (const c of chunks) {
    const desc = c.body.join(" ").replace(/\s{2,}/g, " ").trim();
    if (!desc) continue;

    // Skip chunks that look like page footers or repeated headers
    if (/page\s+\d+\s+of\s+\d+/i.test(c.title) || /confidential/i.test(c.title)) continue;

    elements.push({
      id: newId("el_"),
      title: c.title,
      description: desc
    });
  }

  // If we found nothing meaningful, fall back to one element containing the whole text
  if (elements.length === 0) {
    return [
      { id: newId("el_"), title: "Plan (unparsed)", description: text.slice(0, 4000) }
    ];
  }

  // Limit element descriptions a bit to keep prompts manageable (user can edit later)
  return elements.map((e) => ({
    ...e,
    description: e.description.length > 2000 ? e.description.slice(0, 2000) + "…" : e.description
  }));
}

function cleanTitle(t: string): string {
  // Strip leading numbering
  return t.replace(/^(plan\s*)?element\s*[:\-]?\s*/i, "Element: ")
          .replace(/^(\d+\.|\d+\)|[A-Z]\.|[IVX]+\.)\s+/, "")
          .trim();
}
