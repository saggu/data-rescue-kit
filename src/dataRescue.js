(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DataRescue = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EMPTY_TOKENS = new Set(["", "na", "n/a", "none", "null", "nil", "-", "--", "unknown"]);
  const CLEANING_RULE_KEYS = new Set([
    "normalizeHeaders",
    "trimCells",
    "normalizeEmpty",
    "lowerEmail",
    "normalizeDates",
    "normalizeNumbers",
    "normalizePhones",
    "dropDuplicateRows",
  ]);
  const CRM_PRESETS = {
    hubspot: {
      label: "HubSpot contacts",
      required: ["email"],
      fields: [
        { key: "email", label: "email", aliases: ["email", "email_address", "work_email"] },
        {
          key: "firstname",
          label: "firstname",
          aliases: ["first_name", "firstname", "given_name"],
        },
        {
          key: "lastname",
          label: "lastname",
          aliases: ["last_name", "lastname", "surname", "family_name"],
        },
        {
          key: "phone",
          label: "phone",
          aliases: ["phone", "phone_number", "mobile", "mobile_phone", "cell", "cell_phone"],
        },
        {
          key: "company",
          label: "company",
          aliases: ["company", "company_name", "account", "account_name", "organization"],
        },
        { key: "jobtitle", label: "jobtitle", aliases: ["title", "job_title", "role"] },
        { key: "city", label: "city", aliases: ["city"] },
        { key: "state", label: "state", aliases: ["state", "province", "region"] },
        { key: "country", label: "country", aliases: ["country"] },
        {
          key: "lifecyclestage",
          label: "lifecyclestage",
          aliases: ["lifecycle_stage", "lifecycle", "stage"],
        },
        {
          key: "hs_lead_status",
          label: "hs_lead_status",
          aliases: ["lead_status", "status", "crm_status"],
        },
        { key: "lead_source", label: "lead_source", aliases: ["lead_source", "source", "channel"] },
        {
          key: "hubspot_owner_id",
          label: "hubspot_owner_id",
          aliases: ["owner", "sales_owner", "rep", "assigned_to"],
        },
        {
          key: "notes_last_contacted",
          label: "notes_last_contacted",
          aliases: ["last_contacted", "last_touch", "last_contact_date"],
        },
        { key: "notes", label: "notes", aliases: ["notes", "description", "memo"] },
      ],
    },
    salesforce: {
      label: "Salesforce leads",
      required: ["LastName", "Company"],
      fields: [
        {
          key: "FirstName",
          label: "FirstName",
          aliases: ["first_name", "firstname", "given_name"],
        },
        {
          key: "LastName",
          label: "LastName",
          aliases: ["last_name", "lastname", "surname", "family_name"],
        },
        { key: "Email", label: "Email", aliases: ["email", "email_address", "work_email"] },
        {
          key: "Phone",
          label: "Phone",
          aliases: ["phone", "phone_number", "mobile", "mobile_phone", "cell", "cell_phone"],
        },
        {
          key: "Company",
          label: "Company",
          aliases: ["company", "company_name", "account", "account_name", "organization"],
        },
        { key: "Title", label: "Title", aliases: ["title", "job_title", "role"] },
        { key: "LeadSource", label: "LeadSource", aliases: ["lead_source", "source", "channel"] },
        { key: "Status", label: "Status", aliases: ["lead_status", "status", "crm_status"] },
        { key: "City", label: "City", aliases: ["city"] },
        { key: "State", label: "State", aliases: ["state", "province", "region"] },
        { key: "Country", label: "Country", aliases: ["country"] },
        { key: "Owner", label: "Owner", aliases: ["owner", "sales_owner", "rep", "assigned_to"] },
        { key: "Description", label: "Description", aliases: ["notes", "description", "memo"] },
      ],
    },
    airtable: {
      label: "Airtable contacts",
      required: ["Name"],
      fields: [
        {
          key: "Name",
          label: "Name",
          aliases: ["full_name", "name", "contact_name", "customer_name"],
        },
        { key: "Email", label: "Email", aliases: ["email", "email_address", "work_email"] },
        {
          key: "Phone",
          label: "Phone",
          aliases: ["phone", "phone_number", "mobile", "mobile_phone", "cell", "cell_phone"],
        },
        {
          key: "Company",
          label: "Company",
          aliases: ["company", "company_name", "account", "account_name", "organization"],
        },
        { key: "Title", label: "Title", aliases: ["title", "job_title", "role"] },
        { key: "Source", label: "Source", aliases: ["lead_source", "source", "channel"] },
        { key: "Status", label: "Status", aliases: ["lead_status", "status", "crm_status"] },
        { key: "Owner", label: "Owner", aliases: ["owner", "sales_owner", "rep", "assigned_to"] },
        {
          key: "Last Contacted",
          label: "Last Contacted",
          aliases: ["last_contacted", "last_touch", "last_contact_date"],
        },
        { key: "Notes", label: "Notes", aliases: ["notes", "description", "memo"] },
      ],
    },
  };

  function detectDelimiter(text) {
    const candidates = [",", "\t", ";", "|"];
    const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 10);
    let best = ",";
    let bestScore = -1;
    for (const delimiter of candidates) {
      const counts = lines.map((line) => countOutsideQuotes(line, delimiter));
      const total = counts.reduce((sum, count) => sum + count, 0);
      const variance = counts.length
        ? counts.reduce((sum, count) => sum + Math.abs(count - total / counts.length), 0)
        : 0;
      const score = total - variance;
      if (score > bestScore) {
        best = delimiter;
        bestScore = score;
      }
    }
    return best;
  }

  function countOutsideQuotes(line, delimiter) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (!quoted && char === delimiter) {
        count += 1;
      }
    }
    return count;
  }

  function parseDelimited(text, delimiter) {
    const delim = delimiter || detectDelimiter(text);
    const rows = [];
    const errors = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (quoted) {
        if (char === '"') {
          if (next === '"') {
            field += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        quoted = true;
      } else if (char === delim) {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }

    if (quoted) {
      errors.push("A quoted value was not closed before the end of the file.");
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    while (rows.length && rows[rows.length - 1].every((cell) => cell.trim() === "")) {
      rows.pop();
    }

    const headers = rows.shift() || [];
    const width = headers.length;
    const records = rows.map((cells) => normalizeWidth(cells, width));
    return { delimiter: delim, headers, rows: records, errors };
  }

  function normalizeWidth(cells, width) {
    const row = cells.slice(0, width);
    while (row.length < width) {
      row.push("");
    }
    return row;
  }

  function toDelimited(headers, rows, delimiter) {
    const delim = delimiter || ",";
    return [headers, ...rows]
      .map((row) => row.map((cell) => escapeCell(cell, delim)).join(delim))
      .join("\n");
  }

  function escapeCell(value, delimiter) {
    const text = value == null ? "" : String(value);
    if (
      text.includes('"') ||
      text.includes("\n") ||
      text.includes("\r") ||
      text.includes(delimiter)
    ) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function analyzeTable(table) {
    const headers = table.headers || [];
    const rows = table.rows || [];
    const rowCount = rows.length;
    const columnCount = headers.length;
    const duplicateHeaders = findDuplicateHeaders(headers);
    const columns = headers.map((header, index) => profileColumn(header, index, rows));
    const duplicates = findDuplicateRows(rows);
    const fuzzyMatches = findFuzzyMatches(headers, rows);
    const issues = buildIssues({
      rowCount,
      columnCount,
      duplicateHeaders,
      columns,
      duplicates,
      fuzzyMatches,
    });
    const qualityScore = scoreQuality({ rowCount, columnCount, columns, duplicates, issues });

    return {
      rowCount,
      columnCount,
      duplicateHeaders,
      columns,
      duplicates,
      fuzzyMatches,
      issues,
      qualityScore,
    };
  }

  function profileColumn(header, index, rows) {
    const values = rows.map((row) => (row[index] == null ? "" : String(row[index])));
    const trimmedValues = values.map((value) => value.trim());
    const nonEmpty = trimmedValues.filter((value) => !isEmptyish(value));
    const missingCount = values.length - nonEmpty.length;
    const unique = new Set(nonEmpty.map(canonicalCell));
    const whitespaceCount = values.filter((value) => value !== value.trim()).length;
    const typeCounts = countTypes(nonEmpty);
    const inferredType = inferType(typeCounts, nonEmpty.length);
    const topValues = topValueCounts(nonEmpty);
    const casingGroups = groupBy(nonEmpty, (value) => value.toLowerCase());
    const casingIssues = Object.values(casingGroups).filter(
      (items) => new Set(items).size > 1,
    ).length;
    const parseableDates = nonEmpty.filter((value) => Boolean(parseDate(value))).length;
    const parseableNumbers = nonEmpty.filter((value) => isNumericLike(value)).length;

    return {
      index,
      header,
      normalizedHeader: normalizeHeader(header),
      inferredType,
      totalCount: values.length,
      nonEmptyCount: nonEmpty.length,
      missingCount,
      missingRate: values.length ? missingCount / values.length : 0,
      uniqueCount: unique.size,
      uniquenessRate: nonEmpty.length ? unique.size / nonEmpty.length : 0,
      whitespaceCount,
      casingIssues,
      parseableDates,
      parseableNumbers,
      typeCounts,
      topValues,
      sampleValues: nonEmpty.slice(0, 4),
    };
  }

  function countTypes(values) {
    const counts = { number: 0, date: 0, email: 0, phone: 0, url: 0, boolean: 0, text: 0 };
    for (const value of values) {
      counts[classifyValue(value)] += 1;
    }
    return counts;
  }

  function classifyValue(value) {
    if (isEmail(value)) {
      return "email";
    }
    if (isUrl(value)) {
      return "url";
    }
    if (isBooleanLike(value)) {
      return "boolean";
    }
    if (parseDate(value)) {
      return "date";
    }
    if (isPhoneLike(value)) {
      return "phone";
    }
    if (isNumericLike(value)) {
      return "number";
    }
    return "text";
  }

  function inferType(counts, total) {
    if (!total) {
      return "empty";
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const [type, count] = entries[0];
    return count / total >= 0.72 ? type : "mixed";
  }

  function dominantColumnType(column) {
    const entries = Object.entries(column.typeCounts || {}).sort((a, b) => b[1] - a[1]);
    return entries[0] ? entries[0][0] : "text";
  }

  function cleanTable(table, analysis, options) {
    const settings = Object.assign(
      {
        normalizeHeaders: true,
        trimCells: true,
        normalizeEmpty: true,
        lowerEmail: true,
        normalizeDates: true,
        normalizeNumbers: true,
        normalizePhones: true,
        dropDuplicateRows: true,
      },
      options || {},
    );

    const columns = analysis && analysis.columns ? analysis.columns : analyzeTable(table).columns;
    const headers = settings.normalizeHeaders
      ? makeUniqueHeaders(table.headers.map(normalizeHeader))
      : table.headers.slice();
    const changes = {
      headersRenamed: 0,
      cellsTrimmed: 0,
      emptyTokensCleared: 0,
      emailsLowered: 0,
      datesNormalized: 0,
      numbersNormalized: 0,
      phonesNormalized: 0,
      duplicateRowsDropped: 0,
    };

    headers.forEach((header, index) => {
      if (header !== table.headers[index]) {
        changes.headersRenamed += 1;
      }
    });

    const cleanedRows = [];
    const seenRows = new Set();
    for (const rawRow of table.rows) {
      const cleaned = rawRow.map((cell, index) => {
        const column = columns[index] || {};
        const original = cell == null ? "" : String(cell);
        let value = original;

        if (settings.trimCells) {
          value = value.trim();
          if (value !== original) {
            changes.cellsTrimmed += 1;
          }
        }

        if (settings.normalizeEmpty && isEmptyish(value)) {
          if (value !== "") {
            changes.emptyTokensCleared += 1;
          }
          value = "";
        }

        if (value !== "" && settings.lowerEmail && column.inferredType === "email") {
          const lowered = value.toLowerCase();
          if (lowered !== value) {
            changes.emailsLowered += 1;
          }
          value = lowered;
        }

        if (value !== "" && settings.normalizeDates && column.inferredType === "date") {
          const normalizedDate = formatDateIso(value);
          if (normalizedDate && normalizedDate !== value) {
            value = normalizedDate;
            changes.datesNormalized += 1;
          }
        }

        if (value !== "" && settings.normalizeNumbers && column.inferredType === "number") {
          const normalizedNumber = normalizeNumber(value);
          if (normalizedNumber && normalizedNumber !== value) {
            value = normalizedNumber;
            changes.numbersNormalized += 1;
          }
        }

        if (value !== "" && settings.normalizePhones && isPhoneColumn(column)) {
          const normalizedPhone = normalizePhone(value);
          if (normalizedPhone && normalizedPhone !== value) {
            value = normalizedPhone;
            changes.phonesNormalized += 1;
          }
        }

        return value;
      });

      const key = cleaned.map(canonicalCell).join("\u001f");
      if (settings.dropDuplicateRows && seenRows.has(key)) {
        changes.duplicateRowsDropped += 1;
      } else {
        seenRows.add(key);
        cleanedRows.push(cleaned);
      }
    }

    return { headers, rows: cleanedRows, changes };
  }

  function applyCrmPreset(cleaned, presetKey) {
    const preset = CRM_PRESETS[presetKey] || CRM_PRESETS.hubspot;
    const sourceHeaders = cleaned.headers || [];
    const sourceRows = cleaned.rows || [];
    const sourceIndex = {};
    sourceHeaders.forEach((header, index) => {
      sourceIndex[normalizeHeader(header)] = index;
    });

    const mapping = preset.fields.map((field) => {
      const aliases = field.aliases.map(normalizeHeader);
      let source = aliases.find((alias) => sourceIndex[alias] != null);
      let derived = null;
      if (!source) {
        derived = inferDerivedSource(field.key, sourceIndex);
        source = derived ? derived.source : null;
      }
      return {
        target: field.label,
        key: field.key,
        required: preset.required.includes(field.key),
        source,
        derivedFrom: derived ? derived.derivedFrom : [],
      };
    });

    const targetHeaders = preset.fields.map((field) => field.label);
    const targetRows = sourceRows.map((row) =>
      mapping.map((item) => resolveMappedValue(item, row, sourceIndex)),
    );
    const mappedSources = new Set(
      mapping
        .flatMap((item) => (item.derivedFrom.length ? item.derivedFrom : [item.source]))
        .filter(Boolean),
    );
    const unmappedHeaders = sourceHeaders.filter(
      (header) => !mappedSources.has(normalizeHeader(header)),
    );
    const missingFields = mapping
      .filter((item) => !item.source && item.derivedFrom.length === 0)
      .map((item) => item.target);

    return {
      presetKey: presetKey || "hubspot",
      presetLabel: preset.label,
      headers: targetHeaders,
      rows: targetRows,
      mapping,
      missingFields,
      unmappedHeaders,
    };
  }

  function analyzeCrmReadiness(exported, presetKey) {
    const preset = CRM_PRESETS[presetKey] || CRM_PRESETS.hubspot;
    const headers = exported.headers || [];
    const rows = exported.rows || [];
    const headerIndex = {};
    headers.forEach((header, index) => {
      headerIndex[header] = index;
      headerIndex[normalizeHeader(header)] = index;
    });

    const requiredMissing = [];
    for (const required of preset.required) {
      const label = fieldLabelForPreset(preset, required);
      const index = headerIndex[label] != null ? headerIndex[label] : headerIndex[required];
      const missingRows = [];
      rows.forEach((row, rowIndex) => {
        if (!row[index] || isEmptyish(row[index])) {
          missingRows.push(rowIndex + 2);
        }
      });
      if (missingRows.length) {
        requiredMissing.push({ field: label, rows: missingRows });
      }
    }

    const emailIndex = firstExistingIndex(headerIndex, ["email", "Email"]);
    const phoneIndex = firstExistingIndex(headerIndex, ["phone", "Phone"]);
    const emails =
      emailIndex == null
        ? []
        : rows.map((row, index) => ({ value: row[emailIndex], row: index + 2 }));
    const invalidEmails = emails.filter((item) => item.value && !isEmail(item.value));
    const duplicateEmailGroups = groupDuplicates(
      emails.filter((item) => item.value && isEmail(item.value)),
      (item) => item.value.toLowerCase(),
    );
    const invalidPhones =
      phoneIndex == null
        ? []
        : rows
            .map((row, index) => ({ value: row[phoneIndex], row: index + 2 }))
            .filter((item) => item.value && !isPhoneLike(item.value));

    const issues = [];
    for (const item of requiredMissing) {
      issues.push({
        severity: "high",
        message: `${item.field} is required for ${preset.label} and is missing in ${item.rows.length} row${plural(item.rows.length)}.`,
      });
    }
    if (invalidEmails.length) {
      issues.push({
        severity: "high",
        message: `${invalidEmails.length} invalid email value${plural(invalidEmails.length)} will block or pollute import.`,
      });
    }
    if (duplicateEmailGroups.length) {
      issues.push({
        severity: "medium",
        message: `${duplicateEmailGroups.length} duplicate email group${plural(duplicateEmailGroups.length)} should be merged before import.`,
      });
    }
    if (invalidPhones.length) {
      issues.push({
        severity: "medium",
        message: `${invalidPhones.length} phone value${plural(invalidPhones.length)} need review.`,
      });
    }
    if (exported.missingFields && exported.missingFields.length) {
      issues.push({
        severity: "low",
        message: `${exported.missingFields.length} target field${plural(exported.missingFields.length)} could not be mapped from the source file.`,
      });
    }

    let score = 100;
    score -= Math.min(40, requiredMissing.reduce((sum, item) => sum + item.rows.length, 0) * 10);
    score -= Math.min(25, invalidEmails.length * 8);
    score -= Math.min(20, duplicateEmailGroups.length * 6);
    score -= Math.min(10, invalidPhones.length * 3);
    score -= Math.min(10, (exported.missingFields || []).length);

    return {
      presetLabel: preset.label,
      score: Math.max(0, Math.round(score)),
      requiredMissing,
      invalidEmails,
      duplicateEmailGroups,
      invalidPhones,
      issues: issues.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    };
  }

  function normalizeWorkflowConfig(input) {
    let raw = input || {};
    if (typeof input === "string") {
      try {
        raw = JSON.parse(input);
      } catch (error) {
        return {
          valid: false,
          errors: ["Workflow config must be valid JSON."],
          rawInput: input,
        };
      }
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {
        valid: false,
        errors: ["Workflow config must be a JSON object."],
        rawInput: input,
      };
    }

    const errors = [];
    const expectedColumns = normalizeStringList(raw.expectedColumns);
    const requiredColumns = normalizeStringList(raw.requiredColumns);
    const rules = normalizeWorkflowRules(raw.rules || {});
    const crmPreset = normalizeCrmPreset(raw.crmPreset || raw.preset || raw.crmTarget);
    const includedFixesUntil = raw.includedFixesUntil || raw.includedUntil || "";

    if (!expectedColumns.length) {
      errors.push("Workflow config needs at least one expectedColumns entry.");
    }

    for (const column of requiredColumns) {
      if (!expectedColumns.map(normalizeHeader).includes(normalizeHeader(column))) {
        errors.push(`${column} is required but is not listed in expectedColumns.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      workflowId: stringOrDefault(raw.workflowId || raw.id, "custom-workflow"),
      workflowName: stringOrDefault(raw.workflowName || raw.name, "Custom CRM cleanup workflow"),
      version: stringOrDefault(raw.version, "1.0.0"),
      sourceFormat: stringOrDefault(raw.sourceFormat, "Recurring CSV export"),
      crmTarget: stringOrDefault(raw.crmTarget, CRM_PRESETS[crmPreset].label),
      crmPreset,
      includedFixesUntil: String(includedFixesUntil || "").trim(),
      allowExtraColumns: Boolean(raw.allowExtraColumns),
      expectedColumns,
      requiredColumns,
      rules,
    };
  }

  function evaluateWorkflowContract(table, workflowConfig, options) {
    const config = normalizeWorkflowConfig(workflowConfig);
    const today = options && options.today ? options.today : null;
    if (!config.valid) {
      return {
        enabled: true,
        status: "invalid",
        statusLabel: "Invalid workflow config",
        config,
        support: buildSupportWindow(config.includedFixesUntil, today),
        matchedColumns: [],
        missingExpectedColumns: [],
        missingRequiredColumns: [],
        extraColumns: [],
        duplicateSourceColumns: [],
        issues: config.errors.map((message) => ({
          severity: "high",
          stage: "workflow_scope",
          issue: message,
          suggestedFix: "Fix the workflow JSON before using it for a paid reusable workflow.",
        })),
      };
    }

    const headers = table && Array.isArray(table.headers) ? table.headers : [];
    const sourceGroups = groupBy(
      headers.map((header, index) => ({
        header,
        index,
        normalized: normalizeHeader(header),
      })),
      (item) => item.normalized,
    );
    const expected = config.expectedColumns.map((column) => ({
      column,
      normalized: normalizeHeader(column),
      matches: sourceGroups[normalizeHeader(column)] || [],
    }));
    const expectedKeys = new Set(expected.map((item) => item.normalized));
    const missingExpectedColumns = expected
      .filter((item) => !item.matches.length)
      .map((item) => item.column);
    const missingRequiredColumns = config.requiredColumns.filter(
      (column) => !(sourceGroups[normalizeHeader(column)] || []).length,
    );
    const matchedColumns = expected
      .filter((item) => item.matches.length === 1)
      .map((item) => ({
        expected: item.column,
        actual: item.matches[0].header,
        index: item.matches[0].index,
      }));
    const ambiguousColumns = expected
      .filter((item) => item.matches.length > 1)
      .map((item) => ({
        expected: item.column,
        actual: item.matches.map((match) => match.header),
      }));
    const extraColumns = headers.filter((header) => !expectedKeys.has(normalizeHeader(header)));
    const duplicateSourceColumns = Object.values(sourceGroups)
      .filter((items) => items.length > 1)
      .map((items) => ({
        normalized: items[0].normalized,
        columns: items.map((item) => item.header),
      }));

    const issues = [];
    for (const column of missingRequiredColumns) {
      issues.push({
        severity: "high",
        stage: "workflow_scope",
        field: column,
        issue: "Required workflow column is missing",
        suggestedFix: "Use the contracted source export or scope a paid workflow update.",
      });
    }
    for (const column of missingExpectedColumns.filter(
      (column) => !missingRequiredColumns.map(normalizeHeader).includes(normalizeHeader(column)),
    )) {
      issues.push({
        severity: "high",
        stage: "workflow_scope",
        field: column,
        issue: "Expected workflow column is missing",
        suggestedFix: "Use the contracted source export or scope a paid workflow update.",
      });
    }
    for (const item of ambiguousColumns) {
      issues.push({
        severity: "high",
        stage: "workflow_scope",
        field: item.expected,
        value: item.actual.join(", "),
        issue: "Workflow column matches multiple source columns",
        suggestedFix: "Rename duplicate columns before running the reusable workflow.",
      });
    }
    if (extraColumns.length && !config.allowExtraColumns) {
      issues.push({
        severity: "medium",
        stage: "workflow_scope",
        field: "columns",
        value: extraColumns.join(", "),
        issue: `${extraColumns.length} source column${plural(extraColumns.length)} ${extraColumns.length === 1 ? "is" : "are"} outside the contracted workflow format`,
        suggestedFix:
          "Confirm whether these columns can be ignored or scope a paid mapping update.",
      });
    }

    let status = "matched";
    let statusLabel = "Workflow matched";
    if (missingRequiredColumns.length || missingExpectedColumns.length || ambiguousColumns.length) {
      status = "blocked";
      statusLabel = "Workflow blocked";
    } else if (extraColumns.length && !config.allowExtraColumns) {
      status = "needs_update";
      statusLabel = "Workflow needs update";
    }

    return {
      enabled: true,
      status,
      statusLabel,
      config,
      support: buildSupportWindow(config.includedFixesUntil, today),
      matchedColumns,
      missingExpectedColumns,
      missingRequiredColumns,
      extraColumns,
      duplicateSourceColumns,
      issues,
      rowCount: table && Array.isArray(table.rows) ? table.rows.length : 0,
      columnCount: headers.length,
    };
  }

  function buildWorkflowRunSummary(context) {
    const input = context || {};
    const table = input.table || {};
    const analysis = input.analysis || {};
    const crm = input.crm || null;
    const workflow = input.workflow || null;
    const fileName = stringOrDefault(input.fileName, "data.csv");
    const issueCounts = countRunIssues(analysis, crm, workflow);

    return {
      fileName,
      createdAt: input.createdAt || new Date().toISOString(),
      workflowContractId: workflow ? workflow.config.workflowId : "",
      workflowName: workflow ? workflow.config.workflowName : "",
      workflowVersion: workflow ? workflow.config.version : "",
      workflowStatus: workflow ? workflow.status : "unscoped",
      workflowStatusLabel: workflow ? workflow.statusLabel : "No workflow loaded",
      crmTarget: workflow ? workflow.config.crmTarget : crm ? crm.presetLabel : "",
      sourceFormat: workflow ? workflow.config.sourceFormat : "",
      rowCount: Array.isArray(table.rows) ? table.rows.length : analysis.rowCount || 0,
      columnCount: Array.isArray(table.headers) ? table.headers.length : analysis.columnCount || 0,
      columnNames: Array.isArray(table.headers) ? table.headers.slice() : [],
      missingExpectedColumns: workflow ? workflow.missingExpectedColumns.slice() : [],
      missingRequiredColumns: workflow ? workflow.missingRequiredColumns.slice() : [],
      extraColumns: workflow ? workflow.extraColumns.slice() : [],
      issueCounts,
    };
  }

  function buildMarkdownReport(table, analysis, cleaned, options) {
    const opts = options || {};
    const crm = opts.crm || null;
    const exported = opts.exported || null;
    const workflow = opts.workflow || null;
    const lines = [];
    lines.push("# CRM Import Rescue Report");
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- Quality score: ${analysis.qualityScore}/100`);
    if (crm) {
      lines.push(`- CRM import readiness: ${crm.score}/100 for ${crm.presetLabel}`);
    }
    lines.push(`- Input size: ${analysis.rowCount} rows x ${analysis.columnCount} columns`);
    lines.push(`- Exact duplicate rows: ${analysis.duplicates.duplicateRowCount}`);
    lines.push(`- Possible fuzzy duplicate groups: ${analysis.fuzzyMatches.groups.length}`);
    lines.push(
      `- Cleaned output size: ${cleaned.rows.length} rows x ${cleaned.headers.length} columns`,
    );
    if (exported) {
      lines.push(
        `- Import export size: ${exported.rows.length} rows x ${exported.headers.length} columns`,
      );
    }
    if (workflow) {
      lines.push(
        `- Workflow scope: ${workflow.statusLabel} (${workflow.config.workflowId} v${workflow.config.version})`,
      );
    }
    lines.push("");
    if (workflow) {
      lines.push("## Workflow Scope");
      lines.push("");
      lines.push(`- Workflow: ${workflow.config.workflowName}`);
      lines.push(`- Source format: ${workflow.config.sourceFormat}`);
      lines.push(`- CRM target: ${workflow.config.crmTarget}`);
      lines.push(`- Status: ${workflow.statusLabel}`);
      lines.push(`- Expected columns matched: ${workflow.matchedColumns.length}`);
      lines.push(`- Missing expected columns: ${workflow.missingExpectedColumns.length || "none"}`);
      lines.push(
        `- Extra columns: ${workflow.extraColumns.length ? workflow.extraColumns.join(", ") : "none"}`,
      );
      if (workflow.support && workflow.support.status !== "not_set") {
        lines.push(`- Included fixes: ${workflow.support.label}`);
      }
      if (workflow.issues.length) {
        lines.push("");
        for (const issue of workflow.issues) {
          lines.push(`- ${issue.severity.toUpperCase()}: ${issue.issue}`);
        }
      }
      lines.push("");
    }
    lines.push("## Cleaning Applied");
    lines.push("");
    for (const [key, value] of Object.entries(cleaned.changes)) {
      lines.push(`- ${humanizeKey(key)}: ${value}`);
    }
    if (exported) {
      lines.push("");
      lines.push("## CRM Field Mapping");
      lines.push("");
      lines.push("| Target field | Source field | Required |");
      lines.push("|---|---|---:|");
      for (const item of exported.mapping) {
        const source = item.derivedFrom.length
          ? `derived from ${item.derivedFrom.join(" + ")}`
          : item.source || "not mapped";
        lines.push(
          `| ${escapeMarkdown(item.target)} | ${escapeMarkdown(source)} | ${item.required ? "yes" : "no"} |`,
        );
      }
    }
    if (crm) {
      lines.push("");
      lines.push("## CRM Import Blockers");
      lines.push("");
      if (crm.issues.length) {
        for (const issue of crm.issues) {
          lines.push(`- ${issue.severity.toUpperCase()}: ${issue.message}`);
        }
      } else {
        lines.push("- No CRM import blockers found.");
      }
    }
    lines.push("");
    lines.push("## Priority Issues");
    lines.push("");
    if (analysis.issues.length) {
      for (const issue of analysis.issues.slice(0, 10)) {
        lines.push(`- ${issue.severity.toUpperCase()}: ${issue.message}`);
      }
    } else {
      lines.push("- No high-priority issues found.");
    }
    lines.push("");
    lines.push("## Column Profile");
    lines.push("");
    lines.push("| Column | Type | Missing | Unique | Notes |");
    lines.push("|---|---:|---:|---:|---|");
    for (const column of analysis.columns) {
      const notes = [];
      if (column.whitespaceCount) {
        notes.push(`${column.whitespaceCount} padded`);
      }
      if (column.casingIssues) {
        notes.push(`${column.casingIssues} casing groups`);
      }
      if (column.inferredType === "mixed") {
        notes.push("mixed formats");
      }
      lines.push(
        `| ${escapeMarkdown(column.header)} | ${column.inferredType} | ${column.missingCount} | ${column.uniqueCount} | ${notes.join(", ") || "ok"} |`,
      );
    }
    lines.push("");
    lines.push("## Recommended Next Step");
    lines.push("");
    lines.push(
      "Run one small pilot import, review rejected records, then turn the cleanup rules into a repeatable monthly CRM import workflow.",
    );
    return lines.join("\n");
  }

  function buildIssueExport(table, analysis, options) {
    const opts = options || {};
    const crm = opts.crm || null;
    const exported = opts.exported || null;
    const workflow = opts.workflow || null;
    const headers = ["severity", "stage", "row", "field", "value", "issue", "suggested_fix"];
    const rows = [];
    const addIssue = (issue) => {
      rows.push([
        issue.severity || "low",
        issue.stage || "source",
        issue.row || "",
        issue.field || "",
        issue.value || "",
        issue.issue || "",
        issue.suggestedFix || "",
      ]);
    };

    for (const header of analysis.duplicateHeaders) {
      addIssue({
        severity: "high",
        stage: "source_header",
        field: header,
        issue: "Duplicate normalized header",
        suggestedFix: "Rename one of the duplicate columns before import.",
      });
    }

    for (const group of analysis.duplicates.duplicateGroups) {
      const keeper = group[0];
      for (const row of group.slice(1)) {
        addIssue({
          severity: "high",
          stage: "source",
          row,
          field: "row",
          value: `matches row ${keeper}`,
          issue: "Exact duplicate row",
          suggestedFix: "Keep one record and remove the duplicate before import.",
        });
      }
    }

    for (const group of analysis.fuzzyMatches.groups) {
      addIssue({
        severity: "medium",
        stage: "source",
        row: group.rows.join("; "),
        field: group.column,
        value: group.values.join(" / "),
        issue: `Possible fuzzy duplicate (${Math.round(group.score * 100)}% similar)`,
        suggestedFix:
          "Compare these records and merge them if they represent the same contact or company.",
      });
    }

    addColumnIssues(table, analysis, addIssue);
    if (workflow) {
      for (const issue of workflow.issues || []) {
        addIssue(issue);
      }
    }
    if (crm && exported) {
      addCrmIssues(crm, exported, addIssue);
    }

    return { headers, rows };
  }

  function countRunIssues(analysis, crm, workflow) {
    const counts = {
      high: 0,
      medium: 0,
      low: 0,
      source: 0,
      crm_export: 0,
      workflow_scope: 0,
    };
    for (const issue of (analysis && analysis.issues) || []) {
      incrementIssueCounts(counts, issue.severity, "source");
    }
    for (const issue of (crm && crm.issues) || []) {
      incrementIssueCounts(counts, issue.severity, "crm_export");
    }
    for (const issue of (workflow && workflow.issues) || []) {
      incrementIssueCounts(counts, issue.severity, "workflow_scope");
    }
    return counts;
  }

  function incrementIssueCounts(counts, severity, stage) {
    const normalizedSeverity = counts[severity] == null ? "low" : severity;
    counts[normalizedSeverity] += 1;
    if (counts[stage] != null) {
      counts[stage] += 1;
    }
  }

  function addColumnIssues(table, analysis, addIssue) {
    for (const column of analysis.columns) {
      const missingSeverity = column.missingRate >= 0.4 ? "high" : "medium";
      if (column.missingRate >= 0.15) {
        table.rows.forEach((row, rowIndex) => {
          const value = row[column.index] == null ? "" : String(row[column.index]);
          if (isEmptyish(value)) {
            addIssue({
              severity: missingSeverity,
              stage: "source",
              row: rowIndex + 2,
              field: column.header,
              value,
              issue: "Missing value",
              suggestedFix: "Fill the value or confirm this field can be blank for import.",
            });
          }
        });
      }

      if (column.whitespaceCount) {
        table.rows.forEach((row, rowIndex) => {
          const value = row[column.index] == null ? "" : String(row[column.index]);
          if (value !== value.trim()) {
            addIssue({
              severity: "low",
              stage: "source",
              row: rowIndex + 2,
              field: column.header,
              value,
              issue: "Leading or trailing whitespace",
              suggestedFix: "Trim whitespace before import.",
            });
          }
        });
      }

      if (column.inferredType === "mixed") {
        const dominantType = dominantColumnType(column);
        table.rows.forEach((row, rowIndex) => {
          const value = row[column.index] == null ? "" : String(row[column.index]).trim();
          const type = classifyValue(value);
          if (value && type !== dominantType) {
            addIssue({
              severity: "medium",
              stage: "source",
              row: rowIndex + 2,
              field: column.header,
              value,
              issue: `Mixed format value (${type} in mostly ${dominantType} column)`,
              suggestedFix: "Normalize this value to match the dominant column format.",
            });
          }
        });
      }

      if (column.casingIssues >= 2) {
        addIssue({
          severity: "low",
          stage: "source_column",
          field: column.header,
          issue: "Inconsistent casing in repeated values",
          suggestedFix: "Standardize casing for repeated values before import.",
        });
      }
    }
  }

  function addCrmIssues(crm, exported, addIssue) {
    for (const item of crm.requiredMissing) {
      for (const row of item.rows) {
        addIssue({
          severity: "high",
          stage: "crm_export",
          row,
          field: item.field,
          issue: "Required CRM field is missing",
          suggestedFix: `Fill ${item.field} before importing into ${crm.presetLabel}.`,
        });
      }
    }

    for (const item of crm.invalidEmails) {
      addIssue({
        severity: "high",
        stage: "crm_export",
        row: item.row,
        field: "Email",
        value: item.value,
        issue: "Invalid email",
        suggestedFix: "Repair the email address or exclude the row from import.",
      });
    }

    for (const item of crm.invalidPhones) {
      addIssue({
        severity: "medium",
        stage: "crm_export",
        row: item.row,
        field: "Phone",
        value: item.value,
        issue: "Invalid phone",
        suggestedFix: "Normalize the phone number or leave it blank if phone is optional.",
      });
    }

    for (const group of crm.duplicateEmailGroups) {
      const rows = group.map((item) => item.row).join("; ");
      const email = group[0] ? group[0].value : "";
      for (const item of group) {
        addIssue({
          severity: "medium",
          stage: "crm_export",
          row: item.row,
          field: "Email",
          value: email,
          issue: `Duplicate email group across rows ${rows}`,
          suggestedFix: "Choose the winning contact record before importing.",
        });
      }
    }

    for (const field of exported.missingFields || []) {
      addIssue({
        severity: "low",
        stage: "crm_mapping",
        field,
        issue: "Target CRM field could not be mapped",
        suggestedFix: "Confirm whether this field is required or add a source column mapping.",
      });
    }
  }

  function buildIssues(context) {
    const issues = [];
    if (context.duplicateHeaders.length) {
      issues.push({
        severity: "high",
        message: `Duplicate headers found: ${context.duplicateHeaders.join(", ")}.`,
      });
    }
    if (context.duplicates.duplicateRowCount) {
      issues.push({
        severity: "high",
        message: `${context.duplicates.duplicateRowCount} exact duplicate row${plural(context.duplicates.duplicateRowCount)} found.`,
      });
    }
    if (context.fuzzyMatches.groups.length) {
      issues.push({
        severity: "medium",
        message: `${context.fuzzyMatches.groups.length} possible fuzzy duplicate group${plural(context.fuzzyMatches.groups.length)} found.`,
      });
    }
    for (const column of context.columns) {
      if (column.totalCount > 0 && column.missingRate >= 0.4) {
        issues.push({
          severity: "high",
          message: `${column.header} is ${(column.missingRate * 100).toFixed(0)}% missing.`,
          column: column.header,
        });
      } else if (column.totalCount > 0 && column.missingRate >= 0.15) {
        issues.push({
          severity: "medium",
          message: `${column.header} is ${(column.missingRate * 100).toFixed(0)}% missing.`,
          column: column.header,
        });
      }
      if (column.whitespaceCount) {
        issues.push({
          severity: "low",
          message: `${column.header} has ${column.whitespaceCount} value${plural(column.whitespaceCount)} with leading or trailing spaces.`,
          column: column.header,
        });
      }
      if (column.inferredType === "mixed" && column.nonEmptyCount) {
        issues.push({
          severity: "medium",
          message: `${column.header} has mixed value formats.`,
          column: column.header,
        });
      }
      if (column.casingIssues >= 2) {
        issues.push({
          severity: "low",
          message: `${column.header} has inconsistent casing in repeated values.`,
          column: column.header,
        });
      }
    }
    return issues.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  }

  function scoreQuality(context) {
    if (!context.rowCount || !context.columnCount) {
      return 0;
    }
    const totalCells = context.rowCount * context.columnCount;
    const missing = context.columns.reduce((sum, column) => sum + column.missingCount, 0);
    const whitespace = context.columns.reduce((sum, column) => sum + column.whitespaceCount, 0);
    const mixed = context.columns.filter((column) => column.inferredType === "mixed").length;
    const duplicateRate = context.duplicates.duplicateRowCount / Math.max(1, context.rowCount);
    const missingRate = missing / Math.max(1, totalCells);
    const whitespaceRate = whitespace / Math.max(1, totalCells);
    let score = 100;
    score -= Math.min(30, missingRate * 80);
    score -= Math.min(25, duplicateRate * 120);
    score -= Math.min(15, whitespaceRate * 120);
    score -= Math.min(20, mixed * 4);
    score -= Math.min(10, context.issues.filter((issue) => issue.severity === "high").length * 3);
    return Math.max(0, Math.round(score));
  }

  function findDuplicateHeaders(headers) {
    const counts = {};
    for (const header of headers) {
      const key = normalizeHeader(header);
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .filter((entry) => entry[1] > 1)
      .map((entry) => entry[0]);
  }

  function findDuplicateRows(rows) {
    const groups = {};
    rows.forEach((row, index) => {
      const key = row.map(canonicalCell).join("\u001f");
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(index + 2);
    });
    const duplicateGroups = Object.values(groups).filter((items) => items.length > 1);
    const duplicateRowCount = duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0);
    return { duplicateGroups, duplicateRowCount };
  }

  function findFuzzyMatches(headers, rows) {
    const candidateColumns = headers
      .map((header, index) => ({ header, index, key: normalizeHeader(header) }))
      .filter((column) =>
        /(name|company|organization|account|customer|client|vendor)/.test(column.key),
      );
    const groups = [];
    const maxRows = Math.min(rows.length, 250);

    for (const column of candidateColumns.slice(0, 3)) {
      const seenPairs = new Set();
      for (let i = 0; i < maxRows; i += 1) {
        const a = cleanComparable(rows[i][column.index]);
        if (a.length < 4) {
          continue;
        }
        for (let j = i + 1; j < maxRows; j += 1) {
          const b = cleanComparable(rows[j][column.index]);
          if (b.length < 4 || a === b) {
            continue;
          }
          const score = similarity(a, b);
          if (score >= 0.86) {
            const pairKey = `${column.index}:${i}:${j}`;
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              groups.push({
                column: column.header,
                rows: [i + 2, j + 2],
                values: [rows[i][column.index], rows[j][column.index]],
                score,
              });
            }
          }
        }
      }
    }
    return { groups, scannedRows: maxRows };
  }

  function normalizeHeader(header) {
    const base = String(header || "column")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_");
    return base || "column";
  }

  function normalizeStringList(value) {
    return Array.isArray(value)
      ? value.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
  }

  function normalizeWorkflowRules(rules) {
    const normalized = {};
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
      return normalized;
    }
    for (const [key, value] of Object.entries(rules)) {
      if (CLEANING_RULE_KEYS.has(key) && typeof value === "boolean") {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  function normalizeCrmPreset(value) {
    const key = normalizeHeader(value);
    if (CRM_PRESETS[key]) {
      return key;
    }
    const match = Object.entries(CRM_PRESETS).find((entry) => {
      const [presetKey, preset] = entry;
      return (
        normalizeHeader(presetKey) === key ||
        normalizeHeader(preset.label) === key ||
        preset.fields.some((field) => normalizeHeader(field.label) === key)
      );
    });
    return match ? match[0] : "hubspot";
  }

  function stringOrDefault(value, fallback) {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function buildSupportWindow(dateValue, todayValue) {
    const iso = String(dateValue || "").trim();
    if (!iso) {
      return { status: "not_set", label: "No included-fix window set." };
    }
    const until = parseIsoDateOnly(iso);
    if (!until) {
      return { status: "invalid", label: `Invalid included-fix date: ${iso}` };
    }
    const today = parseIsoDateOnly(todayValue) || new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const untilUtc = Date.UTC(until.getFullYear(), until.getMonth(), until.getDate());
    const daysRemaining = Math.ceil((untilUtc - todayUtc) / 86400000);
    if (daysRemaining < 0) {
      return {
        status: "ended",
        daysRemaining,
        includedFixesUntil: iso,
        label: `Ended on ${iso}.`,
      };
    }
    return {
      status: "active",
      daysRemaining,
      includedFixesUntil: iso,
      label:
        daysRemaining === 0
          ? `Ends today (${iso}).`
          : `${daysRemaining} day${plural(daysRemaining)} remaining, through ${iso}.`,
    };
  }

  function parseIsoDateOnly(value) {
    if (!value) {
      return null;
    }
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function makeUniqueHeaders(headers) {
    const counts = {};
    return headers.map((header) => {
      counts[header] = (counts[header] || 0) + 1;
      return counts[header] === 1 ? header : `${header}_${counts[header]}`;
    });
  }

  function canonicalCell(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function cleanComparable(value) {
    return canonicalCell(value)
      .replace(/&/g, " and ")
      .replace(/\b(inc|llc|ltd|co|corp|corporation|company)\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function isEmptyish(value) {
    return EMPTY_TOKENS.has(
      String(value == null ? "" : value)
        .trim()
        .toLowerCase(),
    );
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  }

  function isPhoneLike(value) {
    const digits = String(value).replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }

  function normalizePhone(value) {
    const digits = String(value).replace(/\D/g, "");
    if (!isPhoneLike(value)) {
      return "";
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return `+${digits}`;
  }

  function isPhoneColumn(column) {
    return (
      column.inferredType === "phone" ||
      /(^|_)(phone|mobile|cell|telephone)(_|$)/.test(column.normalizedHeader || "")
    );
  }

  function isUrl(value) {
    return /^(https?:\/\/|www\.)[^\s]+\.[^\s]+/i.test(String(value).trim());
  }

  function isBooleanLike(value) {
    return /^(true|false|yes|no|y|n)$/i.test(String(value).trim());
  }

  function isNumericLike(value) {
    const text = String(value).trim();
    if (!text || /^0\d+/.test(text)) {
      return false;
    }
    const normalized = text.replace(/[$,\s]/g, "").replace(/%$/, "");
    return /^-?\d+(\.\d+)?$/.test(normalized);
  }

  function normalizeNumber(value) {
    const text = String(value).trim();
    const normalized = text.replace(/[$,\s]/g, "");
    if (/^-?\d+(\.\d+)?%?$/.test(normalized)) {
      return normalized;
    }
    return "";
  }

  function parseDate(value) {
    const text = String(value).trim();
    if (!text || /^\d+$/.test(text)) {
      return null;
    }
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    const long = text.match(/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/);
    let date = null;

    if (iso) {
      date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    } else if (slash) {
      const year = slash[3].length === 2 ? Number(`20${slash[3]}`) : Number(slash[3]);
      date = new Date(year, Number(slash[1]) - 1, Number(slash[2]));
    } else if (long) {
      date = new Date(text);
    }

    if (!date || Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  function formatDateIso(value) {
    const date = parseDate(value);
    if (!date) {
      return "";
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function topValueCounts(values) {
    const counts = {};
    for (const value of values) {
      const key = String(value).trim();
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));
  }

  function groupBy(items, keyFn) {
    const groups = {};
    for (const item of items) {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }
    return groups;
  }

  function similarity(a, b) {
    const tokensA = new Set(a.split(/\s+/).filter(Boolean));
    const tokensB = new Set(b.split(/\s+/).filter(Boolean));
    const tokenUnion = new Set([...tokensA, ...tokensB]);
    let tokenIntersection = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) {
        tokenIntersection += 1;
      }
    }
    const tokenScore = tokenUnion.size ? tokenIntersection / tokenUnion.size : 0;
    const trigramScore = jaccard(trigrams(a), trigrams(b));
    return Math.max(tokenScore, trigramScore);
  }

  function trigrams(value) {
    const padded = `  ${value}  `;
    const grams = new Set();
    for (let i = 0; i < padded.length - 2; i += 1) {
      grams.add(padded.slice(i, i + 3));
    }
    return grams;
  }

  function jaccard(a, b) {
    const union = new Set([...a, ...b]);
    let intersection = 0;
    for (const item of a) {
      if (b.has(item)) {
        intersection += 1;
      }
    }
    return union.size ? intersection / union.size : 0;
  }

  function severityRank(severity) {
    return { low: 1, medium: 2, high: 3 }[severity] || 0;
  }

  function humanizeKey(key) {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
  }

  function escapeMarkdown(value) {
    return String(value).replace(/\|/g, "\\|");
  }

  function plural(count) {
    return count === 1 ? "" : "s";
  }

  function inferDerivedSource(fieldKey, sourceIndex) {
    const fullName = firstExistingSource(sourceIndex, [
      "full_name",
      "name",
      "contact_name",
      "customer_name",
    ]);
    const firstName = firstExistingSource(sourceIndex, ["first_name", "firstname", "given_name"]);
    const lastName = firstExistingSource(sourceIndex, [
      "last_name",
      "lastname",
      "surname",
      "family_name",
    ]);
    if ((fieldKey === "firstname" || fieldKey === "FirstName") && fullName) {
      return { source: "__first_from_full_name", derivedFrom: [fullName] };
    }
    if ((fieldKey === "lastname" || fieldKey === "LastName") && fullName) {
      return { source: "__last_from_full_name", derivedFrom: [fullName] };
    }
    if (fieldKey === "Name" && (firstName || lastName)) {
      return { source: "__full_from_parts", derivedFrom: [firstName, lastName].filter(Boolean) };
    }
    return null;
  }

  function resolveMappedValue(item, row, sourceIndex) {
    if (item.source === "__first_from_full_name") {
      const index = sourceIndex[item.derivedFrom[0]];
      return splitFullName(index == null ? "" : row[index])[0];
    }
    if (item.source === "__last_from_full_name") {
      const index = sourceIndex[item.derivedFrom[0]];
      return splitFullName(index == null ? "" : row[index])[1];
    }
    if (item.source === "__full_from_parts") {
      return item.derivedFrom
        .map((source) => {
          const index = sourceIndex[source];
          return index == null ? "" : row[index] || "";
        })
        .filter(Boolean)
        .join(" ")
        .trim();
    }
    if (!item.source || sourceIndex[item.source] == null) {
      return "";
    }
    return row[sourceIndex[item.source]] || "";
  }

  function splitFullName(value) {
    const parts = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) {
      return ["", ""];
    }
    if (parts.length === 1) {
      return [parts[0], ""];
    }
    return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
  }

  function firstExistingSource(sourceIndex, names) {
    return names.find((name) => sourceIndex[name] != null) || null;
  }

  function firstExistingIndex(headerIndex, names) {
    for (const name of names) {
      if (headerIndex[name] != null) {
        return headerIndex[name];
      }
      const normalized = normalizeHeader(name);
      if (headerIndex[normalized] != null) {
        return headerIndex[normalized];
      }
    }
    return null;
  }

  function fieldLabelForPreset(preset, key) {
    const field = preset.fields.find((item) => item.key === key || item.label === key);
    return field ? field.label : key;
  }

  function groupDuplicates(items, keyFn) {
    const groups = groupBy(items, keyFn);
    return Object.values(groups).filter((group) => group.length > 1);
  }

  return {
    CRM_PRESETS,
    detectDelimiter,
    parseDelimited,
    toDelimited,
    analyzeTable,
    cleanTable,
    applyCrmPreset,
    analyzeCrmReadiness,
    normalizeWorkflowConfig,
    evaluateWorkflowContract,
    buildWorkflowRunSummary,
    buildMarkdownReport,
    buildIssueExport,
    normalizeHeader,
    formatDateIso,
  };
});
