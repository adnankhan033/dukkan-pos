import { useEffect, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import ConfirmDialog from "../common/ConfirmDialog";
import { isDesktopApp } from "../../utils/environment";
import { isPrintSessionActive } from "../../utils/printGuard";

/**
 * Intercepts Tauri window close (X button, Cmd+Q, Alt+F4) and shows an in-app confirm dialog.
 */
export default function AppCloseGuard({ children }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!isDesktopApp()) return undefined;

    let unlisten;
    (async () => {
      try {
        unlisten = await getCurrentWebviewWindow().onCloseRequested((event) => {
          if (closingRef.current) return;

          if (isPrintSessionActive()) {
            event.preventDefault();
            return;
          }

          event.preventDefault();
          setConfirmOpen(true);
        });
      } catch {
        // Browser dev mode or unsupported runtime.
      }
    })();

    return () => {
      unlisten?.();
    };
  }, []);

  async function handleConfirmClose() {
    closingRef.current = true;
    setConfirmOpen(false);

    try {
      const window = getCurrentWebviewWindow();
      await window.close();
    } catch {
      closingRef.current = false;
    }
  }

  function handleStayOpen() {
    setConfirmOpen(false);
  }

  return (
    <>
      {children}
      {confirmOpen && (
        <ConfirmDialog
          title="Close Dukkan POS?"
          message="Are you sure you want to quit? Unsaved changes in open forms may be lost."
          confirmLabel="Close App"
          cancelLabel="Stay Open"
          variant="danger"
          onConfirm={handleConfirmClose}
          onCancel={handleStayOpen}
        />
      )}
    </>
  );
}
