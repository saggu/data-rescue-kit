const CONTACT_EMAIL = "amandeep.s.saggu@gmail.com";

const form = document.querySelector("#lead-form");
const copyButton = document.querySelector("#copy-lead");
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

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  const inquiry = buildInquiry();
  const mailtoUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(inquiry.subject)}&body=${encodeURIComponent(inquiry.body)}`;
  window.location.href = mailtoUrl;
  setStatus(`Email draft opened for ${CONTACT_EMAIL}. If nothing opened, use Copy inquiry.`, "success");
});

copyButton.addEventListener("click", async () => {
  if (!validateForm()) {
    return;
  }

  const inquiry = buildInquiry();
  const text = `To: ${CONTACT_EMAIL}\nSubject: ${inquiry.subject}\n\n${inquiry.body}`;

  try {
    await navigator.clipboard.writeText(text);
    setStatus("Inquiry copied. Paste it into email or a DM.", "success");
  } catch (error) {
    setStatus(`Copy failed. Send this request to ${CONTACT_EMAIL}.`, "error");
  }
});
