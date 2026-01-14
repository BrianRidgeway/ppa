const $ = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

function selectedEmployeeId() {
  return $("employeeSelect").value;
}
function selectedPlanId() {
  return $("planSelect").value;
}

async function refreshEmployees() {
  const employees = await api("/api/employees");
  const sel = $("employeeSelect");
  sel.innerHTML = "";
  for (const e of employees) {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = `${e.displayName}${e.email ? " (" + e.email + ")" : ""}`;
    sel.appendChild(opt);
  }
  if (!employees.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Add an employee first";
    sel.appendChild(opt);
  }
}

async function refreshPlans() {
  const plans = await api("/api/plans");
  const empId = selectedEmployeeId();
  const filtered = empId ? plans.filter((p) => p.employeeId === empId) : plans;

  const sel = $("planSelect");
  sel.innerHTML = "";
  for (const p of filtered) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.fileName} — uploaded ${new Date(p.uploadedAt).toLocaleString()}`;
    sel.appendChild(opt);
  }
  if (!filtered.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Upload a plan for this employee";
    sel.appendChild(opt);
  }

  await refreshPlanElementsUI();
}

let cachedPlan = null;

async function refreshPlanElementsUI() {
  const planId = selectedPlanId();
  if (!planId) {
    $("elementsBox").innerHTML = "<span class='muted'>Upload/select a plan to see elements.</span>";
    cachedPlan = null;
    return;
  }
  cachedPlan = await api(`/api/plans/${planId}`);
  const box = $("elementsBox");
  box.innerHTML = "";
  for (const el of cachedPlan.elements || []) {
    const label = document.createElement("label");
    label.innerHTML = `
      <input type="checkbox" class="elcheck" value="${escapeHtml(el.id)}" />
      <div>
        <div class="el-title">${escapeHtml(el.title)}</div>
        <div class="muted">${escapeHtml(el.description).slice(0, 140)}${el.description.length > 140 ? "…" : ""}</div>
      </div>
    `;
    box.appendChild(label);
  }
  if (!cachedPlan.elements?.length) {
    box.innerHTML = "<span class='muted'>No elements detected.</span>";
  }
}

function selectedElementIds() {
  return Array.from(document.querySelectorAll(".elcheck"))
    .filter((x) => x.checked)
    .map((x) => x.value);
}

async function refreshActivities() {
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  if (!empId || !planId) return;

  const acts = await api(`/api/activities?employeeId=${encodeURIComponent(empId)}&planId=${encodeURIComponent(planId)}`);
  const list = $("activityList");
  list.innerHTML = "";
  for (const a of acts.sort((x,y)=>y.date.localeCompare(x.date))) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <h4>${escapeHtml(a.date)} <span class="badge">${escapeHtml(a.id)}</span></h4>
      <div>${escapeHtml(a.summary)}</div>
      ${a.evidence ? `<div class="muted">Evidence: ${escapeHtml(a.evidence)}</div>` : ""}
      ${a.relatedElementIds?.length ? `<div class="muted">Related: ${a.relatedElementIds.map(escapeHtml).join(", ")}</div>` : ""}
    `;
    list.appendChild(div);
  }
  if (!acts.length) list.innerHTML = "<div class='muted'>No activities yet.</div>";
}

