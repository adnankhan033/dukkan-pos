import { useCallback, useRef, useState } from "react";

/** Prevents double-clicks from creating duplicate records. */
export function useSubmitGuard() {
  const [submitting, setSubmitting] = useState(false);
  const busyRef = useRef(false);

  const guard = useCallback(async (fn) => {
    if (busyRef.current) return { skipped: true };
    busyRef.current = true;
    setSubmitting(true);
    try {
      const result = await fn();
      return { skipped: false, result };
    } finally {
      busyRef.current = false;
      setSubmitting(false);
    }
  }, []);

  return { submitting, guard };
}
