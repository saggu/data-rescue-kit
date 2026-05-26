# CRM Import Rescue Sample Report

## File Summary

- Source file: `crm_contacts_dirty.csv`
- Target CRM: HubSpot contacts
- Rows reviewed: 11
- Columns reviewed: 14
- CRM readiness: 68/100
- Data quality: 74/100

## Import Blockers

| Severity | Issue                             | Why It Matters                                                                                    |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| High     | 2 duplicate email groups          | HubSpot uses email as the primary contact identity. Duplicate rows can overwrite or fork records. |
| High     | 3 invalid or missing emails       | Invalid emails fail validation and missing emails weaken dedupe.                                  |
| Medium   | 4 phone values need normalization | Mixed phone formats make calling, dedupe, and enrichment inconsistent.                            |
| Medium   | 2 rows are missing company values | Missing company data reduces routing and account matching quality.                                |
| Low      | 3 unmapped columns                | Extra columns need explicit handling before import.                                               |

## Cleanup Actions

- Normalized headers to CRM-friendly field names.
- Trimmed whitespace from every cell.
- Lowercased email addresses.
- Converted phone numbers to consistent US-friendly formatting where possible.
- Converted dates to ISO format.
- Removed exact duplicate rows.
- Mapped source fields into HubSpot contact import columns.

## Recommended Field Mapping

| Source Column | HubSpot Field                  | Action                                     |
| ------------- | ------------------------------ | ------------------------------------------ |
| `email`       | `Email`                        | Import after validation.                   |
| `first_name`  | `First Name`                   | Import.                                    |
| `last_name`   | `Last Name`                    | Import.                                    |
| `company`     | `Company Name`                 | Import after filling blanks.               |
| `phone`       | `Phone Number`                 | Import after normalization.                |
| `lead_source` | `Original Source Drill-Down 1` | Confirm exact HubSpot field before upload. |

## Before Upload

1. Decide the winner for each duplicate email group.
2. Repair or remove invalid email rows.
3. Fill missing company values when available.
4. Confirm unmapped custom fields with the CRM owner.
5. Import a 5-row test batch before uploading the full file.

## Paid Rescue Deliverables

- Clean CRM-ready import CSV.
- Import blocker report.
- Duplicate email and fuzzy duplicate review.
- Field mapping table for the selected CRM.
- Optional repeatable cleanup script for recurring imports.
