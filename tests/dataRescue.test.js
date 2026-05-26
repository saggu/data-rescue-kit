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
assert.deepEqual(cleaned.headers, ["full_name", "work_email", "mobile_phone", "company_name", "signup_date", "spend"]);
assert.equal(cleaned.rows.length, 3);
assert.equal(cleaned.rows[0][1], "jordan@acme.com");
assert.equal(cleaned.rows[0][2], "(310) 555-0199");
assert.equal(cleaned.rows[0][4], "2026-01-05");
assert.equal(cleaned.rows[0][5], "1200.00");

const exported = rescue.applyCrmPreset(cleaned, "hubspot");
assert.deepEqual(exported.headers.slice(0, 4), ["email", "firstname", "lastname", "phone"]);
assert.equal(exported.rows[0][1], "Jordan");
assert.equal(exported.rows[0][2], "Lee");

const crm = rescue.analyzeCrmReadiness(exported, "hubspot");
assert.equal(crm.presetLabel, "HubSpot contacts");
assert.ok(crm.score > 0);

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

const report = rescue.buildMarkdownReport(table, analysis, cleaned, { exported, crm });
assert.match(report, /CRM Import Rescue Report/);
assert.match(report, /Exact duplicate rows: 1/);
assert.match(report, /CRM Field Mapping/);

console.log("dataRescue tests passed");
