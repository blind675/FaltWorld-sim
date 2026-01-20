// API base URL from environment variable
export function getApiUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
}
