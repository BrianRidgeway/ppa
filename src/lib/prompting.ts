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

export function buildFinalRatingPrompt(params: {
  employeeName: string;
  fiscalYear: string;
  elements: Array<{
    id: string;
    title: string;
    weight?: number;
    description: string;
    combinedActivities: string;
  }>;
  targetRating: number; // 1-5
}): string {
  const { employeeName, fiscalYear, elements, targetRating } = params;

  // Calculate target score range
  let minScore = 100;
  let maxScore = 199;
  if (targetRating === 2) {
    minScore = 200;
    maxScore = 289;
  } else if (targetRating === 3) {
    minScore = 290;
    maxScore = 379;
  } else if (targetRating === 4) {
    minScore = 380;
    maxScore = 469;
  } else if (targetRating === 5) {
    minScore = 470;
    maxScore = 500;
  }

  const elementsList = elements.map(e => {
    const weight = e.weight || 10;
    return `## ${mdEscape(e.title)} (Weight: ${weight})
Description: ${mdEscape(e.description)}

Combined Activities Documentation:
${mdEscape(e.combinedActivities)}`;
  }).join("\n\n");

  return `TASK: Generate a final performance rating based on combined fiscal year activities.

Employee: ${employeeName}
Fiscal Year: ${fiscalYear} (October - September)
Target Overall Rating: ${targetRating}/5

===== CRITICAL ELEMENTS WITH COMBINED ACTIVITIES =====
${elementsList}

===== RATING INSTRUCTIONS =====
1. For each critical element, provide:
   - A professional summary (2-3 sentences) of the employee's performance based on the combined activities
   - A rating (1-5) that best reflects the documented performance
2. Element ratings should be distributed such that:
   - Each element's score = rating × weight
   - Total score = sum of all element scores
   - Total score should fall within the target range: ${minScore}-${maxScore} for overall rating ${targetRating}
3. Higher weights should typically receive higher ratings to optimize for the target overall rating
4. Ratings should be justified by the documented activities

===== SCORING GUIDE =====
Overall Rating 5 = Total Score 470-500
Overall Rating 4 = Total Score 380-469
Overall Rating 3 = Total Score 290-379
Overall Rating 2 = Total Score 200-289
Overall Rating 1 = Total Score 100-199

===== OUTPUT FORMAT =====
For each element, output:

## <Element Title>
**Summary:** <2-3 sentence professional summary of performance>
**Rating:** <1-5>
**Score:** <rating × weight>

At the end, output:
**Total Score:** <sum of all scores>

Then provide a comprehensive narrative summary:

## Summary Rating Narrative Documentation
<4-5 paragraph professional narrative summarizing the employee's overall performance across all critical elements, key achievements, areas of strength, and any areas for growth. Reference specific accomplishments from the documented activities.>

Do not include explanations outside the specified format.
`;
}
