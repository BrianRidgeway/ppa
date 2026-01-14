const $ = (id) => document.getElementById(id);

function showNotification(message, type = "info") {
  let notifContainer = document.getElementById("notificationContainer");
  if (!notifContainer) {
    notifContainer = document.createElement("div");
    notifContainer.id = "notificationContainer";
    notifContainer.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;";
    document.body.appendChild(notifContainer);
  }

  const notif = document.createElement("div");
  notif.style.cssText = `
    padding: 12px 16px;
    margin-bottom: 8px;
    border-radius: 8px;
    color: white;
    background: ${type === "error" ? "#d32f2f" : type === "success" ? "#388e3c" : "#1976d2"};
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease-out;
  `;
  notif.textContent = message;
  notifContainer.appendChild(notif);

  setTimeout(() => notif.remove(), 4000);
}

function confirmModal(message) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.display = "block";
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-body" style="padding: 20px;">
          <p style="margin: 0 0 20px 0;">${escapeHtml(message)}</p>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button class="secondary" id="confirmCancel">Cancel</button>
            <button id="confirmOk" style="background: #d32f2f;">Delete</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const cancelBtn = modal.querySelector("#confirmCancel");
    const okBtn = modal.querySelector("#confirmOk");

    const cleanup = () => modal.remove();

    cancelBtn.addEventListener("click", () => {
      cleanup();
      resolve(false);
    });

    okBtn.addEventListener("click", () => {
      cleanup();
      resolve(true);
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    });
  });
}

async function api(path, opts = {}) {
  const { timeout = 120000, ...fetchOpts } = opts; // Default 2 min, allow override
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const res = await fetch(path, { headers: { "Content-Type": "application/json" }, signal: controller.signal, ...fetchOpts });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed: ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

// Simple markdown to HTML converter
function markdownToHtml(md) {
  let html = escapeHtml(md);
  // Headings
  html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  // Bullets - wrap consecutive <li> tags in <ul>
  html = html.replace(/(<li>.*?<\/li>)(<br>(?=<li>)|(?=<li>))/g, "$1");
  html = html.replace(/(<li>(?:.*?<\/li><br>?)+)/gs, "<ul>$1</ul>");
  html = html.replace(/<br>(<\/ul>)/g, "$1");
  // Code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Line breaks
  html = html.replace(/\n/g, "<br>");
  return html;
}

function selectedEmployeeId() {
  return $("employeeSelect").value;
}
function selectedPlanId() {
  return $("planSelect").value;
}

async function refreshAIProviders() {
  try {
    const providers = await api("/api/ai/providers");
    const providerSel = $("aiProvider");
    const modelSel = $("aiModel");
    
    providerSel.innerHTML = "";
    for (const p of providers) {
      const opt = document.createElement("option");
      opt.value = p.name;
      opt.textContent = p.name.charAt(0).toUpperCase() + p.name.slice(1);
      providerSel.appendChild(opt);
    }
    
    if (providers.length > 0) {
      providerSel.value = providers[0].name;
      updateModelOptions(providers[0].models);
    }
    
    providerSel.addEventListener("change", () => {
      const selectedProvider = providers.find(p => p.name === providerSel.value);
      if (selectedProvider) updateModelOptions(selectedProvider.models);
    });
  } catch (err) {
    console.error("Error loading AI providers:", err);
  }
}

function updateModelOptions(models) {
  const modelSel = $("aiModel");
  modelSel.innerHTML = "";
  for (const model of models) {
    const opt = document.createElement("option");
    opt.value = model;
    opt.textContent = model;
    modelSel.appendChild(opt);
  }
  if (models.length > 0) modelSel.value = models[0];
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
  } else {
    // Auto-select first employee if one exists
    sel.value = employees[0].id;
    // Trigger change event to load their data
    await new Promise(resolve => setTimeout(resolve, 0));
    sel.dispatchEvent(new Event("change"));
  }
}

async function refreshPlans() {
  try {
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
    } else {
      // Auto-select first plan if one exists
      sel.value = filtered[0].id;
    }

    await refreshPlanElementsUI();
    await addDeletePlanButton();
  } catch (e) {
    console.error("Error refreshing plans:", e);
  }
}

