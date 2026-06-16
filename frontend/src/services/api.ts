import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import type { PetState } from "../types";
import type { UpdateProfilePayload } from '../types';
import { USE_MOCK_BACKEND } from "../config/backend";

const AUTH_USER_KEY = 'auth_user';
const PET_STATE_KEY = 'petState';

const getCurrentUserId = (): number | null => {
  try {
    const rawUser = localStorage.getItem(AUTH_USER_KEY);
    if (!rawUser) {
      return null;
    }

    const parsedUser = JSON.parse(rawUser) as { id?: number };
    return typeof parsedUser.id === 'number' ? parsedUser.id : null;
  } catch {
    return null;
  }
};

const getScopedStorageKey = (key: string, userId: number | null): string => (
  userId === null ? key : `${key}:${userId}`
);

export const api = axios.create({
  baseURL: "/api", // Proxied through nginx in Docker or dev server
  withCredentials: true, // Include cookies in requests (for session management if needed)
  headers: {
    "Content-Type": "application/json", // Default content type for POST/PUT requests
  },
});

// Example : 
// api.get("/user") // will make a GET request to http://localhost:3000/user
// api.post("/login", { username: "test", password: "1234" }) // will make a POST request to http://localhost:3000/login with the given body
// api.put("/user/1", { email: "example@hotmail.fr" }) // will make a PUT request to http://localhost:3000/user/1 with the given body

// Token getter - will be set by useAuth
// Variable to hold the functions that will be set by useAuth
let getTokenFn: (() => string | null) | null = null;
let triggerLogoutFn: (() => void) | null = null;

export const setAuthFunctions = (
  getToken: () => string | null,
  triggerLogout: () => void
) => {
  getTokenFn = getToken;
  triggerLogoutFn = triggerLogout;
};

// The hook useAuth will call setAuthFunctions to provide the token getter and logout function to this module, which will be used in the interceptors below. 
// This way, we can keep the API logic separate from the authentication logic, while still allowing the API module to access the current token and trigger logout when needed (e.g., on 401 responses).

// Request interceptor - inject Authorization header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getTokenFn?.();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Interceptor is set up in useAuth to trigger logout on 401 responses, 
// which typically indicate an expired or invalid token. This allows the app to automatically 
// log out the user and clear their session if their token is no longer valid, improving security 
// and user experience.
// Interceptor are used to handle common logic for all API requests/responses, 
// such as adding auth headers or handling errors globally, without having to repeat that logic in every API call throughout the app.
// Between the request and the server response, the request interceptor will add the Authorization header with the current token (if available), 
// and the response interceptor will check for 401 errors to trigger a logout if the token is invalid or expired. 
// This centralizes the authentication handling logic in one place, making it easier to maintain and ensuring consistent behavior across all API interactions.

// Response interceptor - handle 401 (logout local)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - logout user
      triggerLogoutFn?.();
    }
    return Promise.reject(error);
  }
);

// Pet state API Functions

export const petAPI = {
  // Load pet state from the server database (called on user login to restore previous session)
  getPetState: async () => {
    if (USE_MOCK_BACKEND) {
      const userId = getCurrentUserId();
      const rawPetState = localStorage.getItem(getScopedStorageKey(PET_STATE_KEY, userId));
      return { data: rawPetState ? JSON.parse(rawPetState) as PetState : null };
    }

    return api.get<PetState>('/pets/state');
  },

  // Save pet state to the server database (called on user logout)
  updatePetState: async (petState: PetState) => {
    if (USE_MOCK_BACKEND) {
      const userId = getCurrentUserId();
      localStorage.setItem(getScopedStorageKey(PET_STATE_KEY, userId), JSON.stringify(petState));
      return { data: petState };
    }

    return api.put<PetState>('/pets/state', petState);
  },
};

// User API functions
export const userAPI = {
  // Update user profile (username / password / avatar)
  updateProfile: async (payload: UpdateProfilePayload) => {
    if (USE_MOCK_BACKEND) {
      const rawUser = localStorage.getItem(AUTH_USER_KEY);
      const user = rawUser ? JSON.parse(rawUser) : null;
      const updatedUser = user
        ? {
            ...user,
            username: payload.newUsername ?? user.username,
            avatarUrl: payload.newAvatarUrl ?? user.avatarUrl,
          }
        : null;

      if (updatedUser) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
        window.dispatchEvent(new Event('auth-storage-changed'));
      }

      return { data: { user: updatedUser } };
    }

    return api.put('/users/profile', payload);
  },
};
