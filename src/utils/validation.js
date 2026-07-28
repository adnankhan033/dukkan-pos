export function required(value, fieldName = "Field") {
  if (value === null || value === undefined || String(value).trim() === "") {
    return `${fieldName} is required`;
  }
  return null;
}

export function positiveNumber(value, fieldName = "Value") {
  if (value === null || value === undefined || String(value).trim() === "") {
    return `${fieldName} is required`;
  }
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    return `${fieldName} must be zero or greater`;
  }
  return null;
}

export function email(value) {
  if (!value || String(value).trim() === "") return null;
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(value)) return "Invalid email address";
  return null;
}

export function validateFields(rules) {
  const errors = {};
  for (const [field, message] of Object.entries(rules)) {
    if (message) errors[field] = message;
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export const FORM_VALIDATION_MESSAGE =
  "Please fill in all required fields highlighted below.";

/** Run field rules and attach a top-of-form summary when invalid. */
export function runFormValidation(rules) {
  const result = validateFields(rules);
  if (!result.isValid) {
    result.errors.form = FORM_VALIDATION_MESSAGE;
  }
  return result;
}
