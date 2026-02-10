import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach the Supabase JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Auth Errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized: Token expired or invalid
      localStorage.clear();
      window.location.href = "/login";
    }
    if (error.response?.status === 403) {
      // Forbidden: Trying to access Admin/Teacher routes without permission
      console.error("Access Denied: Insufficient permissions");
    }
    return Promise.reject(error);
  }
);