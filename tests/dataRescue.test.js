const assert = require("node:assert/strict");
const rescue = require("../src/dataRescue");

const input = `Full Name,Work Email,Mobile Phone,Company Name,Signup Date,Spend
"Jordan Lee",JORDAN@ACME.COM,310.555.0199,"Acme, Inc.",1/5/26,"$1,200.00"
Jordan K Lee,jordan@acme.com,+1 310 555 0199,Acme Inc,2026-01-05,1200
Beta Bakery,hello@beta.example,555-0191,Beta Bakery,n/a,$89
Beta Bakery,hello@beta.example,555-0191,Beta Bakery,n/a,$89`;

const table = rescue.parseDelimited(input);
assert.equal(table.headers.length, 6);
assert.equal(table.rows.length, 4);
assert.equal(table.rows[0][0], "Jordan Lee");

const analysis = rescue.analyzeTable(table);
assert.equal(analysis.rowCount, 4);
assert.equal(analysis.duplicates.duplicateRowCount, 1);
assert.ok(analysis.issues.length > 0);

const cleaned = rescue.cleanTable(table, analysis);
assert.deepEqual(cleaned.headers, [
  "full_name",
  "work_email",
  "mobile_phone",
  "company_name",
  "signup_date",
  "spend",
]);
assert.equal(cleaned.rows.length, 3);
assert.equal(cleaned.rows[0][1], "jordan@acme.com");
assert.equal(cleaned.rows[0][2], "(310) 555-0199");
assert.equal(cleaned.rows[0][4], "2026-01-05");
assert.equal(cleaned.rows[0][5], "1200.00");

const exported = rescue.applyCrmPreset(cleaned, "hubspot");
assert.deepEqual(exported.headers.slice(0, 4), ["email", "firstname", "lastname", "phone"]);
assert.equal(exported.rows[0][1], "Jordan");
assert.equal(exported.rows[0][2], "Lee");
assert.equal(exported.rows[0][3], "(310) 555-0199");

const crm = rescue.analyzeCrmReadiness(exported, "hubspot");
assert.equal(crm.presetLabel, "HubSpot contacts");
assert.ok(crm.score > 0);

const workflowConfig = {
  workflowId: "monthly-webinar-hubspot",
  workflowName: "Monthly Webinar Leads to HubSpot",
  version: "1.0.0",
  sourceFormat: "Monthly webinar export",
  crmPreset: "hubspot",
  crmTarget: "HubSpot contacts",
  includedFixesUntil: "2026-06-15",
  expectedColumns: [
    "Full Name",
    "Work Email",
    "Mobile Phone",
    "Company Name",
    "Signup Date",
    "Spend",
  ],
  requiredColumns: ["Work Email", "Company Name"],
  rules: {
    normalizeHeaders: true,
    trimCells: true,
    lowerEmail: true,
    dropDuplicateRows: true,
  },
};

const normalizedWorkflow = rescue.normalizeWorkflowConfig(workflowConfig);
assert.equal(normalizedWorkflow.valid, true);
assert.equal(normalizedWorkflow.crmPreset, "hubspot");
assert.equal(normalizedWorkflow.rules.lowerEmail, true);

const workflow = rescue.evaluateWorkflowContract(table, workflowConfig, { today: "2026-06-01" });
assert.equal(workflow.status, "matched");
assert.equal(workflow.matchedColumns.length, workflowConfig.expectedColumns.length);
assert.equal(workflow.extraColumns.length, 0);
assert.equal(workflow.support.status, "active");

const changedTable = rescue.parseDelimited(`${input}\n`, ",");
changedTable.headers.push("UTM Campaign");
changedTable.rows = changedTable.rows.map((row) => row.concat("spring-webinar"));
const changedWorkflow = rescue.evaluateWorkflowContract(changedTable, workflowConfig, {
  today: "2026-06-01",
});
assert.equal(changedWorkflow.status, "needs_update");
assert.deepEqual(changedWorkflow.extraColumns, ["UTM Campaign"]);
assert.ok(changedWorkflow.issues.some((issue) => issue.stage === "workflow_scope"));

const missingTable = rescue.parseDelimited(input);
missingTable.headers = missingTable.headers.filter((header) => header !== "Work Email");
missingTable.rows = missingTable.rows.map((row) => row.filter((_, index) => index !== 1));
const missingWorkflow = rescue.evaluateWorkflowContract(missingTable, workflowConfig, {
  today: "2026-06-01",
});
assert.equal(missingWorkflow.status, "blocked");
assert.deepEqual(missingWorkflow.missingRequiredColumns, ["Work Email"]);

for (const preset of ["salesforce", "airtable"]) {
  const presetExport = rescue.applyCrmPreset(cleaned, preset);
  const presetCrm = rescue.analyzeCrmReadiness(presetExport, preset);
  assert.ok(presetExport.headers.length > 0);
  assert.equal(presetExport.rows.length, cleaned.rows.length);
  assert.ok(presetCrm.score > 0);
}

const csv = rescue.toDelimited(cleaned.headers, cleaned.rows, ",");
assert.match(csv, /signup_date/);
assert.match(csv, /jordan@acme.com/);

const report = rescue.buildMarkdownReport(table, analysis, cleaned, { exported, crm, workflow });
assert.match(report, /CRM Import Rescue Report/);
assert.match(report, /Exact duplicate rows: 1/);
assert.match(report, /CRM Field Mapping/);
assert.match(report, /Workflow Scope/);

const issueExport = rescue.buildIssueExport(changedTable, analysis, {
  exported,
  crm,
  workflow: changedWorkflow,
});
assert.deepEqual(issueExport.headers, [
  "severity",
  "stage",
  "row",
  "field",
  "value",
  "issue",
  "suggested_fix",
]);
assert.ok(issueExport.rows.some((row) => row.includes("Exact duplicate row")));
assert.ok(issueExport.rows.some((row) => row.includes("Duplicate email group across rows 2; 3")));
assert.ok(issueExport.rows.some((row) => row.includes("workflow_scope")));
const issueCsv = rescue.toDelimited(issueExport.headers, issueExport.rows, ",");
assert.match(issueCsv, /suggested_fix/);
assert.match(issueCsv, /crm_export/);

console.log("dataRescue tests passed");
