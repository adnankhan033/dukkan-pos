import { useMemo } from "react";
import { useAuthStore } from "../contexts/store";
import { useSettingsStore } from "../contexts/store";
import { NAV_GROUPS } from "../utils/constants";
import { canAccessModule, canAccessPath, canAccessMenuItem, isModuleEnabled } from "../utils/modules";
import { canPerformAction } from "../utils/actions";
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
      canAccessMenuItem: (menuItemId) => canAccessMenuItem(user, settings, menuItemId),
      canAccessPath: (path) => canAccessPath(user, settings, path),
      isModuleEnabled: (moduleId) => isModuleEnabled(settings, moduleId),
      canPerformAction: (actionId) => canPerformAction(user, settings, actionId),
    }),
    [user, settings]
  );
}

export function useVisibleNavGroups() {
  const { user, canAccessModule, canAccessMenuItem } = usePermissions();
  const settings = useSettingsStore((s) => s.settings);

  return useMemo(() => {
    return NAV_GROUPS.map((group) => {
      if (group.items) {
        const items = group.items.filter((item) => {
          if (item.id) return canAccessMenuItem(item.id);
          const moduleId = item.module || group.module;
          if (!moduleId) return true;
          return canAccessModule(moduleId);
        });
        if (items.length === 0) return null;
        return { ...group, items };
      }

      if (group.module && !canAccessModule(group.module)) return null;
      if (group.id && !canAccessMenuItem(group.id)) return null;

      return group;
    }).filter(Boolean);
  }, [user, settings, canAccessModule, canAccessMenuItem]);
}
