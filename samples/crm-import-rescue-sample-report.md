# CRM Import Rescue Report

## Summary

- Quality score: 74/100
- CRM import readiness: 69/100 for HubSpot contacts
- Input size: 11 rows x 14 columns
- Exact duplicate rows: 1
- Possible fuzzy duplicate groups: 0
- Cleaned output size: 10 rows x 14 columns
- Import export size: 10 rows x 15 columns

## Cleaning Applied

- Headers Renamed: 14
- Cells Trimmed: 2
- Empty Tokens Cleared: 1
- Emails Lowered: 3
- Dates Normalized: 6
- Numbers Normalized: 0
- Phones Normalized: 8
- Duplicate Rows Dropped: 1

## CRM Field Mapping

| Target field         | Source field           | Required |
| -------------------- | ---------------------- | -------: |
| email                | work_email             |      yes |
| firstname            | derived from full_name |       no |
| lastname             | derived from full_name |       no |
| phone                | mobile_phone           |       no |
| company              | company_name           |       no |
| jobtitle             | job_title              |       no |
| city                 | city                   |       no |
| state                | state                  |       no |
| country              | country                |       no |
| lifecyclestage       | not mapped             |       no |
| hs_lead_status       | crm_status             |       no |
| lead_source          | lead_source            |       no |
| hubspot_owner_id     | sales_owner            |       no |
| notes_last_contacted | last_contacted         |       no |
| notes                | notes                  |       no |

## CRM Import Blockers

- HIGH: email is required for HubSpot contacts and is missing in 1 row.
- HIGH: 1 invalid email value will block or pollute import.
- MEDIUM: 2 duplicate email groups should be merged before import.
- LOW: 1 target field could not be mapped from the source file.

## Priority Issues

- HIGH: 1 exact duplicate row found.
- HIGH: Notes is 64% missing.
- MEDIUM: CRM Status is 18% missing.
- MEDIUM: Sales Owner is 18% missing.
- MEDIUM: Last Contacted is 18% missing.
- LOW: Work Email has inconsistent casing in repeated values.
- LOW: Lead Source has inconsistent casing in repeated values.
- LOW: CRM Status has inconsistent casing in repeated values.
- LOW: City has 2 values with leading or trailing spaces.

## Column Profile

| Column         |  Type | Missing | Unique | Notes           |
| -------------- | ----: | ------: | -----: | --------------- |
| Contact ID     |  text |       0 |     10 | ok              |
| Full Name      |  text |       0 |      9 | ok              |
| Work Email     | email |       1 |      7 | 2 casing groups |
| Mobile Phone   | phone |       1 |      9 | ok              |
| Company Name   |  text |       0 |     10 | ok              |
| Job Title      |  text |       0 |     10 | ok              |
| Lead Source    |  text |       0 |      6 | 2 casing groups |
| CRM Status     |  text |       2 |      5 | 3 casing groups |
| Sales Owner    |  text |       2 |      3 | ok              |
| Last Contacted |  date |       2 |      8 | ok              |
| City           |  text |       0 |      5 | 2 padded        |
| State          |  text |       0 |      1 | ok              |
| Country        |  text |       0 |      2 | ok              |
| Notes          |  text |       7 |      4 | ok              |

## Recommended Next Step

Run one small pilot import, review rejected records, then turn the cleanup rules into a repeatable monthly CRM import workflow.
