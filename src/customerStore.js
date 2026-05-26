(function () {
  "use strict";

  const config = window.CrmImportRescueConfig || {};
  const localSessionKey = "crm-import-rescue-portal-session";
  const localRunsKey = "crm-import-rescue-workflow-runs";
  const localChangesKey = "crm-import-rescue-change-requests";
  let supabaseClientPromise = null;

  function createStore() {
    const mode = isSupabaseConfigured() ? "supabase" : "local";

    async function signIn(email) {
      const normalizedEmail = String(email || "")
        .trim()
        .toLowerCase();
      if (!normalizedEmail) {
        throw new Error("Enter an email address first.");
      }

      if (mode === "supabase") {
        const supabaseClient = await getSupabaseClient();
        const { error } = await supabaseClient.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            emailRedirectTo: window.location.href.split("#")[0],
          },
        });
        if (error) {
          throw new Error(error.message);
        }
        return { mode, message: "Magic link sent. Check your inbox." };
      }

      const session = {
        user: {
          id: "local-demo-user",
          email: normalizedEmail,
        },
      };
      localStorage.setItem(localSessionKey, JSON.stringify(session));
      return { mode, message: "Local demo session started." };
    }

    async function signOut() {
      if (mode === "supabase") {
        const supabaseClient = await getSupabaseClient();
        await supabaseClient.auth.signOut();
      }
      localStorage.removeItem(localSessionKey);
    }

    async function getSession() {
      if (mode === "supabase") {
        const supabaseClient = await getSupabaseClient();
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) {
          throw new Error(error.message);
        }
        return data.session;
      }

      return readJson(localSessionKey, null);
    }

    async function loadDashboard() {
      const session = await getSession();
      if (!session) {
        return emptyDashboard();
      }

      if (mode === "supabase") {
        const supabaseClient = await getSupabaseClient();
        return loadSupabaseDashboard(supabaseClient);
      }

      return loadLocalDashboard(session);
    }

    async function recordRun(summary) {
      const payload = sanitizeRunSummary(summary);
      const session = await getSession();
      if (!session) {
        throw new Error("Sign in before saving run metadata.");
      }

      if (mode === "supabase") {
        const supabaseClient = await getSupabaseClient();
        const { error } = await supabaseClient.from("workflow_runs").insert({
          workflow_contract_id: payload.workflowContractId,
          workflow_name: payload.workflowName,
          workflow_version: payload.workflowVersion,
          run_status: payload.workflowStatus,
          file_name: payload.fileName,
          row_count: payload.rowCount,
          column_count: payload.columnCount,
          column_names: payload.columnNames,
          missing_expected_columns: payload.missingExpectedColumns,
          missing_required_columns: payload.missingRequiredColumns,
          extra_columns: payload.extraColumns,
          issue_counts: payload.issueCounts,
          created_at: payload.createdAt,
        });
        if (error) {
          throw new Error(error.message);
        }
        return { mode, message: "Run metadata saved to the customer portal." };
      }

      const runs = readJson(localRunsKey, []);
      runs.unshift({
        id: cryptoRandomId(),
        owner_email: session.user.email,
        ...payload,
      });
      localStorage.setItem(localRunsKey, JSON.stringify(runs.slice(0, 100)));
      return { mode, message: "Run metadata saved to the local demo portal." };
    }

    async function createChangeRequest(input) {
      const session = await getSession();
      if (!session) {
        throw new Error("Sign in before creating a change request.");
      }
      const payload = {
        workflow_contract_id: String(input.workflowContractId || "").trim(),
        title: String(input.title || "").trim(),
        notes: String(input.notes || "").trim(),
        status: "requested",
        created_at: new Date().toISOString(),
      };
      if (!payload.title) {
        throw new Error("Change request needs a title.");
      }

      if (mode === "supabase") {
        const supabaseClient = await getSupabaseClient();
        const { error } = await supabaseClient.from("change_requests").insert(payload);
        if (error) {
          throw new Error(error.message);
        }
        return { mode, message: "Change request saved." };
      }

      const requests = readJson(localChangesKey, []);
      requests.unshift({
        id: cryptoRandomId(),
        owner_email: session.user.email,
        ...payload,
      });
      localStorage.setItem(localChangesKey, JSON.stringify(requests.slice(0, 100)));
      return { mode, message: "Change request saved in local demo mode." };
    }

    return {
      mode,
      isConfigured: mode === "supabase",
      signIn,
      signOut,
      getSession,
      loadDashboard,
      recordRun,
      createChangeRequest,
    };
  }

  function isSupabaseConfigured() {
    return Boolean(config.supabaseUrl && config.supabaseAnonKey);
  }

  async function getSupabaseClient() {
    if (!isSupabaseConfigured()) {
      return null;
    }
    if (!supabaseClientPromise) {
      supabaseClientPromise = loadSupabaseClient();
    }
    return supabaseClientPromise;
  }

  async function loadSupabaseClient() {
    if (!window.supabase) {
      await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    }
    if (!window.supabase) {
      throw new Error("Supabase client could not be loaded.");
    }
    return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("Could not load Supabase.")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        reject(new Error("Supabase client load timed out."));
      }, 8000);
      script.src = src;
      script.onload = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Could not load Supabase."));
      };
      document.head.appendChild(script);
    });
  }

  async function loadSupabaseDashboard(client) {
    const [workflowResult, runResult, requestResult] = await Promise.all([
      client
        .from("workflows")
        .select(
          "id,workflow_contract_id,workflow_name,version,crm_target,source_format,status,included_fixes_until,created_at",
        )
        .order("created_at", { ascending: false }),
      client
        .from("workflow_runs")
        .select(
          "id,workflow_contract_id,workflow_name,workflow_version,run_status,file_name,row_count,column_count,column_names,missing_expected_columns,missing_required_columns,extra_columns,issue_counts,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(25),
      client
        .from("change_requests")
        .select("id,workflow_contract_id,title,notes,status,created_at")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    for (const result of [workflowResult, runResult, requestResult]) {
      if (result.error) {
        throw new Error(result.error.message);
      }
    }

    return {
      workflows: workflowResult.data || [],
      runs: runResult.data || [],
      changeRequests: requestResult.data || [],
    };
  }

  function loadLocalDashboard(session) {
    const runs = readJson(localRunsKey, []).filter((run) => run.owner_email === session.user.email);
    const changeRequests = readJson(localChangesKey, []).filter(
      (request) => request.owner_email === session.user.email,
    );
    const workflowMap = new Map();
    for (const run of runs) {
      if (!run.workflowContractId) {
        continue;
      }
      workflowMap.set(run.workflowContractId, {
        id: run.workflowContractId,
        workflow_contract_id: run.workflowContractId,
        workflow_name: run.workflowName,
        version: run.workflowVersion,
        crm_target: run.crmTarget,
        source_format: run.sourceFormat,
        status: "active",
        included_fixes_until: "",
        created_at: run.createdAt,
      });
    }

    if (!workflowMap.size) {
      workflowMap.set("sample-webinar-leads-hubspot", {
        id: "sample-webinar-leads-hubspot",
        workflow_contract_id: "sample-webinar-leads-hubspot",
        workflow_name: "Sample Webinar Leads to HubSpot",
        version: "1.0.0",
        crm_target: "HubSpot contacts",
        source_format: "Monthly Webinar Export",
        status: "demo",
        included_fixes_until: "2026-06-09",
        created_at: new Date().toISOString(),
      });
    }

    return {
      workflows: Array.from(workflowMap.values()),
      runs,
      changeRequests,
    };
  }

  function emptyDashboard() {
    return {
      workflows: [],
      runs: [],
      changeRequests: [],
    };
  }

  function sanitizeRunSummary(summary) {
    const input = summary || {};
    return {
      fileName: String(input.fileName || "data.csv").slice(0, 160),
      createdAt: input.createdAt || new Date().toISOString(),
      workflowContractId: String(input.workflowContractId || "").slice(0, 120),
      workflowName: String(input.workflowName || "").slice(0, 180),
      workflowVersion: String(input.workflowVersion || "").slice(0, 40),
      workflowStatus: String(input.workflowStatus || "unscoped").slice(0, 40),
      crmTarget: String(input.crmTarget || "").slice(0, 120),
      sourceFormat: String(input.sourceFormat || "").slice(0, 160),
      rowCount: Number(input.rowCount) || 0,
      columnCount: Number(input.columnCount) || 0,
      columnNames: safeStringArray(input.columnNames),
      missingExpectedColumns: safeStringArray(input.missingExpectedColumns),
      missingRequiredColumns: safeStringArray(input.missingRequiredColumns),
      extraColumns: safeStringArray(input.extraColumns),
      issueCounts: input.issueCounts || {},
    };
  }

  function safeStringArray(value) {
    return Array.isArray(value)
      ? value.map((item) => String(item).slice(0, 160)).slice(0, 200)
      : [];
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function cryptoRandomId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.CrmCustomerStore = {
    createStore,
  };
})();
