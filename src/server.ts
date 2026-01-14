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

// AI Providers
app.get("/api/ai/providers", (_req, res) => {
  const providers: { name: string; models: string[] }[] = [];
  
  if (process.env.OPENAI_API_KEY) {
    const models = [
      process.env.OPENAI_MODEL || "gpt-5.2",
      "gpt-5.2",
      "gpt-5.1",
      "gpt-5",
      "gpt-4.5-turbo",
      "gpt-4o"
    ];
    providers.push({ name: "openai", models: [...new Set(models)] });
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    const models = [
      process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
      "claude-opus-4",
      "claude-sonnet-3-5-20241022"
    ];
    providers.push({ name: "anthropic", models: [...new Set(models)] });
  }
  
  res.json(providers);
});

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
      description: z.string().min(1),
      objectives: z.string().optional(),
      resultsOfActivities: z.string().optional(),
      metrics: z.string().optional()
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

app.put("/api/plans/:planId/elements/:elementId/metrics", async (req, res) => {
  const schema = z.object({
    resultsOfActivities: z.string().optional(),
    metrics: z.string().optional()
  });
  const body = schema.parse(req.body);

  const plans = await getPlans();
  const planIdx = plans.findIndex((p) => p.id === req.params.planId);
  if (planIdx === -1) return res.status(404).json({ error: "Plan not found" });

  const elements = plans[planIdx].elements || [];
  const elemIdx = elements.findIndex((e) => e.id === req.params.elementId);
  if (elemIdx === -1) return res.status(404).json({ error: "Element not found" });

  if (body.resultsOfActivities !== undefined) {
    elements[elemIdx].resultsOfActivities = body.resultsOfActivities || undefined;
  }
  if (body.metrics !== undefined) {
    elements[elemIdx].metrics = body.metrics || undefined;
  }

  plans[planIdx].elements = elements;
  await writeJson(PlansFile, plans);
  res.json(elements[elemIdx]);
});

app.delete("/api/plans/:planId", async (req, res) => {
  const plans = await getPlans();
  const idx = plans.findIndex((p) => p.id === req.params.planId);
  if (idx === -1) return res.status(404).json({ error: "Plan not found" });

  const plan = plans[idx];
  
  // Delete associated PDF file
  try {
    await import("node:fs/promises").then((fs) => fs.unlink(plan.pdfPath));
  } catch (e) {
    console.warn(`Failed to delete PDF file: ${plan.pdfPath}`, e);
  }

  // Remove plan from list
  plans.splice(idx, 1);
  await writeJson(PlansFile, plans);

  // Delete associated activities
  const activities = await getActivities();
  const filtered = activities.filter((a) => a.planId !== req.params.planId);
  await writeJson(ActivitiesFile, filtered);

  // Delete associated reviews
  const reviews = await getReviews();
  const filteredReviews = reviews.filter((r) => r.planId !== req.params.planId);
  await writeJson(ReviewsFile, filteredReviews);

  res.json({ ok: true });
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
    month: z.string().regex(/^\d{4}-\d{2}$/),
    content: z.string().min(1)
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

app.put("/api/activities/:activityId", async (req, res) => {
  const schema = z.object({
    content: z.string().min(1).optional()
  });
  const body = schema.parse(req.body);

  const activities = await getActivities();
  const idx = activities.findIndex((a) => a.id === req.params.activityId);
  if (idx === -1) return res.status(404).json({ error: "Activity not found" });

  const activity = activities[idx];
  activities[idx] = {
    ...activity,
    content: body.content ?? activity.content
  };
  await writeJson(ActivitiesFile, activities);
  res.json(activities[idx]);
});

app.delete("/api/activities/:activityId", async (req, res) => {
  const activities = await getActivities();
  const idx = activities.findIndex((a) => a.id === req.params.activityId);
  if (idx === -1) return res.status(404).json({ error: "Activity not found" });

  activities.splice(idx, 1);
  await writeJson(ActivitiesFile, activities);
  res.json({ ok: true });
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
    guidance: z.string().optional(),
    provider: z.enum(["openai", "anthropic"]).optional(),
    model: z.string().optional()
  });
  const body = schema.parse(req.body);

  const employees = await getEmployees();
  const plans = await getPlans();
  const activities = await getActivities();

  const emp = employees.find((e) => e.id === body.employeeId);
  if (!emp) return res.status(404).json({ error: "Employee not found" });

  const plan = plans.find((p) => p.id === body.planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  // Filter activities within period (by month)
  const periodActs = activities.filter((a) => a.employeeId === body.employeeId && a.planId === body.planId)
    .filter((a) => a.month >= body.periodStart.slice(0, 7) && a.month <= body.periodEnd.slice(0, 7));

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

  const ai = await runAI(prompt, body.provider, body.model);

  if (ai.truncated) {
    console.warn(`[Review] WARNING: Prompt was truncated at MAX_PROMPT_CHARS limit!`);
  }

  const review: ReviewDraft = {
    id: newId("rev_"),
    employeeId: body.employeeId,
    planId: body.planId,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    createdAt: todayISO(),
    promptMeta: { provider: ai.provider, model: ai.model, truncated: ai.truncated },
    outputMarkdown: ai.output
  };

  const reviews = await getReviews();
  reviews.push(review);
  await writeJson(ReviewsFile, reviews);

  res.json(review);
});

app.delete("/api/reviews/:reviewId", async (req, res) => {
  const reviews = await getReviews();
  const idx = reviews.findIndex((r) => r.id === req.params.reviewId);
  if (idx < 0) return res.status(404).json({ error: "Review not found" });
  reviews.splice(idx, 1);
  await writeJson(ReviewsFile, reviews);
  res.json({ deleted: true });
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
