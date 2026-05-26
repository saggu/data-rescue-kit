(function () {
  "use strict";

  const store = window.CrmCustomerStore.createStore();
  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    [
      "authPanel",
      "authForm",
      "portalEmail",
      "authStatus",
      "portalMode",
      "portalWorkspace",
      "sessionEmail",
      "signOutButton",
      "workflowCount",
      "runCount",
      "changeCount",
      "workflowRows",
      "runRows",
      "changeForm",
      "changeWorkflowId",
      "changeTitle",
      "changeNotes",
      "changeStatus",
      "changeRows",
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });

    els.portalMode.textContent = store.isConfigured ? "Supabase" : "Local demo";
    els.authForm.addEventListener("submit", handleSignIn);
    els.signOutButton.addEventListener("click", handleSignOut);
    els.changeForm.addEventListener("submit", handleChangeRequest);
    await refresh();
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setStatus(els.authStatus, "Signing in...");
    try {
      const result = await store.signIn(els.portalEmail.value);
      setStatus(els.authStatus, result.message, "success");
      await refresh();
    } catch (error) {
      setStatus(els.authStatus, error.message, "error");
    }
  }

  async function handleSignOut() {
    await store.signOut();
    await refresh();
  }

  async function handleChangeRequest(event) {
    event.preventDefault();
    setStatus(els.changeStatus, "Saving request...");
    try {
      const result = await store.createChangeRequest({
        workflowContractId: els.changeWorkflowId.value,
        title: els.changeTitle.value,
        notes: els.changeNotes.value,
      });
      els.changeForm.reset();
      setStatus(els.changeStatus, result.message, "success");
      await refresh();
    } catch (error) {
      setStatus(els.changeStatus, error.message, "error");
    }
  }

  async function refresh() {
    try {
      const session = await store.getSession();
      const signedIn = Boolean(session);
      els.authPanel.hidden = signedIn;
      els.portalWorkspace.hidden = !signedIn;
      if (!signedIn) {
        return;
      }

      els.sessionEmail.textContent = session.user.email;
      const dashboard = await store.loadDashboard();
      renderDashboard(dashboard);
    } catch (error) {
      setStatus(els.authStatus, error.message, "error");
    }
  }

  function renderDashboard(dashboard) {
    els.workflowCount.textContent = number(dashboard.workflows.length);
    els.runCount.textContent = number(dashboard.runs.length);
    els.changeCount.textContent = number(
      dashboard.changeRequests.filter((request) => request.status !== "done").length,
    );
    renderWorkflows(dashboard.workflows);
    renderRuns(dashboard.runs);
    renderChangeRequests(dashboard.changeRequests);
  }

  function renderWorkflows(workflows) {
    if (!workflows.length) {
      els.workflowRows.innerHTML = emptyRow("No workflow contracts yet.", 5);
      return;
    }

    els.workflowRows.innerHTML = workflows
      .map(
        (workflow) => `<tr>
          <td><strong>${escapeHtml(workflow.workflow_name || workflow.workflowName)}</strong><span>${escapeHtml(workflow.workflow_contract_id || workflow.workflowContractId || "")}</span></td>
          <td>${escapeHtml(workflow.version || "")}</td>
          <td>${escapeHtml(workflow.crm_target || workflow.crmTarget || "")}</td>
          <td>${escapeHtml(workflow.status || "active")}</td>
          <td>${escapeHtml(workflow.included_fixes_until || "not set")}</td>
        </tr>`,
      )
      .join("");
  }

  function renderRuns(runs) {
    if (!runs.length) {
      els.runRows.innerHTML = emptyRow("No saved run metadata yet.", 5);
      return;
    }

    els.runRows.innerHTML = runs
      .map((run) => {
        const extra = run.extra_columns || run.extraColumns || [];
        const missing = run.missing_required_columns || run.missingRequiredColumns || [];
        const schema = [
          missing.length ? `${missing.length} missing required` : "",
          extra.length ? `${extra.length} extra` : "",
        ]
          .filter(Boolean)
          .join(", ");

        return `<tr>
          <td>${escapeHtml(formatDate(run.created_at || run.createdAt))}</td>
          <td><strong>${escapeHtml(run.workflow_name || run.workflowName || "Unscoped")}</strong><span>${escapeHtml(run.file_name || run.fileName || "")}</span></td>
          <td>${escapeHtml(run.run_status || run.workflowStatus || "")}</td>
          <td>${number(run.row_count || run.rowCount)}</td>
          <td>${escapeHtml(schema || "none")}</td>
        </tr>`;
      })
      .join("");
  }

  function renderChangeRequests(requests) {
    if (!requests.length) {
      els.changeRows.innerHTML = emptyRow("No change requests yet.", 4);
      return;
    }

    els.changeRows.innerHTML = requests
      .map(
        (request) => `<tr>
          <td>${escapeHtml(formatDate(request.created_at || request.createdAt))}</td>
          <td>${escapeHtml(request.workflow_contract_id || request.workflowContractId || "")}</td>
          <td><strong>${escapeHtml(request.title)}</strong><span>${escapeHtml(request.notes || "")}</span></td>
          <td>${escapeHtml(request.status || "requested")}</td>
        </tr>`,
      )
      .join("");
  }

  function emptyRow(message, columns) {
    return `<tr><td colspan="${columns}"><span class="quiet">${escapeHtml(message)}</span></td></tr>`;
  }

  function setStatus(element, message, tone = "neutral") {
    element.textContent = message;
    element.dataset.tone = tone;
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function number(value) {
    return new Intl.NumberFormat("en-US").format(Number(value) || 0);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
