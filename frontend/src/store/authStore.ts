import { create } from "zustand";
import type { User } from "@/types/auth";

interface AuthStore {
  user: User | null;
  isHydrated: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isHydrated: false,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
  setHydrated: () => set({ isHydrated: true }),
}));
