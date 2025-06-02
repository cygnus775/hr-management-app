// Central configuration file for environment variables and settings

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  TIMEOUT: 100000, // 100 seconds
  RETRY_ATTEMPTS: 3,
}

// Authentication Configuration
export const AUTH_CONFIG = {
  TOKEN_KEY: "hr_auth_token",
  USER_KEY: "hr_user_data",
  TOKEN_EXPIRY_KEY: "hr_token_expiry",
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
}

// Feature Flags
export const FEATURES = {
  ENABLE_NOTIFICATIONS: process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === "true",
  ENABLE_OFFLINE_MODE: process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE !== "false",
  ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",
}

// Application Settings
export const APP_CONFIG = {
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "HR Management System",
  COMPANY_NAME: process.env.NEXT_PUBLIC_COMPANY_NAME || "Your Company",
  SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com",
  DEFAULT_PAGINATION_LIMIT: 100,
}
