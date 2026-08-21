import { Link } from "react-router-dom";
import { Landmark } from "lucide-react";
import { Card } from "./Card";
import Button from "./Button";

export default function AccountingGate({ enabled, children }) {
  if (enabled) return children;

  return (
    <Card className="acct-gate">
      <Landmark size={28} />
      <h3>Accounting is not configured yet</h3>
      <p>
        Open Settings → Accounting and run the short setup wizard. After that, sales, purchases,
        expenses, and partner capital will post to the general ledger automatically.
      </p>
      <Link to="/settings">
        <Button>Open Accounting settings</Button>
      </Link>
    </Card>
  );
}