async function addDeletePlanButton() {
  try {
    let deleteBtn = document.getElementById("deletePlanBtn");
    if (deleteBtn) deleteBtn.remove();

    const planId = selectedPlanId();
    if (!planId) return;

    deleteBtn = document.createElement("button");
    deleteBtn.id = "deletePlanBtn";
    deleteBtn.className = "secondary";
    deleteBtn.textContent = "Delete plan";
    deleteBtn.addEventListener("click", async () => {
      if (!await confirmModal("Delete this plan? This will also delete all associated activities and reviews.")) return;
      try {
        await api(`/api/plans/${planId}`, { method: "DELETE" });
        console.log("Plan deleted successfully");
        showNotification("Plan deleted.", "success");
        await refreshPlans();
        await refreshActivities();
        await refreshReviews();
      } catch (e) {
        console.error(`Failed to delete plan:`, e);
        showNotification(`Failed to delete plan: ${e}`, "error");
      }
    });

    const refreshBtn = $("refreshPlans");
    if (refreshBtn && refreshBtn.parentNode) {
      refreshBtn.parentNode.insertBefore(deleteBtn, refreshBtn.nextSibling);
    } else {
      console.warn("Could not find refreshPlans button to insert deleteBtn after");
    }
  } catch (e) {
    console.error("Error adding delete plan button:", e);
  }
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
  
  if (!cachedPlan.elements?.length) {
    const msg = document.createElement("div");
    msg.innerHTML = `
      <div class='muted' style="margin-bottom: 12px;">
        No critical elements detected in PDF. 
        <button id="addElementManually" class="secondary" style="padding: 4px 8px; font-size: 12px; margin-top: 6px; display: block;">Add element manually</button>
      </div>
    `;
    box.appendChild(msg);
    
    const addBtn = msg.querySelector("#addElementManually");
    addBtn.addEventListener("click", () => openAddElementModal(planId));
    return;
  }

  // Create a simple list of element names as clickable links
  const list = document.createElement("div");
  list.className = "elements-list";
  
  for (const el of cachedPlan.elements) {
    const item = document.createElement("div");
    item.className = "element-item";
    item.innerHTML = `
      <button class="element-link" data-element-id="${escapeHtml(el.id)}" data-element-title="${escapeHtml(el.title)}" data-element-description="${escapeHtml(el.description)}" data-element-objectives="${escapeHtml(el.objectives || '')}" data-element-results="${escapeHtml(el.resultsOfActivities || '')}" data-element-metrics="${escapeHtml(el.metrics || '')}">
        ${escapeHtml(el.title)}
      </button>
    `;
    list.appendChild(item);
  }
  
  box.appendChild(list);

  // Add button to add more elements
  const addMoreBtn = document.createElement("button");
  addMoreBtn.textContent = "Add element";
  addMoreBtn.className = "secondary";
  addMoreBtn.style.cssText = "padding: 6px 10px; font-size: 12px; margin-top: 8px; width: 100%;";
  addMoreBtn.addEventListener("click", () => openAddElementModal(planId));
  box.appendChild(addMoreBtn);

  // Add modal for element details
  if (!document.getElementById("elementModal")) {
    const modal = document.createElement("div");
    modal.id = "elementModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modalElementTitle"></h3>
          <button class="modal-close" id="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <div id="modalElementBody"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    $("closeModal").addEventListener("click", () => {
      modal.style.display = "none";
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  }

  // Attach click listeners to element links
  for (const btn of document.querySelectorAll(".element-link")) {
    btn.addEventListener("click", () => {
      const elementId = btn.dataset.elementId;
      const title = btn.dataset.elementTitle;
      const description = btn.dataset.elementDescription;
      const objectives = btn.dataset.elementObjectives;
      const results = btn.dataset.elementResults;
      const metrics = btn.dataset.elementMetrics;

      $("modalElementTitle").textContent = title;
      
      let body = `<div class="element-detail"><strong>Description:</strong><p>${escapeHtml(description)}</p></div>`;
      if (objectives) body += `<div class="element-detail"><strong>Objectives:</strong><p>${escapeHtml(objectives)}</p></div>`;
      if (results) {
        body += `<div class="element-detail"><strong>Expected Results:</strong><p>${escapeHtml(results)}</p><button class="edit-metrics" data-element-id="${escapeHtml(elementId)}" data-field="resultsOfActivities" style="padding: 4px 8px; font-size: 12px; margin-top: 8px;">Edit</button></div>`;
      }
      if (metrics) {
        body += `<div class="element-detail"><strong>Metrics:</strong><p>${escapeHtml(metrics)}</p><button class="edit-metrics" data-element-id="${escapeHtml(elementId)}" data-field="metrics" style="padding: 4px 8px; font-size: 12px; margin-top: 8px;">Edit</button></div>`;
      }
      
      $("modalElementBody").innerHTML = body;
      $("elementModal").style.display = "block";

      // Attach edit listeners
      for (const editBtn of $("modalElementBody").querySelectorAll(".edit-metrics")) {
        editBtn.addEventListener("click", () => {
          const eid = editBtn.dataset.elementId;
          const field = editBtn.dataset.field;
          const currentValue = field === "resultsOfActivities" ? results : metrics;
          openEditElementMetricsModal(selectedPlanId(), eid, field, currentValue);
        });
      }
    });
  }
}

