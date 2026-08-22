import { ArrowLeft } from "lucide-react";
import { useAppBack } from "./AppBackProvider";
import "./PageBackButton.css";

export default function PageBackButton({ className = "" }) {
  const { showBack, goBack } = useAppBack();
  if (!showBack) return null;

  return (
    <button
      type="button"
      className={`page-back-btn ${className}`.trim()}
      onClick={goBack}
      aria-label="Back to previous page"
    >
      <ArrowLeft size={16} />
      <span>Back</span>
    </button>
  );
}
