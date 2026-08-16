import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import ConfirmDialog from "../common/ConfirmDialog";
import { isDesktopApp } from "../../utils/environment";
import { isPrintSessionActive } from "../../utils/printGuard";

/**
 * Intercepts Tauri window close (X button, Cmd+Q, Alt+F4) and shows an in-app confirm dialog.
 */
export default function AppCloseGuard({ children }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const unlistenRef = useRef(null);

  useEffect(() => {
    if (!isDesktopApp()) return undefined;

    (async () => {
      try {
        unlistenRef.current = await getCurrentWebviewWindow().onCloseRequested((event) => {
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
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, []);

  async function handleConfirmClose() {
    setConfirmOpen(false);
    unlistenRef.current?.();
    unlistenRef.current = null;

    try {
      await invoke("quit_app");
    } catch {
      try {
        await getCurrentWebviewWindow().destroy();
      } catch {
        setConfirmOpen(true);
      }
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
