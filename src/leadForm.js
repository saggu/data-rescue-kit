const config = window.CrmImportRescueConfig || {};
const CONTACT_EMAIL = config.contactEmail || "amandeep.s.saggu@gmail.com";
const LEAD_ENDPOINT = config.leadEndpoint || "";

const form = document.querySelector("#lead-form");
const copyButton = document.querySelector("#copy-lead");
const submitButton = form.querySelector('button[type="submit"]');
const statusEl = document.querySelector("#form-status");

function fieldValue(formData, key, fallback = "Not provided") {
  const value = String(formData.get(key) || "").trim();
  return value || fallback;
}

function buildInquiry() {
  const formData = new FormData(form);
  const name = fieldValue(formData, "name");
  const email = fieldValue(formData, "email");
  const crm = fieldValue(formData, "crm");
  const rows = fieldValue(formData, "rows");
  const deadline = fieldValue(formData, "deadline");
  const budget = fieldValue(formData, "budget");
  const problem = fieldValue(formData, "problem");

  const subject = `CRM Import Rescue request - ${crm}`;
  const body = [
    "CRM Import Rescue request",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `CRM target: ${crm}`,
    `Rows in file: ${rows}`,
    `Deadline: ${deadline}`,
    `Budget range: ${budget}`,
    "",
    "What is broken or risky?",
    problem,
    "",
    "I can send a sample export with sensitive fields removed before sharing any full file.",
  ].join("\n");

  return { body, subject };
}

function buildPayload() {
  const formData = new FormData(form);
  const inquiry = buildInquiry();
  return {
    name: fieldValue(formData, "name"),
    email: fieldValue(formData, "email"),
    crm: fieldValue(formData, "crm"),
    rows: fieldValue(formData, "rows"),
    deadline: fieldValue(formData, "deadline"),
    budget: fieldValue(formData, "budget"),
    problem: fieldValue(formData, "problem"),
    message: inquiry.body,
    _subject: inquiry.subject,
    _template: "table",
    _captcha: "false",
    _honey: String(formData.get("_honey") || ""),
  };
}

function setStatus(message, tone = "neutral") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function validateForm() {
  if (form.reportValidity()) {
    return true;
  }

  setStatus("Please fill in the required fields first.", "error");
  return false;
}

function track(eventName, properties = {}) {
  if (window.CrmAnalytics) {
    window.CrmAnalytics.track(eventName, properties);
  }
}

async function submitLead() {
  const payload = buildPayload();
  if (payload._honey) {
    return { ok: true, spam: true };
  }

  if (!LEAD_ENDPOINT) {
    throw new Error("Lead endpoint is not configured.");
  }

  const response = await fetch(LEAD_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Lead capture service rejected the request.");
  }

  return response.json();
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Sending..." : "Send request";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  track("lead_submit_attempt");
  setSubmitting(true);
  setStatus("Sending request...");

  try {
    await submitLead();
    form.reset();
    track("lead_submit_success");
    setStatus(
      "Request sent. Check your inbox for a reply, usually within one business day.",
      "success",
    );
  } catch (error) {
    track("lead_submit_error", { reason: error.message });
    setStatus(
      `Could not send automatically. Use Copy fallback and send it to ${CONTACT_EMAIL}.`,
      "error",
    );
  } finally {
    setSubmitting(false);
  }
});

copyButton.addEventListener("click", async () => {
  if (!validateForm()) {
    return;
  }

  const inquiry = buildInquiry();
  const text = `To: ${CONTACT_EMAIL}\nSubject: ${inquiry.subject}\n\n${inquiry.body}`;

  try {
    await navigator.clipboard.writeText(text);
    track("lead_copy_fallback");
    setStatus(`Inquiry copied. Send it to ${CONTACT_EMAIL} by email or DM.`, "success");
  } catch (error) {
    setStatus(`Copy failed. Send this request to ${CONTACT_EMAIL}.`, "error");
  }
});
