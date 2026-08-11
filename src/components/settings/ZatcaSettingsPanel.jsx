import ZatcaUnifiedSetup from "./ZatcaUnifiedSetup";

export default function ZatcaSettingsPanel({ form, updateField, baseSettings, saveForm }) {
  return (
    <ZatcaUnifiedSetup
      form={form}
      updateField={updateField}
      baseSettings={baseSettings}
      saveForm={saveForm}
    />
  );
}
