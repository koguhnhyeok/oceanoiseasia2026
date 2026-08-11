import { REGISTRATION_API_VERSION, validateRegistrationInput } from "./validation.js";
import { buildCountryOptions } from "./countries.js";

const state = {
  config: null,
  countryCodesByName: new Map(),
  clientSubmissionId: createUuid(),
  submitting: false,
  verifying: false,
  verificationToken: "",
  turnstileToken: "",
  turnstileWidgetId: null
};

const elements = {
  form: document.querySelector("[data-registration-form]"),
  countryInput: document.querySelector("[data-country-input]"),
  countryOptions: document.querySelector("[data-country-options]"),
  presenterSelect: document.querySelector("[data-presenter-select]"),
  paperTitleField: document.querySelector("[data-paper-title-field]"),
  paperTitleInput: document.querySelector("[data-paper-title-input]"),
  submitButton: document.querySelector("[data-submit-button]"),
  resetButton: document.querySelector("[data-reset-button]"),
  statusBox: document.querySelector("[data-status-box]"),
  statusTitle: document.querySelector("[data-status-title]"),
  statusMessage: document.querySelector("[data-status-message]"),
  summary: document.querySelector("[data-registration-summary]"),
  summaryCode: document.querySelector("[data-summary-code]"),
  summaryStatus: document.querySelector("[data-summary-status]"),
  summaryPayment: document.querySelector("[data-summary-payment]"),
  summaryName: document.querySelector("[data-summary-name]"),
  summaryEmail: document.querySelector("[data-summary-email]"),
  summaryAffiliation: document.querySelector("[data-summary-affiliation]"),
  summaryCountry: document.querySelector("[data-summary-country]"),
  summaryStudent: document.querySelector("[data-summary-student]"),
  summaryPresenter: document.querySelector("[data-summary-presenter]"),
  summaryPaperItem: document.querySelector("[data-summary-paper-item]"),
  summaryPaperTitle: document.querySelector("[data-summary-paper-title]"),
  summaryInvitationLetter: document.querySelector("[data-summary-invitation-letter]"),
  supportNote: document.querySelector("[data-support-note]"),
  turnstileContainer: document.querySelector("[data-turnstile-container]"),
  turnstileWidget: document.querySelector("[data-turnstile-widget]"),
  pageTitle: document.querySelector("[data-page-title]"),
  pageIntroduction: document.querySelector("[data-page-introduction]"),
  emailPreview: document.querySelector("[data-email-preview]"),
  emailSubject: document.querySelector("[data-email-subject]"),
  emailBody: document.querySelector("[data-email-body]"),
  verificationPanel: document.querySelector("[data-verification-panel]"),
  verificationButton: document.querySelector("[data-verification-button]")
};

init().catch(() => {
  showStatus(
    "error",
    "Registration is temporarily unavailable.",
    "The page configuration could not be loaded."
  );
});

async function init() {
  const config = await loadConfig();
  state.config = config;
  renderConfig(config);
  const verificationRequest = readEmailVerificationRequest();
  if (verificationRequest) {
    await showVerificationRoute(config, verificationRequest);
    return;
  }
  const statusRequest = readStatusRequest();
  if (statusRequest) {
    await showStatusRoute(config, statusRequest);
    return;
  }
  elements.form.addEventListener("submit", handleSubmit);
  elements.resetButton.addEventListener("click", resetForm);
  elements.presenterSelect.addEventListener("change", syncPresenterFields);
  elements.countryInput.addEventListener("input", () => elements.countryInput.setCustomValidity(""));
  elements.countryInput.addEventListener("change", validateCountrySelection);
  syncPresenterFields();
  await initializeTurnstile(config);
}

