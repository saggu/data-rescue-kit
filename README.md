# CRM Import Rescue

A browser-only demo for a productized coding service:

> Clean messy contact CSVs before HubSpot, Salesforce, or Airtable import.

This is no longer positioned as a generic data cleaning tool. The wedge is specific: reduce CRM import failures, duplicate contacts, bad emails, missing required fields, and manual spreadsheet cleanup.

## What It Does

- Parses CSV, TSV, semicolon, and pipe-delimited files.
- Profiles missing values, duplicate rows, fuzzy duplicate people/companies, mixed formats, whitespace, casing, dates, emails, and phone numbers.
- Cleans headers, whitespace, empty tokens, emails, phone numbers, dates, numbers, and exact duplicate rows.
- Maps contact data into one of three import presets:
  - HubSpot contacts
  - Salesforce leads
  - Airtable contacts
- Scores CRM import readiness.
- Flags import blockers such as missing required fields, invalid emails, duplicate email groups, invalid phones, and unmapped target fields.
- Exports an import-ready CSV for the selected CRM.
- Generates a Markdown report that can be sent to a prospect or client.
- Runs fully in the browser. No upload server and no API key.

## Pages

- `index.html` is the sales landing page.
- `tool.html` is the working CRM import audit tool.
- `.github/workflows/pages.yml` deploys the static site to GitHub Pages on every push to `main`.

The app includes a dirty CRM sample dataset at `samples/crm_contacts_dirty.csv`.

## Demo Video

The recorded product demo is at `demo/crm-import-rescue-demo.webm`.

To regenerate it:

```bash
python3 -m http.server 4173
npm run record
```

## Prospecting

See `PROSPECTS.md` for the first outreach segments, search queries, and partner targets.

## Service Offer

### CRM Import Rescue

Fixed-scope projects from `$500-$2,000`.

Deliverables:

- CRM-ready contact import CSV.
- Duplicate person/company/email report.
- Import blocker report.
- Field mapping for HubSpot, Salesforce, Airtable, or the client's CRM.
- Repeatable cleanup script for future monthly imports.
- Optional validation checklist for whoever owns the CRM.

Good fit:

- HubSpot imports
- Salesforce lead imports
- Airtable contact bases
- event lead lists
- purchased lists with permission to use
- messy founder/operator spreadsheets
- CRM migrations
- monthly contact enrichment workflows

Bad fit:

- unclear ownership or consent for the contact data
- spam campaigns
- scraping against terms of service
- regulated data without a proper handling agreement
- huge migrations that need enterprise security review before scoping

## Outreach Script

```text
Quick question: do you have a HubSpot, Salesforce, or Airtable import coming up with messy contacts?

I clean contact CSVs before CRM import: duplicate people/companies, bad emails, inconsistent phone numbers, unmapped fields, missing required columns, and repeatable cleanup scripts.

Fixed-scope CRM import rescue starts at $500. If you send a sample export, I can tell you what will break before you upload it.
```

## Better Buyer-Specific Versions

- HubSpot Import Rescue for agencies and solo founders.
- Salesforce Lead Import Rescue for B2B sales teams.
- Event Lead List Cleanup for conference sponsors and local business events.
- Airtable Contact Base Cleanup for operators and agencies.
- AI Data Readiness Audit for teams preparing CRM/contact data for RAG or enrichment.

## Next Paid Upgrade Ideas

- Add XLSX import/export.
- Add a CLI mode that applies the same mapping rules every month.
- Save custom mapping templates as JSON.
- Add company/person entity resolution with confidence scores.
- Add HubSpot/Salesforce field-specific validation packs.
- Add a short case-study landing page and before/after screenshots.

## Positioning

Do not sell this as "CSV cleanup."

Sell this:

> I prevent broken CRM imports and turn recurring contact cleanup into a repeatable workflow.
