import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      terminal: null,
      drupalConnected: false,
      isAuthenticated: false,
      login: (user, session) => {
        const safeSession = session && typeof session === "object" ? session : {};
        set({
          user,
          token: safeSession.token ?? null,
          terminal: safeSession.terminal ?? null,
          drupalConnected: Boolean(safeSession.token),
          isAuthenticated: true,
        });
      },
      setDrupalProfile: (user, terminal) =>
        set((state) => ({
          user,
          terminal: terminal ?? null,
          drupalConnected: Boolean(state.token),
        })),
      logout: () =>
        set({
          user: null,
          token: null,
          terminal: null,
          drupalConnected: false,
          isAuthenticated: false,
        }),
    }),
    { name: "dukkan-pos-auth" }
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
    { name: "dukkan-pos-theme" }
  )
);

export const useSettingsStore = create((set) => ({
  settings: {},
  setSettings: (settings) => set({ settings }),
}));

export const useAppStore = create((set) => ({
  dbReady: false,
  dbError: null,
  setDbReady: (ready) => set({ dbReady: ready }),
  setDbError: (error) => set({ dbError: error }),
}));
