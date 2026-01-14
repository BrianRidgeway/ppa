import { PlanElement } from "./types.js";
import { newId } from "./id.js";

/**
 * Structured extraction of plan elements from PDF text.
 * Looks for specific section markers:
 * - Name: between "Critical Element" and "Element Weight"
 * - ResultsOfActivities: between "Results of Activities" and "Criteria for Evaluation"
 * - Criteria: between "Criteria for Evaluation (Metrics)" and "Final Element Rating"
 * 
 * Handles government performance plan formats (CD-430, etc).
 */
export function extractPlanElements(text: string): PlanElement[] {
  const lines = text.split(/\n/).map((l) => l.trim());

  const elements: PlanElement[] = [];

  // Split text by element markers (look for "Critical Element" followed by a name)
  for (let i = 0; i < lines.length; i++) {
    if (/^Critical\s+Element/i.test(lines[i])) {
      const result = parseStructuredElement(lines, i);
      if (result && result.element) {
        elements.push(result.element);
        i = result.nextIndex;
      }
    }
  }

  return elements;
}

function parseStructuredElement(lines: string[], startIdx: number): {
  element: PlanElement | null;
  nextIndex: number;
} {
  let i = startIdx;
  
  // Extract name: between "Critical Element" and "Element Weight" or "Objective"
  let name = "";
  i++;
  while (i < lines.length && !/^Objective/i.test(lines[i]) && !/^Element\s+Weight/i.test(lines[i])) {
    const line = lines[i].trim();
    if (line && !/^critical\s+element/i.test(line) && !/^select\s+language/i.test(line) && !/^Element$/i.test(line)) {
      name = line;
      break;
    }
    i++;
  }

  if (!name) {
    return { element: null, nextIndex: i };
  }

  // Extract weight: look for "Element Weight" or "Weight:" pattern
  let weight: number | undefined;
  let j = startIdx + 1;
  while (j < lines.length && !/^Objective/i.test(lines[j])) {
    const line = lines[j].trim();
    
    // Check for "Element Weight: 15" or "Weight: 15" format
    let weightMatch = line.match(/(?:Element\s+)?Weight[:\s]*(\d+)/i);
    if (weightMatch) {
      weight = parseInt(weightMatch[1], 10);
      break;
    }
    // Check if this line is "Weight:" or "Element Weight" and next line is the number
    else if (/^Weight\s*:?\s*$/i.test(line) || /^Element\s+Weight\s*:?\s*$/i.test(line)) {
      if (j + 1 < lines.length) {
        const nextLine = lines[j + 1].trim();
        const numMatch = nextLine.match(/^(\d+)$/);
        if (numMatch) {
          weight = parseInt(numMatch[1], 10);
          break;
        }
      }
    }
    j++;
  }

  // Advance to Objective section
  while (i < lines.length && !/^Objective/i.test(lines[i])) {
    i++;
  }

  // Extract description/objectives: between "Objective" and "Results of Activities"
  let objectives = "";
  if (i < lines.length) {
    i++; // Move past "Objective" header
    // Skip "Select Language" if present
    if (i < lines.length && /^Select\s+Language/i.test(lines[i])) {
      i++;
    }
    // Collect until "Results of Activities"
    const objectiveLines: string[] = [];
    while (i < lines.length && !/^Results\s+of\s+Activities/i.test(lines[i])) {
      const line = lines[i].trim();
      if (line && !/^Select\s+Language/i.test(line)) {
        objectiveLines.push(line);
      }
      i++;
    }
    objectives = objectiveLines.join(" ").replace(/\s{2,}/g, " ").trim();
  }

  // Find "Results of Activities" section
  let resultsOfActivities = "";
  while (i < lines.length && !/^Results\s+of\s+Activities/i.test(lines[i])) {
    i++;
  }
  
  if (i < lines.length) {
    i++; // Move past "Results of Activities" header
    // Skip "Select Language" if present
    if (i < lines.length && /^Select\s+Language/i.test(lines[i])) {
      i++;
    }
    // Collect until "Criteria for Evaluation"
    const resultsLines: string[] = [];
    while (i < lines.length && !/^Criteria\s+for\s+Evaluation/i.test(lines[i])) {
      const line = lines[i].trim();
      if (line && !/^Select\s+Language/i.test(line)) {
        resultsLines.push(line);
      }
      i++;
    }
    resultsOfActivities = resultsLines.join(" ").replace(/\s{2,}/g, " ").trim();
  }

  // Find "Criteria for Evaluation (Metrics)" section
  let criteria = "";
  while (i < lines.length && !/^Criteria\s+for\s+Evaluation/i.test(lines[i])) {
    i++;
  }
  
  if (i < lines.length) {
    i++; // Move past "Criteria for Evaluation" header
    // Skip "Select Language" if present
    if (i < lines.length && /^Select\s+Language/i.test(lines[i])) {
      i++;
    }
    // Collect until "Final Element Rating" or next "Critical Element"
    const criteriaLines: string[] = [];
    while (i < lines.length && !/^Final\s+Element\s+Rating/i.test(lines[i]) && !/^Critical\s+Element/i.test(lines[i])) {
      const line = lines[i].trim();
      if (line && !/^Select\s+Language/i.test(line)) {
        criteriaLines.push(line);
      }
      i++;
    }
    criteria = criteriaLines.join(" ").replace(/\s{2,}/g, " ").trim();
  }

  const element: PlanElement = {
    id: newId("el_"),
    title: name,
    description: objectives || "",
    weight: weight,
    resultsOfActivities: resultsOfActivities || undefined,
    metrics: criteria || undefined
  };

  return {
    element,
    nextIndex: i
  };
}


