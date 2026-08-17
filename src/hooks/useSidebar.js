import { useEffect } from "react";
import { useSidebarStore } from "../contexts/store";

export function useSidebar() {
  const mode = useSidebarStore((s) => s.mode);
  const setMode = useSidebarStore((s) => s.setMode);
  const expand = useSidebarStore((s) => s.expand);
  const collapseToMini = useSidebarStore((s) => s.collapseToMini);
  const hide = useSidebarStore((s) => s.hide);
  const toggle = useSidebarStore((s) => s.toggle);
  const cycleMode = useSidebarStore((s) => s.cycleMode);

  const isExpanded = mode === "expanded";
  const isMini = mode === "mini";
  const isHidden = mode === "hidden";

  useEffect(() => {
    document.documentElement.dataset.sidebarMode = mode;
    return () => {
      delete document.documentElement.dataset.sidebarMode;
    };
  }, [mode]);

  useEffect(() => {
    function onKeyDown(event) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.key.toLowerCase() !== "b") return;
      event.preventDefault();
      if (event.shiftKey) {
        cycleMode();
      } else {
        toggle();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, cycleMode]);

  return {
    mode,
    setMode,
    expand,
    collapseToMini,
    hide,
    toggle,
    cycleMode,
    isExpanded,
    isMini,
    isHidden,
  };
}
