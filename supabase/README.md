# Supabase Portal Setup

This schema powers the CRM Import Rescue customer portal.

The portal tracks workflow contracts, schema checks, run metadata, change requests, and payments.
It does not store raw CSV rows by default.

## Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `schema.sql`.
4. In Authentication settings, enable email magic links.
5. Add your GitHub Pages URL to the allowed redirect URLs.
6. Copy the Project URL and anon public key into `src/siteConfig.js`:

```js
window.CrmImportRescueConfig = {
  supabaseUrl: "https://PROJECT.supabase.co",
  supabaseAnonKey: "PUBLIC_ANON_KEY",
};
```

## Data Stored

- workflow contract IDs and versions
- CRM target and source format
- expected, missing, required, and extra column names
- row and column counts
- issue counts
- change request notes
- payment metadata

Raw CSV row contents are intentionally excluded from `workflow_runs`.
