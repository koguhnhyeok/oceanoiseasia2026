export const REGISTRATION_API_VERSION = 6;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const ALLOWED_REGISTRATION_FIELDS = new Set([
  "apiVersion",
  "eventId",
  "name",
  "email",
  "affiliation",
  "countryCode",
  "isStudent",
  "isPresenter",
  "paperTitle",
  "requiresInvitationLetter",
  "clientSubmissionId",
  "turnstileToken"
]);

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function maskEmail(email) {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) {
    return "[invalid-email]";
  }
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const visibleLocal = local.length <= 2 ? local[0] ?? "*" : `${local[0]}${local.at(-1)}`;
  return `${visibleLocal}***@${domain}`;
}

export function escapeCsvCell(value) {
  const text = String(value ?? "");
  const escapedForFormula = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\r\n]/.test(escapedForFormula)) {
    return `"${escapedForFormula.replaceAll('"', '""')}"`;
  }
  return escapedForFormula;
}

export function validateRegistrationInput(input, options = {}) {
  const errors = {};

  if (!isPlainObject(input)) {
    return invalid({ _form: ["Request body must be a JSON object."] });
  }

  const extraFields = Object.keys(input).filter(
    (fieldName) => !ALLOWED_REGISTRATION_FIELDS.has(fieldName)
  );
  if (extraFields.length > 0) {
    errors._form = [`Unexpected field(s): ${extraFields.join(", ")}`];
  }

  const allowedCountryCodes = new Set(options.countryCodes ?? []);

  const apiVersion = Number(input.apiVersion);
  if (apiVersion !== REGISTRATION_API_VERSION) {
    addError(errors, "apiVersion", `apiVersion must be ${REGISTRATION_API_VERSION}.`);
  }

  const eventId = trimString(input.eventId);
  if (options.eventId && eventId !== options.eventId) {
    addError(errors, "eventId", "Unknown event.");
  }

  const name = trimString(input.name);
  if (name.length < 1 || name.length > 100) {
    addError(errors, "name", "Name must be 1-100 characters.");
  }

  const email = trimString(input.email);
  const emailNormalized = normalizeEmail(email);
  if (emailNormalized.length < 3 || emailNormalized.length > 254 || !EMAIL_PATTERN.test(emailNormalized)) {
    addError(errors, "email", "Email address is not valid.");
  }

  const affiliation = trimString(input.affiliation);
  if (affiliation.length < 1 || affiliation.length > 200) {
    addError(errors, "affiliation", "Affiliation must be 1-200 characters.");
  }

  const countryCode = trimString(input.countryCode).toUpperCase();
  if (!COUNTRY_CODE_PATTERN.test(countryCode)) {
    addError(errors, "countryCode", "Country must be a two-letter ISO code.");
  } else if (allowedCountryCodes.size > 0 && !allowedCountryCodes.has(countryCode)) {
    addError(errors, "countryCode", "Country is not enabled for this event configuration.");
  }

  const isStudent = input.isStudent;
  if (typeof isStudent !== "boolean") {
    addError(errors, "isStudent", "Student status must be selected.");
  }

  const isPresenter = input.isPresenter;
  if (typeof isPresenter !== "boolean") {
    addError(errors, "isPresenter", "Presenter status must be selected.");
  }

  const paperTitle = trimString(input.paperTitle);
  if (isPresenter === true && (paperTitle.length < 1 || paperTitle.length > 300)) {
    addError(errors, "paperTitle", "Abstract title is required for presenters and must be 1-300 characters.");
  } else if (isPresenter === false && paperTitle.length > 0) {
    addError(errors, "paperTitle", "Abstract title must be empty for non-presenters.");
  }

  const requiresInvitationLetter = input.requiresInvitationLetter;
  if (typeof requiresInvitationLetter !== "boolean") {
    addError(errors, "requiresInvitationLetter", "Invitation letter requirement must be provided.");
  }

  const clientSubmissionId = trimString(input.clientSubmissionId);
  if (!UUID_PATTERN.test(clientSubmissionId)) {
    addError(errors, "clientSubmissionId", "clientSubmissionId must be a UUID.");
  }

  const turnstileToken =
    input.turnstileToken === undefined ? "" : trimString(input.turnstileToken);
  if (options.turnstileRequired && turnstileToken.length === 0) {
    addError(errors, "turnstileToken", "Turnstile verification is required.");
  } else if (turnstileToken.length > 2048) {
    addError(errors, "turnstileToken", "Turnstile token is too long.");
  }

  if (Object.keys(errors).length > 0) {
    return invalid(errors);
  }

  return {
    ok: true,
    value: {
      apiVersion,
      eventId,
      name,
      email,
      emailNormalized,
      affiliation,
      countryCode,
      isStudent,
      isPresenter,
      paperTitle: isPresenter ? paperTitle : null,
      requiresInvitationLetter,
      clientSubmissionId,
      turnstileToken
    }
  };
}

function invalid(errors) {
  return { ok: false, errors };
}

function addError(errors, fieldName, message) {
  errors[fieldName] = [...(errors[fieldName] ?? []), message];
}

function trimString(value) {
  return String(value ?? "").trim();
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
