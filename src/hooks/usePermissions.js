import { useMemo } from "react";
import { useAuthStore } from "../contexts/store";
import { useSettingsStore } from "../contexts/store";
import { NAV_GROUPS } from "../utils/constants";
import { canAccessModule, canAccessPath, isModuleEnabled } from "../utils/modules";
import { isAdmin, normalizeRole } from "../utils/roles";

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);

  return useMemo(
    () => ({
      user,
      role: normalizeRole(user?.role),
      isAdmin: isAdmin(user),
      canAccessModule: (moduleId) => canAccessModule(user, settings, moduleId),
      canAccessPath: (path) => canAccessPath(user, settings, path),
      isModuleEnabled: (moduleId) => isModuleEnabled(settings, moduleId),
    }),
    [user, settings]
  );
}

export function useVisibleNavGroups() {
  const { user, canAccessModule } = usePermissions();
  const settings = useSettingsStore((s) => s.settings);

  return useMemo(() => {
    return NAV_GROUPS.map((group) => {
      if (group.module && !canAccessModule(group.module)) return null;

      if (group.items) {
        const items = group.items.filter((item) => {
          const moduleId = item.module || group.module;
          if (!moduleId) return true;
          return canAccessModule(moduleId);
        });
        if (items.length === 0) return null;
        return { ...group, items };
      }

      return group;
    }).filter(Boolean);
  }, [user, settings, canAccessModule]);
}
