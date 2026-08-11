import { CalendarDays, List } from "lucide-react";
import { Input, Select } from "../common/Input";
import {
  MONTH_OPTIONS,
  getDayOptions,
  getYearOptions,
  splitIsoDate,
  buildIsoDate,
} from "../../utils/subscriptions";
import "./SubscriptionDatePicker.css";

export default function SubscriptionDatePicker({
  label,
  value,
  onChange,
  useCalendar = false,
  onModeChange,
}) {
  const parts = splitIsoDate(value);
  const years = getYearOptions();
  const days = getDayOptions(parts.year, parts.month);

  function updateParts(nextParts) {
    onChange(buildIsoDate({ ...parts, ...nextParts }));
  }

  return (
    <div className="subscription-date-picker">
      <div className="subscription-date-picker-header">
        <span className="subscription-date-picker-label">{label}</span>
        <div className="subscription-date-mode-toggle">
          <button
            type="button"
            className={`subscription-date-mode-option ${!useCalendar ? "active" : ""}`}
            onClick={() => onModeChange(false)}
          >
            <List size={14} />
            Dropdown
          </button>
          <button
            type="button"
            className={`subscription-date-mode-option ${useCalendar ? "active" : ""}`}
            onClick={() => onModeChange(true)}
          >
            <CalendarDays size={14} />
            Calendar
          </button>
        </div>
      </div>

      {useCalendar ? (
        <Input
          label="Pick date"
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="subscription-date-dropdowns">
          <Select
            label="Year"
            value={String(parts.year)}
            onChange={(e) => updateParts({ year: Number(e.target.value) })}
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </Select>
          <Select
            label="Month"
            value={String(parts.month)}
            onChange={(e) => updateParts({ month: Number(e.target.value) })}
          >
            {MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </Select>
          <Select
            label="Day"
            value={String(parts.day)}
            onChange={(e) => updateParts({ day: Number(e.target.value) })}
          >
            {days.map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
