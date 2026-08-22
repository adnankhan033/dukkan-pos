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
        Accounting is not configured yet. Open Settings → Modules to install it, then finish Settings →
        Accounting so sales, purchases, and expenses post to the books.
      </p>
      <Link to="/settings?tab=accounting">
        <Button>Open setup</Button>
      </Link>
    </Card>
  );
}
