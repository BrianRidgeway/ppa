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

  const elementsMd = elements.map((e) => {
    let md = `- **${mdEscape(e.title)}** (id: \`${e.id}\`)\n  - ${mdEscape(e.description)}`;
    if (e.objectives) {
      md += `\n  - Objectives: ${mdEscape(e.objectives)}`;
    }
    if (e.resultsOfActivities) {
      md += `\n  - Expected results: ${mdEscape(e.resultsOfActivities)}`;
    }
    if (e.metrics) {
      md += `\n  - Metrics: ${mdEscape(e.metrics)}`;
    }
    return md;
  }).join("\n");
  const activitiesMd = activities
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((a) => {
      return `- ${a.month}:\n${mdEscape(a.content)}`;
    })
    .join("\n\n");

  return `TASK: Reorganize and professionally rewrite activities against critical elements.

Employee: ${employeeName}
Review period: ${periodStart} to ${periodEnd}

===== CRITICAL ELEMENTS =====
${elements.map((e) => {
  let text = `\n${mdEscape(e.title)}:
  - Description: ${mdEscape(e.description || "")}
  - Expected results: ${mdEscape(e.resultsOfActivities || "")}
  - Success criteria: ${mdEscape(e.metrics || "")}`;
  return text;
}).join("\n")}

===== EMPLOYEE'S ACTIVITIES (INPUT DATA) =====
${activitiesMd || "NO ACTIVITIES PROVIDED"}

===== WHAT TO DO =====
1. Match each activity to the critical element it most directly demonstrates progress on.
2. Rewrite each matched activity in professional language using the element's expected results and success criteria as guidance.
3. Identify any elements that have NO related activities documented.
4. For each element lacking activities, suggest 2-3 examples of what types of accomplishments or activities would demonstrate progress toward that element (based on its description, expected results, and success criteria).
5. For each element, output: "Employee's performance is at Level 3 or higher for this Critical Element"
6. Output ONLY the statement, rewritten activities, and (if missing) suggestions for that element.

===== OUTPUT FORMAT =====
## Critical Element: <Element Title>
Employee's performance is at Level 3 or higher for this Critical Element
- Rewritten activity in professional language
- Rewritten activity in professional language

[IF NO ACTIVITIES DOCUMENTED FOR AN ELEMENT, USE THIS FORMAT:]
## Critical Element: <Element Title>
⚠️ **NO ACTIVITIES DOCUMENTED FOR THIS ELEMENT**

Suggested activities the employee may have done:
- <Specific, concrete activity description that would demonstrate progress on this element>
- <Specific, concrete activity description that would demonstrate progress on this element>
- <Specific, concrete activity description that would demonstrate progress on this element>

Do NOT include element descriptions or criteria in output - ONLY the performance statement, rewritten activities, and suggestions for gaps.
Do NOT make up activities. Only suggest realistic, specific activities based on the element's expected results and success criteria.
`;
}
