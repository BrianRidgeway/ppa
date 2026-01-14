import { Activity, Plan, PlanElement } from "./types.js";

function mdEscape(s: string): string {
  return s.replace(/\r/g, "");
}

export function buildReviewPrompt(params: {
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  plan: Plan;
  elements: PlanElement[];
  activities: Activity[];
  guidance?: string;
}): string {
  const { employeeName, periodStart, periodEnd, plan, elements, activities, guidance } = params;

  const elementsMd = elements.map((e) => `- **${mdEscape(e.title)}** (id: \`${e.id}\`)\n  - ${mdEscape(e.description)}`).join("\n");
  const activitiesMd = activities
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => {
      const rel = a.relatedElementIds?.length ? ` (related: ${a.relatedElementIds.map((x) => `\`${x}\``).join(", ")})` : "";
      const ev = a.evidence ? `\n  - Evidence: ${mdEscape(a.evidence)}` : "";
      return `- ${a.date}${rel}: ${mdEscape(a.summary)}${ev}`;
    })
    .join("\n");

  return `Write a progress review draft in markdown.

Employee: ${employeeName}
Review period: ${periodStart} to ${periodEnd}

Performance Plan: ${plan.fileName}

Plan elements:
${elementsMd}

Activities during the period:
${activitiesMd || "- (none provided)"}

Instructions:
- Map the activities to the plan elements.
- For each plan element, write 2-5 concise bullets describing outcomes, impact, and scope.
- Use evidence where available.
- Use a professional, factual tone (no hype).
- End with a short "Overall progress" paragraph.
${guidance ? `\nAdditional guidance:\n${mdEscape(guidance)}` : ""}

Output format:
## Plan Element Reviews
### <Element title>
- bullet
- bullet

## Overall progress
paragraph
`;
}
