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
  date: string; // YYYY-MM-DD
  summary: string;
  evidence?: string;
  relatedElementIds?: ID[];
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
  };
  outputMarkdown: string;
}
