import { create } from "zustand";
import { persist } from "zustand/middleware";

function normalizeAuthState(state = {}) {
  const user = state.user?.username ? state.user : null;
  return {
    user,
    isAuthenticated: Boolean(user),
  };
}

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => {
        if (!user?.username) return;
        set({ user, isAuthenticated: true });
      },
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "nexttel-pos-auth",
      version: 2,
      migrate: (persistedState, version) => {
        if (version < 2) {
          return { user: null, isAuthenticated: false };
        }
        return normalizeAuthState(persistedState);
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeAuthState(persistedState),
      }),
    }
  )
);

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: "light",
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "nexttel-pos-theme" }
  )
);

export const useSettingsStore = create((set) => ({
  settings: {},
  setSettings: (settings) => set({ settings }),
  mergeSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...(partial || {}) },
    })),
}));

export const useAppStore = create((set) => ({
  dbReady: false,
  dbError: null,
  setDbReady: (ready) => set({ dbReady: ready }),
  setDbError: (error) => set({ dbError: error }),
}));

/** expanded = full labels, mini = icon rail, hidden = off-screen */
export const useSidebarStore = create(
  persist(
    (set, get) => ({
      mode: "expanded",
      setMode: (mode) => set({ mode }),
      expand: () => set({ mode: "expanded" }),
      collapseToMini: () => set({ mode: "mini" }),
      hide: () => set({ mode: "hidden" }),
      toggle: () => {
        const mode = get().mode;
        if (mode === "expanded") set({ mode: "mini" });
        else if (mode === "mini") set({ mode: "expanded" });
        else set({ mode: "expanded" });
      },
      cycleMode: () => {
        const mode = get().mode;
        if (mode === "expanded") set({ mode: "mini" });
        else if (mode === "mini") set({ mode: "hidden" });
        else set({ mode: "expanded" });
      },
    }),
    { name: "nexttel-pos-sidebar", version: 1 }
  )
);
