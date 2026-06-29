/**
 * stores/auth.ts - 认证状态 Store
 * 使用 immer 中间件处理不可变更新
 */
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface User {
  id: string;
  address: string;
  ensName?: string;
  avatar?: string;
  role: "admin" | "user" | "viewer";
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  login: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateUser: (updates: Partial<User>) => void;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: false,
  error: null,
};

export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectUser = (state: AuthState) => state.user;
export const selectUserRole = (state: AuthState) => state.user?.role ?? null;
export const selectIsAdmin = (state: AuthState) => state.user?.role === "admin";
export const selectAuthLoading = (state: AuthState) => state.isLoading;
export const selectAuthError = (state: AuthState) => state.error;

export const useAuthStore = create<AuthState & AuthActions>()(
  immer((set) => ({
    ...initialState,

    login: (user) =>
      set((state) => {
        // [Fix] Validate user structure before accepting
        if (!user || typeof user !== 'object' || typeof user.address !== 'string' || !user.role || typeof user.id !== 'string') {
          state.error = 'Invalid user data';
          return;
        }
        state.isAuthenticated = true;
        state.user = user;
        state.error = null;
        state.isLoading = false;
      }),

    logout: () =>
      set((state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.error = null;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        if (error) {
          state.isLoading = false;
        }
      }),

    updateUser: (updates) =>
      set((state) => {
        if (state.user) {
          // [Fix] Sanitize updates: only allow known fields
          const allowed: Partial<User> = {};
          if (updates.ensName !== undefined) allowed.ensName = updates.ensName;
          if (updates.avatar !== undefined) allowed.avatar = updates.avatar;
          if (updates.role !== undefined && ['admin', 'user', 'viewer'].includes(updates.role)) {
            allowed.role = updates.role;
          }
          Object.assign(state.user, allowed);
        }
      }),
  }))
);

export default useAuthStore;
