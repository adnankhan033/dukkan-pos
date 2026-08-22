import { Link } from "react-router-dom";
import { Landmark } from "lucide-react";
import { Card } from "./Card";
import Button from "./Button";

export default function AccountingGate({ enabled, children }) {
  if (enabled) return children;

  return (
    <Card className="acct-gate">
      <Landmark size={28} />
      <h3>Turn on books</h3>
      <p>
        Books were reset when data was cleared. Open Settings → Accounting and finish setup so
        sales, purchases, and expenses are recorded again.
      </p>
      <Link to="/settings">
        <Button>Open setup</Button>
      </Link>
    </Card>
  );
}
