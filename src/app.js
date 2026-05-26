(function () {
  "use strict";

  const SAMPLE_DATA = `Contact ID,Full Name,Work Email,Mobile Phone,Company Name,Job Title,Lead Source,CRM Status,Sales Owner,Last Contacted,City,State,Country,Notes
001,Jordan Lee,JORDAN@ACME.COM,310.555.0199,"Acme, Inc.",VP Operations,Webinar,new,Amanda,1/5/26," Los Angeles ",CA,USA,"Asked for HubSpot import help"
002,Jordan K Lee,jordan@acme.com,+1 310 555 0199,Acme Inc,VP Ops,webinar,New,Amanda,2026-01-05,Los Angeles,CA,United States,"Possible duplicate from trade show list"
003,Priya Shah,priya@northstar.io,(424) 555-0110,North Star LLC,Founder,Referral,Qualified,Sam,05/10/2026,Marina del Rey,CA,USA,
004,Priya S.,PRIYA@NORTHSTAR.IO,4245550110,northstar llc,CEO,referral,qualified,Sam,"May 10 2026",Marina del Rey,CA,USA,"same account?"
005,Mateo Garcia,mgarcia@betabakery.com,555-0191,Beta Bakery,Owner,Walk-in,,Lee,3/2/26,Playa del Rey,CA,USA,
005,Mateo Garcia,mgarcia@betabakery.com,555-0191,Beta Bakery,Owner,Walk-in,,Lee,3/2/26,Playa del Rey,CA,USA,
006,Avery Chen,avery@westsideclinic.com,13105550112,Westside Clinic,Practice Manager,Partner,Open,Amanda,2026-02-20,Santa Monica,CA,USA,
007,Avery Chen,avery@westsideclinic,310-555-0112,West Side Clinic,Manager,Partner,Open,Amanda,2/20/2026,Santa Monica,CA,USA,"bad email from old CSV"
008,No Email,,3105550122,Ocean View Realty,Broker,Import,Cold,,null,Venice,CA,USA,
009,Taylor Brooks,Info@OceanView.example,,Oceanview Realty,Agent,Import,cold,,,"Venice ",CA,USA,
010,Riley Patel,team@harborfit.com,(310) 555-0124,Harbor Fitness,GM,Event,Nurture,Lee,2026-04-01,Marina del Rey,CA,USA,`;

  const state = {
    table: null,
    analysis: null,
    cleaned: null,
    exported: null,
    crm: null,
    preset: "hubspot",
    fileName: "sample-crm-contacts.csv",
    activePreview: "clean",
  };

  const rescue = window.DataRescue;
  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    [
      "dropZone",
      "fileInput",
      "loadSample",
      "downloadCsv",
      "downloadReport",
      "copyReport",
      "statusLine",
      "metricRows",
      "metricColumns",
      "metricScore",
      "metricCrmScore",
      "issueList",
      "columnProfile",
      "duplicatePanel",
      "crmReadiness",
      "fieldMapping",
      "previewTable",
      "previewTitle",
      "delimiterBadge",
      "changeList",
      "emptyState",
      "workspace",
      "rawTab",
      "cleanTab",
      "outreachCopy",
      "presetSelect",
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });

    document.querySelectorAll("[data-option]").forEach((input) => {
      input.addEventListener("change", rerunClean);
    });

    els.fileInput.addEventListener("change", handleFileInput);
    els.loadSample.addEventListener("click", () =>
      analyzeText(SAMPLE_DATA, "sample-crm-contacts.csv"),
    );
    els.downloadCsv.addEventListener("click", downloadCleanCsv);
    els.downloadReport.addEventListener("click", downloadReport);
    els.copyReport.addEventListener("click", copyReport);
    els.rawTab.addEventListener("click", () => setPreview("raw"));
    els.cleanTab.addEventListener("click", () => setPreview("clean"));
    els.outreachCopy.addEventListener("click", copyOutreach);
    els.presetSelect.addEventListener("change", () => {
      state.preset = els.presetSelect.value;
      rerunClean();
    });

    els.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      els.dropZone.classList.add("is-dragging");
    });
    els.dropZone.addEventListener("dragleave", () => {
      els.dropZone.classList.remove("is-dragging");
    });
    els.dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("is-dragging");
      const file = event.dataTransfer.files[0];
      if (file) {
        readFile(file);
      }
    });

    analyzeText(SAMPLE_DATA, "sample-crm-contacts.csv");
  }

  function handleFileInput(event) {
    const file = event.target.files[0];
    if (file) {
      readFile(file);
    }
  }

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => analyzeText(String(reader.result || ""), file.name);
    reader.onerror = () => setStatus("Could not read that file.", true);
    reader.readAsText(file);
  }

  function analyzeText(text, fileName) {
    if (!text.trim()) {
      setStatus("The file is empty.", true);
      return;
    }
    try {
      const table = rescue.parseDelimited(text);
      const analysis = rescue.analyzeTable(table);
      const cleaned = rescue.cleanTable(table, analysis, collectOptions());
      const exported = rescue.applyCrmPreset(cleaned, state.preset);
      const crm = rescue.analyzeCrmReadiness(exported, state.preset);
      state.table = table;
      state.analysis = analysis;
      state.cleaned = cleaned;
      state.exported = exported;
      state.crm = crm;
      state.fileName = fileName || "data.csv";
      setStatus(`${state.fileName} mapped for ${exported.presetLabel}.`);
      render();
    } catch (error) {
      setStatus(error.message || "The file could not be analyzed.", true);
    }
  }

  function collectOptions() {
    const options = {};
    document.querySelectorAll("[data-option]").forEach((input) => {
      options[input.dataset.option] = input.checked;
    });
    return options;
  }

  function rerunClean() {
    if (!state.table || !state.analysis) {
      return;
    }
    state.cleaned = rescue.cleanTable(state.table, state.analysis, collectOptions());
    state.exported = rescue.applyCrmPreset(state.cleaned, state.preset);
    state.crm = rescue.analyzeCrmReadiness(state.exported, state.preset);
    render();
  }

  function render() {
    if (!state.table) {
      els.emptyState.hidden = false;
      els.workspace.hidden = true;
      return;
    }

    els.emptyState.hidden = true;
    els.workspace.hidden = false;
    const analysis = state.analysis;
    els.metricRows.textContent = number(analysis.rowCount);
    els.metricColumns.textContent = number(analysis.columnCount);
    els.metricScore.textContent = `${analysis.qualityScore}/100`;
    els.metricCrmScore.textContent = `${state.crm.score}/100`;
    els.delimiterBadge.textContent = delimiterName(state.table.delimiter);

    renderIssues(analysis.issues);
    renderCrmReadiness(state.crm);
    renderFieldMapping(state.exported);
    renderColumnProfile(analysis.columns);
    renderDuplicates(analysis);
    renderChanges(state.cleaned.changes);
    renderPreview();
    updateButtons();
  }

  function renderIssues(issues) {
    if (!issues.length) {
      els.issueList.innerHTML = '<li class="quiet">No priority issues found.</li>';
      return;
    }
    els.issueList.innerHTML = issues
      .slice(0, 8)
      .map((issue) => {
        return `<li><span class="severity ${issue.severity}">${issue.severity}</span>${escapeHtml(issue.message)}</li>`;
      })
      .join("");
  }

  function renderColumnProfile(columns) {
    els.columnProfile.innerHTML = columns
      .map((column) => {
        const missing = pct(column.missingRate);
        const notes = [];
        if (column.whitespaceCount) {
          notes.push(`${column.whitespaceCount} padded`);
        }
        if (column.casingIssues) {
          notes.push(`${column.casingIssues} casing`);
        }
        if (column.inferredType === "mixed") {
          notes.push("mixed formats");
        }
        return `<tr>
        <td><strong>${escapeHtml(column.header)}</strong><span>${escapeHtml(column.normalizedHeader)}</span></td>
        <td>${escapeHtml(column.inferredType)}</td>
        <td>${missing}</td>
        <td>${number(column.uniqueCount)}</td>
        <td>${notes.length ? escapeHtml(notes.join(", ")) : '<span class="quiet">ok</span>'}</td>
      </tr>`;
      })
      .join("");
  }

  function renderCrmReadiness(crm) {
    const blockers = crm.issues.length
      ? crm.issues
          .map(
            (issue) =>
              `<li><span class="severity ${issue.severity}">${issue.severity}</span>${escapeHtml(issue.message)}</li>`,
          )
          .join("")
      : '<li class="quiet">No import blockers found for this CRM target.</li>';

    const duplicateRows =
      crm.duplicateEmailGroups
        .map((group) => group.map((item) => item.row).join(", "))
        .join("; ") || "none";

    els.crmReadiness.innerHTML = `
      <div class="crm-score">
        <span>${escapeHtml(crm.presetLabel)}</span>
        <strong>${crm.score}/100</strong>
      </div>
      <ul class="issue-list">${blockers}</ul>
      <div class="crm-facts">
        <span>Invalid emails: <strong>${number(crm.invalidEmails.length)}</strong></span>
        <span>Invalid phones: <strong>${number(crm.invalidPhones.length)}</strong></span>
        <span>Duplicate email rows: <strong>${escapeHtml(duplicateRows)}</strong></span>
      </div>`;
  }

  function renderFieldMapping(exported) {
    els.fieldMapping.innerHTML = exported.mapping
      .map((item) => {
        const source = item.derivedFrom.length
          ? `derived from ${item.derivedFrom.join(" + ")}`
          : item.source || "not mapped";
        return `<tr>
        <td><strong>${escapeHtml(item.target)}</strong></td>
        <td>${escapeHtml(source)}</td>
        <td>${item.required ? "yes" : "no"}</td>
      </tr>`;
      })
      .join("");
  }

  function renderDuplicates(analysis) {
    const exact = analysis.duplicates.duplicateGroups.slice(0, 5);
    const fuzzy = analysis.fuzzyMatches.groups.slice(0, 6);
    const exactHtml = exact.length
      ? exact.map((group) => `<li>Rows ${group.join(", ")}</li>`).join("")
      : '<li class="quiet">No exact duplicate rows.</li>';
    const fuzzyHtml = fuzzy.length
      ? fuzzy
          .map((group) => {
            return `<li><strong>${escapeHtml(group.column)}</strong>: rows ${group.rows.join(" and ")} (${Math.round(group.score * 100)}%)<span>${escapeHtml(group.values.join(" / "))}</span></li>`;
          })
          .join("")
      : '<li class="quiet">No fuzzy duplicate candidates in the scanned rows.</li>';

    els.duplicatePanel.innerHTML = `
      <div>
        <h3>Exact duplicates</h3>
        <ul class="compact-list">${exactHtml}</ul>
      </div>
      <div>
        <h3>Fuzzy candidates</h3>
        <ul class="compact-list">${fuzzyHtml}</ul>
      </div>`;
  }

  function renderChanges(changes) {
    els.changeList.innerHTML = Object.entries(changes)
      .map(([key, value]) => {
        return `<li><span>${escapeHtml(labelize(key))}</span><strong>${number(value)}</strong></li>`;
      })
      .join("");
  }

  function renderPreview() {
    const table =
      state.activePreview === "raw"
        ? state.table
        : { headers: state.exported.headers, rows: state.exported.rows };
    const title =
      state.activePreview === "raw"
        ? "Raw preview"
        : `${state.exported.presetLabel} import preview`;
    els.previewTitle.textContent = title;
    els.rawTab.classList.toggle("is-active", state.activePreview === "raw");
    els.cleanTab.classList.toggle("is-active", state.activePreview === "clean");
    els.previewTable.innerHTML = buildTableHtml(table.headers, table.rows.slice(0, 16));
  }

  function buildTableHtml(headers, rows) {
    const head = `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`;
    const body = rows
      .map((row) => {
        return `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] || "")}</td>`).join("")}</tr>`;
      })
      .join("");
    return `${head}<tbody>${body}</tbody>`;
  }

  function setPreview(mode) {
    state.activePreview = mode;
    renderPreview();
  }

  function updateButtons() {
    const hasOutput = Boolean(state.cleaned);
    els.downloadCsv.disabled = !hasOutput;
    els.downloadReport.disabled = !hasOutput;
    els.copyReport.disabled = !hasOutput;
  }

  function downloadCleanCsv() {
    if (!state.cleaned) {
      return;
    }
    const csv = rescue.toDelimited(state.exported.headers, state.exported.rows, ",");
    const base = state.fileName.replace(/\.[^.]+$/, "") || "data";
    downloadBlob(csv, `${base}-${state.preset}-import.csv`, "text/csv;charset=utf-8");
  }

  function downloadReport() {
    if (!state.cleaned) {
      return;
    }
    const report = rescue.buildMarkdownReport(state.table, state.analysis, state.cleaned, {
      exported: state.exported,
      crm: state.crm,
    });
    const base = state.fileName.replace(/\.[^.]+$/, "") || "data";
    downloadBlob(report, `${base}-crm-import-report.md`, "text/markdown;charset=utf-8");
  }

  async function copyReport() {
    if (!state.cleaned) {
      return;
    }
    const report = rescue.buildMarkdownReport(state.table, state.analysis, state.cleaned, {
      exported: state.exported,
      crm: state.crm,
    });
    await copyText(report);
    setStatus("Report copied.");
  }

  async function copyOutreach() {
    const text = `Quick question: do you have a HubSpot, Salesforce, or Airtable import coming up with messy contacts?

I clean contact CSVs before CRM import: duplicate people/companies, bad emails, inconsistent phone numbers, unmapped fields, missing required columns, and repeatable cleanup scripts.

Fixed-scope CRM import rescue starts at $500. If you send a sample export, I can tell you what will break before you upload it.`;
    await copyText(text);
    setStatus("Outreach script copied.");
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  function downloadBlob(content, fileName, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function setStatus(message, isError) {
    els.statusLine.textContent = message;
    els.statusLine.classList.toggle("is-error", Boolean(isError));
  }

  function delimiterName(delimiter) {
    if (delimiter === "\t") {
      return "tab";
    }
    if (delimiter === ",") {
      return "comma";
    }
    if (delimiter === ";") {
      return "semicolon";
    }
    return delimiter || "auto";
  }

  function pct(value) {
    return `${Math.round(value * 100)}%`;
  }

  function number(value) {
    return new Intl.NumberFormat("en-US").format(value || 0);
  }

  function labelize(key) {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
