import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { z } from "zod";

import { ensureUploadsDir, uploadsDir, readJson, writeJson } from "./lib/storage.js";
import { extractPdfText } from "./lib/pdf.js";
import { extractPlanElements } from "./lib/planExtractor.js";
import { newId } from "./lib/id.js";
import { Activity, Employee, Plan, PlanElement, ReviewDraft } from "./lib/types.js";
import { buildReviewPrompt } from "./lib/prompting.js";
import { runAI } from "./lib/ai/index.js";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(process.cwd(), "public")));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const EmployeesFile = "employees.json";
const PlansFile = "plans.json";
const ActivitiesFile = "activities.json";
const ReviewsFile = "reviews.json";

function todayISO(): string {
  return new Date().toISOString();
}

async function getEmployees(): Promise<Employee[]> {
  return readJson<Employee[]>(EmployeesFile, []);
}
async function getPlans(): Promise<Plan[]> {
  return readJson<Plan[]>(PlansFile, []);
}
async function getActivities(): Promise<Activity[]> {
  return readJson<Activity[]>(ActivitiesFile, []);
}
async function getReviews(): Promise<ReviewDraft[]> {
  return readJson<ReviewDraft[]>(ReviewsFile, []);
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Employees
app.get("/api/employees", async (_req, res) => {
  res.json(await getEmployees());
});

app.post("/api/employees", async (req, res) => {
  const schema = z.object({
    displayName: z.string().min(1),
    email: z.string().email().optional()
  });
  const body = schema.parse(req.body);

  const employees = await getEmployees();
  const employee: Employee = { id: newId("emp_"), createdAt: todayISO(), ...body };
  employees.push(employee);
  await writeJson(EmployeesFile, employees);
  res.json(employee);
});

// Plans
app.get("/api/plans", async (_req, res) => {
  res.json(await getPlans());
});

app.get("/api/plans/:planId", async (req, res) => {
  const plans = await getPlans();
  const plan = plans.find((p) => p.id === req.params.planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  res.json(plan);
});

app.post("/api/plans/upload", upload.single("pdf"), async (req, res) => {
  const employeeId = String(req.body.employeeId || "");
  if (!employeeId) return res.status(400).json({ error: "employeeId is required" });
  if (!req.file) return res.status(400).json({ error: "pdf file is required" });

  await ensureUploadsDir();

  const fileName = req.file.originalname || "plan.pdf";
  const planId = newId("plan_");
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const pdfPath = path.join(uploadsDir(), `${planId}__${safeName}`);

  // Write PDF locally
  await import("node:fs/promises").then((fs) => fs.writeFile(pdfPath, req.file!.buffer));

  // Extract text locally
  const extractedText = await extractPdfText(pdfPath);

  // Parse elements locally (heuristics)
  const elements = extractPlanElements(extractedText);

  const plans = await getPlans();
  const plan: Plan = {
    id: planId,
    employeeId,
    fileName,
    uploadedAt: todayISO(),
    pdfPath,
    extractedText,
    elements
  };
  plans.push(plan);
  await writeJson(PlansFile, plans);

  res.json(plan);
});

app.put("/api/plans/:planId/elements", async (req, res) => {
  const schema = z.object({
    elements: z.array(z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1)
    }))
  });
  const body = schema.parse(req.body);

  const plans = await getPlans();
  const idx = plans.findIndex((p) => p.id === req.params.planId);
  if (idx === -1) return res.status(404).json({ error: "Plan not found" });

  plans[idx].elements = body.elements as PlanElement[];
  await writeJson(PlansFile, plans);
  res.json(plans[idx]);
});

// Activities
app.get("/api/activities", async (req, res) => {
  const employeeId = String(req.query.employeeId || "");
  const planId = String(req.query.planId || "");
  const activities = await getActivities();
  const filtered = activities.filter((a) =>
    (!employeeId || a.employeeId === employeeId) &&
    (!planId || a.planId === planId)
  );
  res.json(filtered);
});

app.post("/api/activities", async (req, res) => {
  const schema = z.object({
    employeeId: z.string().min(1),
    planId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    summary: z.string().min(1),
    evidence: z.string().optional(),
    relatedElementIds: z.array(z.string()).optional()
  });
  const body = schema.parse(req.body);

  const activities = await getActivities();
  const activity: Activity = {
    id: newId("act_"),
    createdAt: todayISO(),
    ...body
  };
  activities.push(activity);
  await writeJson(ActivitiesFile, activities);
  res.json(activity);
});

// Reviews
app.get("/api/reviews", async (req, res) => {
  const employeeId = String(req.query.employeeId || "");
  const planId = String(req.query.planId || "");
  const reviews = await getReviews();
  const filtered = reviews.filter((r) =>
    (!employeeId || r.employeeId === employeeId) &&
    (!planId || r.planId === planId)
  ).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  res.json(filtered);
});

app.post("/api/reviews/generate", async (req, res) => {
  const schema = z.object({
    employeeId: z.string().min(1),
    planId: z.string().min(1),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    elementIds: z.array(z.string()).optional(),
    guidance: z.string().optional()
  });
  const body = schema.parse(req.body);

  const employees = await getEmployees();
  const plans = await getPlans();
  const activities = await getActivities();

  const emp = employees.find((e) => e.id === body.employeeId);
  if (!emp) return res.status(404).json({ error: "Employee not found" });

  const plan = plans.find((p) => p.id === body.planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  // Filter activities within period
  const periodActs = activities.filter((a) => a.employeeId === body.employeeId && a.planId === body.planId)
    .filter((a) => a.date >= body.periodStart && a.date <= body.periodEnd);

  // Choose subset of elements if requested
  const elements = body.elementIds?.length
    ? plan.elements.filter((e) => body.elementIds!.includes(e.id))
    : plan.elements;

  const prompt = buildReviewPrompt({
    employeeName: emp.displayName,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    plan,
    elements,
    activities: periodActs,
    guidance: body.guidance
  });

  const ai = await runAI(prompt);

  const review: ReviewDraft = {
    id: newId("rev_"),
    employeeId: body.employeeId,
    planId: body.planId,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    createdAt: todayISO(),
    promptMeta: { provider: ai.provider, model: ai.model },
    outputMarkdown: ai.output
  };

  const reviews = await getReviews();
  reviews.push(review);
  await writeJson(ReviewsFile, reviews);

  res.json(review);
});

// Basic error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(400).json({ error: err?.message || "Request failed" });
});

const port = Number(process.env.PORT || "3000");
app.listen(port, () => {
  console.log(`perf-review-local-app running on http://localhost:${port}`);
});
