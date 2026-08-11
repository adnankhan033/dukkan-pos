import { Briefcase, MapPin, Phone, User } from "lucide-react";
import Badge from "../common/Badge";
import { formatDate } from "../../utils/format";
import "./EmployeeCard.css";

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export default function EmployeeCard({ employee, currency, payroll, onClick }) {
  return (
    <button type="button" className="employee-card" onClick={() => onClick(employee)}>
      <div className="employee-card-top">
        <div className="employee-card-avatar">
          {employee.photo ? (
            <img src={employee.photo} alt={employee.full_name} />
          ) : (
            <span>{initials(employee.full_name)}</span>
          )}
        </div>
        <div className="employee-card-head">
          <h3>{employee.full_name}</h3>
          {employee.designation && (
            <span className="employee-card-designation">{employee.designation}</span>
          )}
          <Badge variant={employee.is_current ? "success" : "neutral"}>
            {employee.is_current ? "Working" : "Finished"}
          </Badge>
        </div>
      </div>

      <div className="employee-card-meta">
        {employee.phone && (
          <span><Phone size={14} /> {employee.phone}</span>
        )}
        {employee.iqama_number && (
          <span><User size={14} /> Iqama {employee.iqama_number}</span>
        )}
        {employee.address && (
          <span><MapPin size={14} /> {employee.address}</span>
        )}
        {employee.start_date && (
          <span><Briefcase size={14} /> Since {formatDate(employee.start_date)}</span>
        )}
      </div>

      {payroll && (
        <div className="employee-card-payroll">
          <div>
            <span>Paid</span>
            <strong>{Number(payroll.salaryTotal || 0).toFixed(2)} {currency}</strong>
          </div>
          <div>
            <span>Advances</span>
            <strong>{Number(payroll.advanceTotal || 0).toFixed(2)} {currency}</strong>
          </div>
        </div>
      )}
    </button>
  );
}