async function refreshReviews() {
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  if (!empId || !planId) return;

  const reviews = await api(`/api/reviews?employeeId=${encodeURIComponent(empId)}&planId=${encodeURIComponent(planId)}`);
  const list = $("reviewsList");
  list.innerHTML = "";
  for (const r of reviews) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <h4>${escapeHtml(r.periodStart)} → ${escapeHtml(r.periodEnd)} <span class="badge">${escapeHtml(r.promptMeta.provider)} / ${escapeHtml(r.promptMeta.model)}</span></h4>
      <div class="muted">Created: ${new Date(r.createdAt).toLocaleString()}</div>
      <details style="margin-top:8px;">
        <summary>Show output</summary>
        <div class="output">${escapeHtml(r.outputMarkdown)}</div>
      </details>
    `;
    list.appendChild(div);
  }
  if (!reviews.length) list.innerHTML = "<div class='muted'>No saved reviews yet.</div>";
}

$("createEmp").addEventListener("click", async () => {
  const displayName = $("empName").value.trim();
  const email = $("empEmail").value.trim();
  if (!displayName) return alert("Enter a name.");
  await api("/api/employees", { method: "POST", body: JSON.stringify({ displayName, email: email || undefined }) });
  $("empName").value = "";
  $("empEmail").value = "";
  await refreshEmployees();
  await refreshPlans();
});

$("refreshEmp").addEventListener("click", refreshEmployees);
$("refreshPlans").addEventListener("click", refreshPlans);
$("refreshActivities").addEventListener("click", refreshActivities);
$("refreshReviews").addEventListener("click", refreshReviews);

$("employeeSelect").addEventListener("change", async () => {
  await refreshPlans();
  await refreshActivities();
  await refreshReviews();
});

$("planSelect").addEventListener("change", async () => {
  await refreshPlanElementsUI();
  await refreshActivities();
  await refreshReviews();
});

$("uploadPlan").addEventListener("click", async () => {
  const empId = selectedEmployeeId();
  const file = $("planPdf").files?.[0];
  if (!empId) return alert("Select an employee first.");
  if (!file) return alert("Choose a PDF first.");

  const form = new FormData();
  form.append("employeeId", empId);
  form.append("pdf", file);

  const res = await fetch("/api/plans/upload", { method: "POST", body: form });
  if (!res.ok) return alert(await res.text());

  await refreshPlans();
  $("planPdf").value = "";
});

$("addActivity").addEventListener("click", async () => {
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  const date = $("actDate").value;
  const summary = $("actSummary").value.trim();
  const evidence = $("actEvidence").value.trim();
  if (!empId || !planId) return alert("Select employee and plan.");
  if (!date) return alert("Pick a date.");
  if (!summary) return alert("Write a short summary.");
  const relatedElementIds = selectedElementIds();

  await api("/api/activities", {
    method: "POST",
    body: JSON.stringify({
      employeeId: empId,
      planId,
      date,
      summary,
      evidence: evidence || undefined,
      relatedElementIds: relatedElementIds.length ? relatedElementIds : undefined
    })
  });

  $("actSummary").value = "";
  $("actEvidence").value = "";
  document.querySelectorAll(".elcheck").forEach((x) => (x.checked = false));
  await refreshActivities();
});

$("generateReview").addEventListener("click", async () => {
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  const periodStart = $("periodStart").value;
  const periodEnd = $("periodEnd").value;
  const guidance = $("guidance").value.trim();
  if (!empId || !planId) return alert("Select employee and plan.");
  if (!periodStart || !periodEnd) return alert("Pick a start and end date.");

  $("reviewOutput").textContent = "Generating…";

  try {
    const elementIds = selectedElementIds();
    const review = await api("/api/reviews/generate", {
      method: "POST",
      body: JSON.stringify({
        employeeId: empId,
        planId,
        periodStart,
        periodEnd,
        elementIds: elementIds.length ? elementIds : undefined,
        guidance: guidance || undefined
      })
    });
    $("reviewOutput").textContent = review.outputMarkdown || "(empty)";
    await refreshReviews();
  } catch (e) {
    $("reviewOutput").textContent = "";
    alert(String(e));
  }
});

// Initial load
(async function init() {
  await refreshEmployees();
  await refreshPlans();
  await refreshActivities();
  await refreshReviews();

  // Set defaults for period (last 90 days)
  const end = new Date();
  const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  $("periodEnd").value = end.toISOString().slice(0,10);
  $("periodStart").value = start.toISOString().slice(0,10);
})();
