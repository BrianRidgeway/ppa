export type ID = string;

export interface Employee {
  id: ID;
  displayName: string;
  email?: string;
  createdAt: string;
}

export interface PlanElement {
  id: ID;
  title: string;
  description: string;
  weight?: number; // Element weight for final rating calculation
  objectives?: string; // Goals/objectives for this critical element
  resultsOfActivities?: string; // Expected results/outcomes of activities
  metrics?: string; // Performance metrics or success criteria
}

export interface Plan {
  id: ID;
  employeeId: ID; // owner (you can also share plans across employees by duplicating)
  fileName: string;
  uploadedAt: string;
  pdfPath: string; // local
  extractedText: string; // local extracted text
  elements: PlanElement[];
}

export interface Activity {
  id: ID;
  employeeId: ID;
  planId: ID;
  month: string; // YYYY-MM
  content: string; // bulk activity notes for the month
  createdAt: string;
}

export interface ReviewDraft {
  id: ID;
  employeeId: ID;
  planId: ID;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  createdAt: string;
  promptMeta: {
    provider: string;
    model: string;
    truncated?: boolean;
  };
  outputMarkdown: string;
}

export interface PerformanceRating {
  id: ID;
  employeeId: ID;
  planId: ID;
  fiscalYear: string; // e.g., "2025" for Oct 2024 - Sep 2025
  overallRating: number; // 1-5
  createdAt: string;
  promptMeta: {
    provider: string;
    model: string;
  };
  elementRatings: {
    elementId: ID;
    title: string;
    rating: number; // 1-5
    score: number; // rating * weight
    summary: string;
  }[];
  totalScore: number;
  narrativeSummary: string; // Final comprehensive narrative documentation
  outputMarkdown: string;
}