async function loadConfig() {
  const response = await fetch("./config.runtime.json", {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error("CONFIG_LOAD_FAILED");
  }
  return response.json();
}

function renderConfig(config) {
  config.countryOptions = config.useAllCountries
    ? buildCountryOptions()
    : config.countryOptions;
  fillCountryOptions(config.countryOptions);
  updateSubmitButton();
}

function fillCountryOptions(options) {
  state.countryCodesByName.clear();
  elements.countryOptions.replaceChildren();
  for (const country of options ?? []) {
    const option = document.createElement("option");
    option.value = country.label;
    option.label = country.code;
    elements.countryOptions.append(option);
    state.countryCodesByName.set(normalizeCountryKey(country.label), country.code);
    state.countryCodesByName.set(normalizeCountryKey(country.code), country.code);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.submitting) {
    return;
  }

  const formData = new FormData(elements.form);
  const payload = {
    apiVersion: REGISTRATION_API_VERSION,
    eventId: state.config.eventId,
    name: formData.get("name"),
    email: formData.get("email"),
    affiliation: formData.get("affiliation"),
    countryCode: resolveCountryCode(formData.get("countryName")),
    isStudent: parseRequiredBoolean(formData.get("isStudent")),
    isPresenter: parseRequiredBoolean(formData.get("isPresenter")),
    paperTitle: formData.get("paperTitle") ?? "",
    requiresInvitationLetter: formData.get("requiresInvitationLetter") === "on",
    clientSubmissionId: state.clientSubmissionId,
    turnstileToken: state.config.turnstileMode === "disabled"
      ? "local-turnstile-disabled"
      : state.turnstileToken
  };

  const validation = validateRegistrationInput(payload, getValidationOptions(state.config));
  if (!validation.ok) {
    if (validation.errors.countryCode) {
      elements.countryInput.setCustomValidity("Select a nationality from the suggested list.");
    }
    elements.form.reportValidity();
    showStatus("error", "Please correct the highlighted information.", summarizeErrors(validation.errors));
    return;
  }

  setSubmitting(true);
  showStatus("neutral", "Submitting registration.", "Please wait while the registration service processes the request.");

  try {
    const { emailNormalized: _emailNormalized, ...requestPayload } = validation.value;
    const result = await postJson(`${state.config.apiBaseUrl}/submit-registration`, requestPayload);
    renderRegistrationResult(result, {
      ...validation.value,
      countryName: elements.countryInput.value.trim()
    });
    elements.resetButton.hidden = false;
  } catch (error) {
    showStatus(
      "error",
      "Registration could not be processed.",
      error.publicMessage ?? "Please retry. If this continues, contact the organizing committee with the shown correlation ID."
    );
  } finally {
    resetTurnstileChallenge();
    setSubmitting(false);
  }
}

function renderRegistrationResult(result, submitted) {
  const emailMessage = result.email?.actuallySent === true
    ? `A verification email has been sent to ${submitted.emailNormalized}. Open it to complete your registration.`
    : result.email?.deliveryStatus === "failed"
      ? `Your information was saved, but the verification email could not be sent. Please contact ${state.config.supportEmail}.`
      : result.email?.deliveryMode === "preview_only"
        ? "Your information was saved. Use the verification link in the email preview below."
        : `Your information was saved. A verification email is being processed for ${submitted.emailNormalized}.`;
  showStatus(
    "success",
    "Check your email.",
    emailMessage
  );
  renderRegistrationSummary({
    name: submitted.name,
    email: submitted.emailNormalized,
    affiliation: submitted.affiliation,
    country: submitted.countryName,
    isStudent: submitted.isStudent,
    isPresenter: submitted.isPresenter,
    paperTitle: submitted.paperTitle,
    requiresInvitationLetter: submitted.requiresInvitationLetter
  });
  elements.supportNote.textContent =
    `To request a correction or ask a question, email ${state.config.supportEmail} `
    + "from the email address used for this registration.";
  elements.supportNote.hidden = false;
  renderEmailPreview(result.email);
}

function renderEmailPreview(email) {
  if (
    state.config?.environment === "production"
    || email?.deliveryMode !== "preview_only"
    || email.actuallySent !== false
    || !email.preview
  ) {
    elements.emailPreview.hidden = true;
    return;
  }
  elements.emailSubject.textContent = email.preview.subject;
  elements.emailBody.textContent = email.preview.text;
  elements.emailPreview.hidden = false;
}

function resetForm() {
  elements.form.reset();
  syncPresenterFields();
  elements.countryInput.setCustomValidity("");
  state.clientSubmissionId = createUuid();
  elements.resetButton.hidden = true;
  elements.summary.hidden = true;
  elements.supportNote.hidden = true;
  elements.emailPreview.hidden = true;
  elements.verificationPanel.hidden = true;
  resetTurnstileChallenge();
  showStatus("neutral", "Ready for another registration.", "Enter the participant information below.");
}

function getValidationOptions(config) {
  return {
    eventId: config.eventId,
    countryCodes: (config.countryOptions ?? []).map((item) => item.code),
    turnstileRequired: config.turnstileMode !== "disabled"
  };
}

function syncPresenterFields() {
  const presenter = elements.presenterSelect.value === "true";
  elements.paperTitleField.hidden = !presenter;
  elements.paperTitleInput.disabled = !presenter;
  elements.paperTitleInput.required = presenter;
  elements.paperTitleInput.setAttribute(
    "aria-label",
    presenter ? "Abstract Title Required for presenters" : "Abstract Title"
  );
  if (!presenter) {
    elements.paperTitleInput.value = "";
  }
}

function resolveCountryCode(value) {
  return state.countryCodesByName.get(normalizeCountryKey(value)) ?? "";
}

function normalizeCountryKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en");
}

