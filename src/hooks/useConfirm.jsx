import { useCallback, useRef, useState } from "react";
import ConfirmDialog from "../components/common/ConfirmDialog";

/**
 * Promise-based confirm dialog — replaces window.confirm (broken in Tauri webview).
 */
export function useConfirm() {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback(
    ({ title = "Confirm", message, confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "danger" }) =>
      new Promise((resolve) => {
        resolverRef.current = resolve;
        setState({ title, message, confirmLabel, cancelLabel, variant });
      }),
    []
  );

  const close = useCallback((result) => {
    setState(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const dialog = state ? (
    <ConfirmDialog
      {...state}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null;

  return { confirm, dialog };
}
