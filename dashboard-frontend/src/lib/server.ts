// Centralized API base URL for frontend requests
// Uses NEXT_PUBLIC_API_URL if set, otherwise defaults to production or dev

const API_BASE_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
    : process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:8080";

export function apiUrl(path: string) {
  if (path.startsWith("/")) {
    return `${API_BASE_URL}${path}`;
  }
  return `${API_BASE_URL}/${path}`;
}

export { API_BASE_URL };