function validateCountrySelection() {
  const value = elements.countryInput.value.trim();
  const valid = value.length === 0 || resolveCountryCode(value) !== "";
  elements.countryInput.setCustomValidity(valid ? "" : "Select a nationality from the suggested list.");
  return valid;
}

function parseRequiredBoolean(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

async function postJson(url, payload, { timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const responseBody = await safeReadJson(response);
    if (!response.ok) {
      const error = new Error(responseBody?.errorCode ?? "REQUEST_FAILED");
      error.publicMessage = buildPublicErrorMessage(responseBody);
      throw error;
    }
    return responseBody;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadRegistrationStatus(config, request) {
  if (!config.statusLookupEnabled) {
    showStatus("error", "Status lookup is unavailable.", "This environment does not enable status links.");
    return;
  }
  showStatus("neutral", "Loading registration status.", "Please wait.");
  try {
    const response = await fetch(`${config.apiBaseUrl}/registration-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
      cache: "no-store",
      signal: AbortSignal.timeout(10000)
    });
    const responseBody = await safeReadJson(response);
    if (!response.ok) {
      const error = new Error(responseBody?.errorCode ?? "STATUS_REQUEST_FAILED");
      error.publicMessage = buildPublicErrorMessage(responseBody);
      throw error;
    }
    const registration = responseBody.registration;
    showStatus("success", "Registration status loaded.", "This status was retrieved using the secure link.");
    elements.summary.hidden = false;
    elements.summaryCode.textContent = registration.registrationCode;
    elements.summaryStatus.textContent = registration.status;
    elements.summaryPayment.textContent = registration.paymentStatus;
  } catch (error) {
    showStatus(
      "error",
      "Registration status could not be loaded.",
      error.publicMessage ?? "The status link is invalid or expired."
    );
  }
}

async function handleEmailStatusLinkClick(event) {
  event.preventDefault();
  const target = new URL(elements.emailStatusLink.href);
  if (target.origin !== globalThis.location.origin || target.pathname !== globalThis.location.pathname) {
    showStatus("error", "Registration status could not be opened.", "The status link is not valid for this page.");
    return;
  }
  globalThis.history.pushState(null, "", `${target.pathname}${target.search}${target.hash}`);
  const statusRequest = readStatusRequest();
  if (!statusRequest) {
    showStatus("error", "Registration status could not be opened.", "The status link is incomplete.");
    return;
  }
  await showStatusRoute(state.config, statusRequest);
}

async function showStatusRoute(config, statusRequest) {
  elements.form.hidden = true;
  elements.emailPreview.hidden = true;
  elements.pageTitle.textContent = "Oceanoise Asia 2026 Registration Status";
  elements.pageIntroduction.textContent = "View the current registration status from this secure link.";
  await loadRegistrationStatus(config, statusRequest);
}

async function showVerificationRoute(config, verificationRequest) {
  state.verificationToken = verificationRequest.token;
  elements.form.hidden = true;
  elements.emailPreview.hidden = true;
  elements.summary.hidden = true;
  elements.supportNote.hidden = true;
  elements.verificationPanel.hidden = false;
  elements.pageTitle.textContent = "Verify your email";
  elements.pageIntroduction.textContent = "Continue the registration you submitted on the official Oceanoise Asia 2026 website.";
  elements.verificationButton.addEventListener("click", handleEmailVerification, { once: true });
  showStatus(
    "neutral",
    "Ready to complete registration.",
    "Select Complete Registration above to verify your email address and finish the registration."
  );
}

async function handleEmailVerification() {
  if (state.verifying || !state.verificationToken) return;
  state.verifying = true;
  elements.verificationButton.disabled = true;
  elements.verificationButton.textContent = "Completing...";
  showStatus("neutral", "Confirming registration.", "Please wait.");
  try {
    const result = await postJson(
      `${state.config.apiBaseUrl}/verify-registration-email`,
      { token: state.verificationToken },
      { timeoutMs: 30000 }
    );
    state.verificationToken = "";
    elements.verificationPanel.hidden = true;
    elements.pageTitle.textContent = "Registration complete";
    elements.pageIntroduction.textContent =
      "Thank you. Your email has been verified and your registration is confirmed.";
    const emailMessage = result.email?.actuallySent === true
      ? "A confirmation email has been sent. Please review your submitted information below."
      : result.email?.deliveryStatus === "failed"
        ? `Your registration is confirmed, but the confirmation email could not be sent. Please review the information below and contact ${state.config.supportEmail}.`
        : result.email?.deliveryMode === "preview_only"
          ? "Your registration is confirmed. Please review the information below; a confirmation email preview follows."
          : "Your registration is confirmed. Please review the information below while the confirmation email is processed.";
    showStatus("success", "Registration confirmed.", emailMessage);
    renderRegistrationSummary({
      ...result.registration,
      country: countryLabelForCode(result.registration?.countryCode)
    });
    elements.supportNote.textContent =
      `To request a correction or ask a question, email ${state.config.supportEmail} `
      + "from the email address used for this registration.";
    elements.supportNote.hidden = false;
    renderEmailPreview(result.email);
  } catch (error) {
    const confirmationTimedOut = error?.name === "AbortError";
    showStatus(
      confirmationTimedOut ? "neutral" : "error",
      confirmationTimedOut
        ? "Confirmation is taking longer than expected."
        : "Registration could not be confirmed.",
      confirmationTimedOut
        ? "Check your email for the confirmation message. If it has not arrived, select Complete Registration again."
        : error.publicMessage ?? "The verification link is invalid or expired."
    );
    elements.verificationButton.disabled = false;
    elements.verificationButton.textContent = "Complete Registration";
    elements.verificationButton.addEventListener("click", handleEmailVerification, { once: true });
  } finally {
    state.verifying = false;
  }
}

function renderRegistrationSummary(registration) {
  elements.summaryName.textContent = String(registration?.name ?? "");
  elements.summaryEmail.textContent = String(registration?.email ?? "");
  elements.summaryAffiliation.textContent = String(registration?.affiliation ?? "");
  elements.summaryCountry.textContent = String(registration?.country ?? "");
  elements.summaryStudent.textContent = registration?.isStudent === true ? "Yes" : "No";
  elements.summaryPresenter.textContent = registration?.isPresenter === true ? "Yes" : "No";
  elements.summaryPaperItem.hidden = registration?.isPresenter !== true;
  elements.summaryPaperTitle.textContent = String(registration?.paperTitle ?? "");
  elements.summaryInvitationLetter.textContent = registration?.requiresInvitationLetter === true
    ? "Required"
    : "Not required";
  elements.summary.hidden = false;
}

function countryLabelForCode(countryCode) {
  const code = String(countryCode ?? "").toUpperCase();
  return state.config?.countryOptions?.find((country) => country.code === code)?.label ?? code;
}

function readEmailVerificationRequest() {
  if (!globalThis.location.hash.startsWith("#verify?")) return null;
  const params = new URLSearchParams(globalThis.location.hash.slice("#verify?".length));
  const token = params.get("token") ?? "";
  globalThis.history.replaceState(null, "", `${globalThis.location.pathname}${globalThis.location.search}`);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? { token } : null;
}

function readStatusRequest() {
  if (!globalThis.location.hash.startsWith("#status?")) return null;
  const params = new URLSearchParams(globalThis.location.hash.slice("#status?".length));
  const registrationCode = params.get("registrationCode");
  const expires = params.get("expires");
  const signature = params.get("signature");
  return {
    registrationCode: registrationCode ?? "",
    expires: expires ?? "",
    signature: signature ?? ""
  };
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildPublicErrorMessage(responseBody) {
  const correlationId = responseBody?.correlationId;
  const errorCode = responseBody?.errorCode;
  if (errorCode === "RATE_LIMITED") {
    const retryAfter = Number(responseBody?.retryAfterSeconds);
    return Number.isFinite(retryAfter) && retryAfter > 0
      ? `Too many attempts. Please retry in about ${Math.ceil(retryAfter / 60)} minute(s).`
      : "Too many attempts. Please retry later.";
  }
  if (errorCode === "TURNSTILE_FAILED") {
    return "Verification failed. Complete the new verification and retry.";
  }
  if (errorCode === "TURNSTILE_UNAVAILABLE") {
    return "Verification is temporarily unavailable. Please retry shortly.";
  }
  if (errorCode === "STATUS_LINK_INVALID") {
    return "The registration status link is invalid or expired.";
  }
  if (errorCode === "REGISTRATION_ALREADY_EXISTS") {
    return "This email address is already registered for Oceanoise Asia 2026. Contact the organizing committee if you need to update your information.";
  }
  if (errorCode === "EMAIL_VERIFICATION_EXPIRED") {
    return `This verification link has expired. Contact ${state.config?.supportEmail ?? "the organizing committee"} for assistance.`;
  }
  if (
    errorCode === "EMAIL_VERIFICATION_INVALID" ||
    errorCode === "EMAIL_VERIFICATION_TOKEN_INVALID"
  ) {
    return "This verification link is invalid or has already been replaced.";
  }
  if (state.config?.environment !== "production" && errorCode) {
    return correlationId
      ? `Error: ${errorCode}. Correlation ID: ${correlationId}`
      : `Error: ${errorCode}.`;
  }
  return correlationId
    ? `Please retry later. Correlation ID: ${correlationId}`
    : "Please retry later.";
}

function summarizeErrors(errors) {
  const messages = Object.entries(errors).flatMap(([fieldName, fieldErrors]) =>
    fieldErrors.map((message) => `${fieldName}: ${message}`)
  );
  return messages.slice(0, 4).join(" ");
}

function showStatus(tone, title, message) {
  elements.statusBox.hidden = false;
  elements.statusBox.dataset.tone = tone;
  elements.statusTitle.textContent = title;
  elements.statusMessage.textContent = message;
}

function setSubmitting(isSubmitting) {
  state.submitting = isSubmitting;
  elements.submitButton.textContent = isSubmitting ? "Submitting..." : "Submit Registration";
  updateSubmitButton();
}

async function initializeTurnstile(config) {
  if (config.turnstileMode === "disabled") {
    state.turnstileToken = "local-turnstile-disabled";
    elements.turnstileContainer.hidden = true;
    updateSubmitButton();
    return;
  }
  if (!config.turnstileSiteKey) {
    throw new Error("TURNSTILE_SITE_KEY_MISSING");
  }

  elements.turnstileContainer.hidden = false;
  await loadTurnstileApi();
  state.turnstileWidgetId = globalThis.turnstile.render(elements.turnstileWidget, {
    sitekey: config.turnstileSiteKey,
    action: config.turnstileAction ?? "registration",
    callback(token) {
      state.turnstileToken = token;
      updateSubmitButton();
    },
    "expired-callback"() {
      state.turnstileToken = "";
      updateSubmitButton();
    },
    "error-callback"() {
      state.turnstileToken = "";
      updateSubmitButton();
      return true;
    }
  });
  updateSubmitButton();
}

function loadTurnstileApi() {
  if (globalThis.turnstile) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("TURNSTILE_SCRIPT_FAILED")), { once: true });
    document.head.append(script);
  });
}

function resetTurnstileChallenge() {
  if (state.config?.turnstileMode === "disabled") {
    state.turnstileToken = "local-turnstile-disabled";
  } else {
    state.turnstileToken = "";
    if (state.turnstileWidgetId !== null && globalThis.turnstile) {
      globalThis.turnstile.reset(state.turnstileWidgetId);
    }
  }
  updateSubmitButton();
}

function updateSubmitButton() {
  const waitingForTurnstile =
    state.config?.turnstileMode !== "disabled" && state.turnstileToken.length === 0;
  elements.submitButton.disabled = state.submitting || waitingForTurnstile;
}

function createUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
