import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const VALID_LOGIN = import.meta.env.VITE_AUTH_LOGIN as string;
const VALID_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD as string;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      login: (username, password) => {
        if (username === VALID_LOGIN && password === VALID_PASSWORD) {
          set({ isAuthenticated: true });
          return true;
        }
        return false;
      },
      logout: () => set({ isAuthenticated: false }),
    }),
    {
      name: "raillens-auth",
    },
  ),
);
