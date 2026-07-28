import { Alert } from "./Loading";

/** Shown at the top of modal forms when validation fails. */
export default function FormValidationAlert({ errors }) {
  if (!errors?.form) return null;
  return (
    <Alert style={{ marginBottom: "1rem" }}>
      {errors.form}
    </Alert>
  );
}