async function openAddElementModal(planId) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "block";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Add Critical Element</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <label style="display: block; margin-bottom: 12px;">
          <strong>Title</strong><br>
          <input type="text" id="newElementTitle" placeholder="e.g., Leadership and Communication" style="width: 100%; margin-top: 4px;">
        </label>
        <label style="display: block; margin-bottom: 12px;">
          <strong>Description</strong><br>
          <textarea id="newElementDescription" placeholder="Core description of this element" style="width: 100%; min-height: 80px; margin-top: 4px;"></textarea>
        </label>
        <label style="display: block; margin-bottom: 12px;">
          <strong>Objectives (optional)</strong><br>
          <textarea id="newElementObjectives" placeholder="Goals and objectives" style="width: 100%; min-height: 60px; margin-top: 4px;"></textarea>
        </label>
        <label style="display: block; margin-bottom: 12px;">
          <strong>Expected Results (optional)</strong><br>
          <textarea id="newElementResults" placeholder="Expected results and outcomes" style="width: 100%; min-height: 60px; margin-top: 4px;"></textarea>
        </label>
        <label style="display: block; margin-bottom: 12px;">
          <strong>Metrics (optional)</strong><br>
          <textarea id="newElementMetrics" placeholder="Success criteria and metrics" style="width: 100%; min-height: 60px; margin-top: 4px;"></textarea>
        </label>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="secondary" id="cancelAddElement">Cancel</button>
          <button id="saveAddElement">Add Element</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector(".modal-close");
  closeBtn.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  const cancelBtn = modal.querySelector("#cancelAddElement");
  cancelBtn.addEventListener("click", () => modal.remove());

  const saveBtn = modal.querySelector("#saveAddElement");
  saveBtn.addEventListener("click", async () => {
    const title = modal.querySelector("#newElementTitle").value.trim();
    const description = modal.querySelector("#newElementDescription").value.trim();
    const objectives = modal.querySelector("#newElementObjectives").value.trim();
    const results = modal.querySelector("#newElementResults").value.trim();
    const metrics = modal.querySelector("#newElementMetrics").value.trim();

    if (!title || !description) return showNotification("Title and description are required.", "error");

    try {
      const plan = cachedPlan;
      const newElements = [
        ...(plan.elements || []),
        {
          id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          title,
          description,
          objectives: objectives || undefined,
          resultsOfActivities: results || undefined,
          metrics: metrics || undefined
        }
      ];

      await api(`/api/plans/${planId}/elements`, {
        method: "PUT",
        body: JSON.stringify({ elements: newElements })
      });

      modal.remove();
      showNotification("Element added.", "success");
      await refreshPlanElementsUI();
    } catch (e) {
      showNotification(`Failed to add element: ${e}`, "error");
    }
  });
}

async function openEditElementMetricsModal(planId, elementId, field, currentValue) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "block";
  const fieldLabel = field === "resultsOfActivities" ? "Expected Results of Activities" : "Criteria for Evaluation (Metrics)";
  
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Edit ${fieldLabel}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <label style="display: block; margin-bottom: 12px;">
          <strong>${fieldLabel}</strong><br>
          <textarea id="editMetricsValue" style="width: 100%; min-height: 120px; margin-top: 4px;">${escapeHtml(currentValue || "")}</textarea>
        </label>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="secondary" id="cancelEditMetrics">Cancel</button>
          <button id="saveEditMetrics">Save</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector(".modal-close");
  closeBtn.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  const cancelBtn = modal.querySelector("#cancelEditMetrics");
  cancelBtn.addEventListener("click", () => modal.remove());

  const saveBtn = modal.querySelector("#saveEditMetrics");
  saveBtn.addEventListener("click", async () => {
    const value = modal.querySelector("#editMetricsValue").value.trim();
    
    try {
      const body = {};
      body[field] = value || undefined;
      
      await api(`/api/plans/${planId}/elements/${elementId}/metrics`, {
        method: "PUT",
        body: JSON.stringify(body)
      });

      modal.remove();
      showNotification("Metrics updated.", "success");
      await refreshPlanElementsUI();
      // Reopen the element modal
      const btn = document.querySelector(`[data-element-id="${elementId}"]`);
      if (btn) btn.click();
    } catch (e) {
      showNotification(`Failed to save metrics: ${e}`, "error");
    }
  });
}

function selectedElementIds() {
  // No longer using checkboxes for elements; review generation uses all elements
  return [];
}

async function refreshActivities() {
  const list = $("activityList");
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  
  if (!empId || !planId) {
    list.innerHTML = "<div class='muted'>No activities yet.</div>";
    return;
  }

  const acts = await api(`/api/activities?employeeId=${encodeURIComponent(empId)}&planId=${encodeURIComponent(planId)}`);
  
  // Group activities by month (already stored by month)
  const byMonth = {};
  for (const a of acts) {
    const month = a.month;
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(a);
  }

  list.innerHTML = "";

  // Sort months in descending order
  const sortedMonths = Object.keys(byMonth).sort().reverse();

  if (sortedMonths.length === 0) {
    list.innerHTML = "<div class='muted'>No activities yet.</div>";
    return;
  }

  for (const month of sortedMonths) {
    // Month header - parse YYYY-MM format directly
    const [year, monthNum] = month.split("-");
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const monthName = date.toLocaleString("en-US", { month: "long", year: "numeric" });
    
    // Create a collapsible section for each month
    const details = document.createElement("details");
    details.style.marginBottom = "8px";
    
    const summary = document.createElement("summary");
    summary.style.cursor = "pointer";
    summary.style.fontWeight = "600";
    summary.style.padding = "10px";
    summary.style.borderRadius = "8px";
    summary.style.background = "#f5f5f5";
    summary.textContent = monthName;
    details.appendChild(summary);

    // Display each activity for this month (usually just one per month)
    for (const a of byMonth[month]) {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="white-space: pre-wrap; font-family: monospace; font-size: 13px;">${escapeHtml(a.content)}</div>
          </div>
          <div style="display: flex; gap: 4px; flex-shrink: 0;">
            <button class="activity-edit" data-activity-id="${escapeHtml(a.id)}" style="padding: 4px 8px; font-size: 12px;">Edit</button>
            <button class="activity-delete" data-activity-id="${escapeHtml(a.id)}" style="padding: 4px 8px; font-size: 12px; background: #d32f2f;">Delete</button>
          </div>
        </div>
      `;
      details.appendChild(div);
    }
    
    list.appendChild(details);
  }

  // Attach event listeners to edit/delete buttons
  for (const btn of document.querySelectorAll(".activity-edit")) {
    btn.addEventListener("click", () => editActivity(btn.dataset.activityId));
  }
  for (const btn of document.querySelectorAll(".activity-delete")) {
    btn.addEventListener("click", () => deleteActivity(btn.dataset.activityId));
  }
}

async function editActivity(activityId) {
  const acts = await getActivities();
  const activity = acts.find((a) => a.id === activityId);
  if (!activity) return showNotification("Activity not found", "error");

  // Create edit modal
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "block";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Edit Activity - ${escapeHtml(activity.month)}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <label style="display: block; margin-bottom: 12px;">
          <strong>Activity Notes</strong><br>
          <textarea id="editActivityContent" style="width: 100%; min-height: 200px; margin-top: 4px; font-family: monospace;">${escapeHtml(activity.content)}</textarea>
        </label>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="secondary" id="cancelEditActivity">Cancel</button>
          <button id="saveEditActivity">Save</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector(".modal-close");
  closeBtn.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  const cancelBtn = modal.querySelector("#cancelEditActivity");
  cancelBtn.addEventListener("click", () => modal.remove());

  const saveBtn = modal.querySelector("#saveEditActivity");
  saveBtn.addEventListener("click", async () => {
    const content = modal.querySelector("#editActivityContent").value.trim();

    if (!content) return showNotification("Activity notes are required.", "error");

    try {
      await api(`/api/activities/${activityId}`, {
        method: "PUT",
        body: JSON.stringify({ content })
      });
      modal.remove();
      showNotification("Activity updated.", "success");
      await refreshActivities();
    } catch (e) {
      showNotification(`Failed to save activity: ${e}`, "error");
    }
  });
}

async function deleteActivity(activityId) {
  if (!await confirmModal("Delete this activity?")) return;
  try {
    await api(`/api/activities/${activityId}`, { method: "DELETE" });
    showNotification("Activity deleted.", "success");
    await refreshActivities();
  } catch (e) {
    showNotification(`Failed to delete activity: ${e}`, "error");
  }
}

async function getActivities() {
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  if (!empId || !planId) return [];
  return api(`/api/activities?employeeId=${encodeURIComponent(empId)}&planId=${encodeURIComponent(planId)}`);
}

// Extract suggested activities from review output
function extractSuggestions(markdown) {
  const suggestions = {};
  const lines = markdown.split('\n');
  let currentElement = null;
  let inSuggestions = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for element headers
    if (line.startsWith('## Critical Element:')) {
      currentElement = line.replace('## Critical Element:', '').trim();
      inSuggestions = false;
    }
    
    // Look for "NO ACTIVITIES DOCUMENTED" marker
    if (line.includes('⚠️') && line.includes('NO ACTIVITIES DOCUMENTED')) {
      inSuggestions = true;
      suggestions[currentElement] = [];
      continue;
    }
    
    // Collect suggestion bullets
    if (inSuggestions && line.trim().startsWith('- ')) {
      const suggestion = line.trim().substring(2).trim();
      if (suggestion && !suggestion.toLowerCase().includes('suggested activities')) {
        suggestions[currentElement].push(suggestion);
      }
    }
  }
  
  return suggestions;
}

async function addSuggestedActivity(suggestion) {
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  
  if (!empId || !planId) {
    showNotification("Select employee and plan first.", "error");
    return;
  }
  
  // Create a modal for the user to confirm and set the month
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "block";
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h3>Add Suggested Activity</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="element-detail">
          <strong>Suggested activity:</strong>
          <p>${escapeHtml(suggestion)}</p>
        </div>
        <div class="element-detail">
          <strong>Which month did this occur? (YYYY-MM)</strong>
          <input id="suggestedMonth" type="month" style="width: 100%;" />
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
          <button class="secondary" id="cancelAdd">Cancel</button>
          <button id="confirmAdd">Add Activity</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  const monthInput = modal.querySelector("#suggestedMonth");
  const now = new Date();
  monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  modal.querySelector(".modal-close").addEventListener("click", () => modal.remove());
  modal.querySelector("#cancelAdd").addEventListener("click", () => modal.remove());
  
  modal.querySelector("#confirmAdd").addEventListener("click", async () => {
    const month = monthInput.value;
    if (!month) {
      showNotification("Select a month.", "error");
      return;
    }
    
    try {
      await api("/api/activities", {
        method: "POST",
        body: JSON.stringify({
          employeeId: empId,
          planId,
          month,
          content: suggestion
        })
      });
      showNotification("Activity added. Regenerating review...", "success");
      modal.remove();
      
      // Auto-regenerate the review
      const periodStart = $("periodStart").value;
      const periodEnd = $("periodEnd").value;
      if (periodStart && periodEnd) {
        const review = await api("/api/reviews/generate", {
          method: "POST",
          body: JSON.stringify({
            employeeId: empId,
            planId,
            periodStart,
            periodEnd
          })
        });
        showNotification("Review regenerated with new activity.", "success");
        await refreshReviews();
      }
    } catch (err) {
      showNotification(`Failed to add activity: ${err.message}`, "error");
    }
  });
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

async function refreshReviews() {
  const list = $("reviewsList");
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  
  if (!empId || !planId) {
    list.innerHTML = "<div class='muted'>No saved reviews yet.</div>";
    return;
  }

  const reviews = await api(`/api/reviews?employeeId=${encodeURIComponent(empId)}&planId=${encodeURIComponent(planId)}`);
  // Preserve placeholder if it exists
  const placeholder = list.querySelector("[data-placeholder]");
  list.innerHTML = "";
  if (placeholder) list.appendChild(placeholder);
  
  for (const r of reviews) {
    const div = document.createElement("div");
    div.className = "item";
    const outputHtml = markdownToHtml(r.outputMarkdown);
    
    // Extract suggestions from review
    const suggestions = extractSuggestions(r.outputMarkdown);
    const hasMissingActivities = Object.keys(suggestions).length > 0;
    
    // Create collapsible review
    const details = document.createElement("details");
    details.style.marginBottom = "8px";
    
    const summary = document.createElement("summary");
    summary.style.cursor = "pointer";
    summary.style.fontWeight = "600";
    summary.style.padding = "10px";
    summary.style.borderRadius = "8px";
    summary.style.background = hasMissingActivities ? "#ffebee" : "#e8f5e9";
    summary.style.borderLeft = hasMissingActivities ? "4px solid #f44336" : "4px solid #4caf50";
    summary.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>
          ${hasMissingActivities ? "⚠️ INCOMPLETE" : "✓ COMPLETE"}
          ${escapeHtml(r.periodStart)} → ${escapeHtml(r.periodEnd)}
          <span class="badge" style="margin-left: 8px;">${escapeHtml(r.promptMeta.provider)} / ${escapeHtml(r.promptMeta.model)}</span>
        </span>
        <button class="deleteReviewBtn secondary" style="padding: 4px 8px; font-size: 12px;" data-review-id="${escapeHtml(r.id)}" onclick="event.stopPropagation()">Delete</button>
      </div>
    `;
    details.appendChild(summary);
    
    const content = document.createElement("div");
    content.style.padding = "10px";
    let contentHtml = `
      <div class="muted" style="margin-bottom: 8px; font-size: 12px;">Created: ${new Date(r.createdAt).toLocaleString()}</div>
      <div class="output" style="font-family: Georgia, serif; line-height: 1.6;">${outputHtml}</div>
    `;
    
    // Add suggestions section if any exist
    if (Object.keys(suggestions).length > 0) {
      contentHtml += `<div style="margin-top: 20px; padding: 12px; background: #fffbea; border-left: 4px solid #ffc107; border-radius: 4px;">
        <strong style="color: #f57f17;">⚠️ Missing Activities</strong>
        <p style="margin: 8px 0; font-size: 14px; color: #333;">The following elements have no documented activities. Consider adding one:</p>
      `;
      
      for (const [element, suggs] of Object.entries(suggestions)) {
        contentHtml += `<div style="margin: 12px 0;">
          <strong style="color: #333;">${escapeHtml(element)}</strong>
          <ul style="margin: 6px 0; padding-left: 20px;">
        `;
        for (const sugg of suggs) {
          contentHtml += `<li style="margin: 6px 0; font-size: 14px;">
            <span>${escapeHtml(sugg)}</span>
            <button class="addSuggestionBtn secondary" style="margin-left: 8px; padding: 2px 8px; font-size: 12px;" data-suggestion="${escapeHtml(sugg)}" data-element="${escapeHtml(element)}">Add Activity</button>
          </li>`;
        }
        contentHtml += `</ul></div>`;
      }
      
      contentHtml += `</div>`;
    }
    
    content.innerHTML = contentHtml;
    details.appendChild(content);
    
    div.appendChild(details);
    list.appendChild(div);
    
    const deleteBtn = div.querySelector(".deleteReviewBtn");
    deleteBtn.addEventListener("click", async () => {
      if (!await confirmModal("Delete this review?")) return;
      try {
        await api(`/api/reviews/${r.id}`, { method: "DELETE" });
        showNotification("Review deleted.", "success");
        await refreshReviews();
      } catch (err) {
        showNotification(`Error deleting review: ${err.message}`, "error");
      }
    });
    
    // Wire up suggestion buttons
    const suggestionBtns = div.querySelectorAll(".addSuggestionBtn");
    for (const btn of suggestionBtns) {
      btn.addEventListener("click", () => {
        const suggestion = btn.dataset.suggestion;
        addSuggestedActivity(suggestion);
      });
    }
  }
  if (!reviews.length) list.innerHTML = "<div class='muted'>No saved reviews yet.</div>";
}

async function refreshRatings() {
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  const list = $("ratingsList");
  
  if (!empId || !planId) {
    list.innerHTML = "<div class='muted'>No final ratings yet.</div>";
    return;
  }

  const ratings = await api(`/api/ratings?employeeId=${encodeURIComponent(empId)}&planId=${encodeURIComponent(planId)}`);
  
  // Preserve placeholder if it exists
  const placeholder = list.querySelector("[data-placeholder]");
  list.innerHTML = "";
  if (placeholder) list.appendChild(placeholder);
  
  for (const r of ratings) {
    const div = document.createElement("div");
    div.className = "item";
    const ratingColor = r.overallRating >= 4 ? "#4caf50" : r.overallRating === 3 ? "#ffc107" : "#f44336";
    
    const details = document.createElement("details");
    details.style.marginBottom = "8px";
    
    const summary = document.createElement("summary");
    summary.style.cursor = "pointer";
    summary.style.fontWeight = "600";
    summary.style.padding = "10px";
    summary.style.borderRadius = "8px";
    summary.style.background = ratingColor;
    summary.style.color = "white";
    summary.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>Fiscal Year ${escapeHtml(r.fiscalYear)}: Rating ${r.overallRating}/5 (Score: ${r.totalScore})</span>
        <button class="delete-rating-btn" data-rating-id="${r.id}" style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 10px;" onclick="event.stopPropagation();">Delete</button>
      </div>
    `;
    details.appendChild(summary);
    
    const content = document.createElement("div");
    content.style.padding = "10px";
    let contentHtml = `<div class="muted" style="margin-bottom: 8px; font-size: 12px;">Created: ${new Date(r.createdAt).toLocaleString()}</div>`;
    
    contentHtml += `<div style="margin-bottom: 12px;"><strong>Element Ratings:</strong>`;
    for (const er of r.elementRatings) {
      contentHtml += `<div style="margin: 8px 0; padding: 8px; background: #f5f5f5; border-radius: 4px;">
        <strong>${escapeHtml(er.title)}</strong> - Rating: ${er.rating}/5 (Score: ${er.score})<br>
        <em style="font-size: 13px;">${escapeHtml(er.summary)}</em>
      </div>`;
    }
    contentHtml += `</div>`;
    
    if (r.narrativeSummary) {
      contentHtml += `<div style="margin-bottom: 12px; padding: 10px; background: #f0f8ff; border-left: 4px solid #2196f3; border-radius: 4px;">
        <strong style="color: #1976d2;">Summary Rating Narrative</strong>
        <div style="margin-top: 8px; font-family: Georgia, serif; line-height: 1.6; color: #333;">${markdownToHtml(r.narrativeSummary)}</div>
      </div>`;
    }
    
    contentHtml += `<div class="output" style="font-family: Georgia, serif; line-height: 1.6;">${markdownToHtml(r.outputMarkdown)}</div>`;
    
    content.innerHTML = contentHtml;
    details.appendChild(content);
    
    div.appendChild(details);
    list.appendChild(div);
  }
  
  if (!ratings.length) list.innerHTML = "<div class='muted'>No final ratings yet.</div>";
  
  // Add event listeners for delete buttons
  list.querySelectorAll(".delete-rating-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const ratingId = btn.getAttribute("data-rating-id");
      if (!confirmModal(`Delete this final rating? This cannot be undone.`)) return;
      try {
        await api(`/api/ratings/${ratingId}`, { method: "DELETE" });
        showNotification("Rating deleted.", "success");
        await refreshRatings();
      } catch (e) {
        showNotification(`Failed to delete rating: ${e}`, "error");
      }
    });
  });
}

async function reparseCurrentPlan() {
  const planId = selectedPlanId();
  if (!planId) {
    showNotification("Select a plan first.", "error");
    return;
  }

  try {
    showNotification("Re-parsing plan...", "info");
    const plan = await api(`/api/plans/${planId}/reparse`, { method: "POST" });
    showNotification("Plan re-parsed successfully.", "success");
    await refreshPlanElementsUI();
  } catch (e) {
    console.error("Error re-parsing plan:", e);
    showNotification(`Error re-parsing plan: ${e.message}`, "error");
  }
}

$("createEmp").addEventListener("click", async () => {
  const displayName = $("empName").value.trim();
  const email = $("empEmail").value.trim();
  if (!displayName) return showNotification("Enter a name.", "error");
  await api("/api/employees", { method: "POST", body: JSON.stringify({ displayName, email: email || undefined }) });
  $("empName").value = "";
  $("empEmail").value = "";
  showNotification("Employee added.", "success");
  await refreshEmployees();
  await refreshPlans();
});

$("refreshEmp").addEventListener("click", refreshEmployees);
$("refreshPlans").addEventListener("click", refreshPlans);
$("reparseplan").addEventListener("click", reparseCurrentPlan);
$("refreshActivities").addEventListener("click", refreshActivities);
$("refreshReviews").addEventListener("click", refreshReviews);

$("employeeSelect").addEventListener("change", async () => {
  await refreshPlans();
  // Wait a tick to ensure plan selection is reflected in DOM, then trigger plan change
  await new Promise(resolve => setTimeout(resolve, 0));
  $("planSelect").dispatchEvent(new Event("change"));
});

$("planSelect").addEventListener("change", async () => {
  await refreshPlanElementsUI();
  await addDeletePlanButton();
  await refreshActivities();
  await refreshReviews();
  await refreshRatings();
});

$("uploadPlan").addEventListener("click", async () => {
  const empId = selectedEmployeeId();
  const file = $("planPdf").files?.[0];
  if (!empId) return showNotification("Select an employee first.", "error");
  if (!file) return showNotification("Choose a PDF first.", "error");

  const form = new FormData();
  form.append("employeeId", empId);
  form.append("pdf", file);

  const res = await fetch("/api/plans/upload", { method: "POST", body: form });
  if (!res.ok) return showNotification(await res.text(), "error");

  showNotification("Plan uploaded.", "success");
  await refreshPlans();
  $("planPdf").value = "";
});

$("addActivities").addEventListener("click", async () => {
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  const month = $("activityMonth").value;
  if (!empId || !planId) return showNotification("Select employee and plan.", "error");
  if (!month) return showNotification("Pick a month.", "error");

  const content = $("activitiesInput").value.trim();
  if (!content) return showNotification("Enter activity notes.", "error");

  try {
    await api("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        employeeId: empId,
        planId,
        month,
        content
      })
    });
    showNotification("Activities saved.", "success");
    $("activitiesInput").value = "";
    await refreshActivities();
  } catch (e) {
    console.error(`Failed to save activities:`, e);
    showNotification(`Failed to save activities: ${e}`, "error");
  }
});

$("generateReview").addEventListener("click", async () => {
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  const periodStart = $("periodStart").value;
  const periodEnd = $("periodEnd").value;
  const guidance = $("guidance").value.trim();
  if (!empId || !planId) return showNotification("Select employee and plan.", "error");
  if (!periodStart || !periodEnd) return showNotification("Pick a start and end date.", "error");

  const btn = $("generateReview");
  btn.disabled = true;
  
  // Add placeholder generating review
  const list = $("reviewsList");
  const placeholder = document.createElement("div");
  placeholder.className = "item";
  placeholder.setAttribute("data-placeholder", "true");
  placeholder.style.background = "#fffde7";
  placeholder.style.borderLeft = "4px solid #fbc02d";
  placeholder.innerHTML = `
    <div style="padding: 10px; display: flex; align-items: center; gap: 10px;">
      <span style="font-weight: 600;">⏳ Generating Review</span>
      <span style="font-size: 12px; color: #666;">${escapeHtml(periodStart)} → ${escapeHtml(periodEnd)}</span>
    </div>
  `;
  list.insertBefore(placeholder, list.firstChild);

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
        guidance: guidance || undefined,
        provider: $("aiProvider").value,
        model: $("aiModel").value
      })
    });
    
    if (review.promptMeta?.truncated) {
      showNotification("⚠️ Prompt was truncated due to length. Some data may have been excluded.", "error");
    } else {
      showNotification("Review generated and saved.", "success");
    }
    
    placeholder.remove();
    await refreshReviews();
  } catch (e) {
    const isTimeout = e.name === "AbortError";
    if (isTimeout) {
      showNotification("⏱️ Review generation is taking longer than expected. It may still be processing. Refreshing to check...", "warning");
      // Wait a few seconds then try refreshing
      await new Promise(resolve => setTimeout(resolve, 3000));
      await refreshReviews();
      if (placeholder && placeholder.parentNode) placeholder.remove();
    } else {
      showNotification(`Failed to generate review: ${e}`, "error");
      placeholder.remove();
    }
  } finally {
    btn.disabled = false;
  }
});

function populateMonthSelector() {
  const sel = $("activityMonth");
  sel.innerHTML = "";
  
  for (let i = 0; i < 12; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const display = `${month}/${String(year).slice(-2)}`;
    const value = `${year}-${month}`;
    
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = display;
    sel.appendChild(opt);
  }
}

$("generateRating").addEventListener("click", async () => {
  const empId = selectedEmployeeId();
  const planId = selectedPlanId();
  if (!empId || !planId) return showNotification("Select employee and plan.", "error");

  const targetRating = parseInt($("targetRating").value, 10);
  const btn = $("generateRating");
  btn.disabled = true;

  // Add placeholder generating rating
  const list = $("ratingsList");
  const placeholder = document.createElement("div");
  placeholder.className = "item";
  placeholder.setAttribute("data-placeholder", "true");
  placeholder.style.background = "#fffde7";
  placeholder.style.borderLeft = "4px solid #fbc02d";
  placeholder.innerHTML = `
    <div style="padding: 10px; display: flex; align-items: center; gap: 10px;">
      <span style="font-weight: 600;">⏳ Generating Final Rating</span>
      <span style="font-size: 12px; color: #666;">Target: Level ${targetRating}</span>
    </div>
  `;
  list.insertBefore(placeholder, list.firstChild);

  try {
    const rating = await api("/api/ratings/generate", {
      method: "POST",
      body: JSON.stringify({
        employeeId: empId,
        planId,
        targetRating,
        provider: $("aiProvider").value,
        model: $("aiModel").value
      }),
      timeout: 300000 // 5 minute timeout for rating generation
    });

    showNotification("Final rating generated and saved.", "success");
    placeholder.remove();
    await refreshRatings();
  } catch (e) {
    const isTimeout = e.name === "AbortError";
    if (isTimeout) {
      showNotification("⏱️ Rating generation is taking longer than expected. It may still be processing. Refreshing to check...", "warning");
      // Wait a few seconds then try refreshing
      await new Promise(resolve => setTimeout(resolve, 3000));
      await refreshRatings();
      if (placeholder && placeholder.parentNode) placeholder.remove();
    } else {
      showNotification(`Failed to generate rating: ${e}`, "error");
      placeholder.remove();
    }
  } finally {
    btn.disabled = false;
  }
});

$("refreshRatings").addEventListener("click", refreshRatings);

// Initial load
(async function init() {
  populateMonthSelector();
  await refreshAIProviders();
  await refreshEmployees();
  await refreshPlans();
  await refreshActivities();
  await refreshReviews();
  await refreshRatings();

  // Set defaults for period (last 90 days)
  const end = new Date();
  const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  $("periodEnd").value = end.toISOString().slice(0,10);
  $("periodStart").value = start.toISOString().slice(0,10);
})();
