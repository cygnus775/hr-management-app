"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { API_CONFIG, AUTH_CONFIG } from "@/lib/config"

interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: "admin" | "manager" | "employee"
}

interface AuthContextType {
  user: User | null
  token: string | null
  logout: () => void
  isLoading: boolean
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_BASE_URL = API_CONFIG.BASE_URL
const TOKEN_KEY = AUTH_CONFIG.TOKEN_KEY
const USER_KEY = AUTH_CONFIG.USER_KEY
const TOKEN_EXPIRY_KEY = AUTH_CONFIG.TOKEN_EXPIRY_KEY

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Enhanced fetchWithAuth with better error handling
  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const currentToken = token || localStorage.getItem(TOKEN_KEY)

    if (!currentToken) {
      throw new Error("No authentication token available")
    }

    // Ensure URL is absolute
    const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentToken}`,
      "ngrok-skip-browser-warning": "true",
      ...options.headers,
    }

    try {
      console.log("Making authenticated request to:", fullUrl)

      // Create a controller to implement timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT) // Use config timeout

      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId)
      })

      console.log("Response status:", response.status)

      // Handle authentication errors
      if (response.status === 401) {
        console.warn("Authentication failed, logging out...")
        logout()
        throw new Error("Authentication failed")
      }

      return response
    } catch (error) {
      console.error("Fetch error:", error)

      // Create a mock response for components to handle
      const mockResponse = new Response(
        JSON.stringify({
          error: "API unavailable",
          message: "Could not connect to API server",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      )

      // If this is a validation request, don't throw
      if (url.includes("/api/v1/employees/me/profile")) {
        return mockResponse
      }

      throw error
    }
  }

  // Validate session with server
  const validateSession = async (storedToken: string): Promise<boolean> => {
    try {
      console.log("Validating session...")

      const response = await fetch(`${API_BASE_URL}/api/v1/employees/me/profile`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
          "ngrok-skip-browser-warning": "true",
          Accept: "application/json",
        },
        mode: "cors",
        credentials: "omit",
      })

      console.log("Session validation response:", response.status)

      if (response.ok) {
        const contentType = response.headers.get("content-type")
        if (contentType && contentType.includes("application/json")) {
          const profileData = await response.json()
          console.log("Profile data received:", { ...profileData, user_email: "[REDACTED]" })

          // Extract user info from profile response
          const userData: User = {
            id: profileData.user_id,
            email: profileData.user_email,
            first_name: profileData.user_first_name,
            last_name: profileData.user_last_name,
            role: profileData.user_role,
          }

          setUser(userData)
          setToken(storedToken)
          localStorage.setItem(USER_KEY, JSON.stringify(userData))
          return true
        } else {
          console.error("Expected JSON response for profile")
          return false
        }
      }
      return false
    } catch (error) {
      console.error("Session validation failed:", error)
      return false
    }
  }

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Skip auth check on login page
        if (pathname === "/login") {
          setIsLoading(false)
          return
        }

        const storedToken = localStorage.getItem(TOKEN_KEY)
        const storedUser = localStorage.getItem(USER_KEY)
        const tokenExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY)

        if (storedToken && storedUser && tokenExpiry) {
          const expiryTime = Number.parseInt(tokenExpiry)
          const now = Date.now()

          // Check if token is expired
          if (now >= expiryTime) {
            console.log("Token expired, clearing session")
            logout()
            return
          }

          // Try to restore from localStorage first
          try {
            const userData = JSON.parse(storedUser)
            setUser(userData)
            setToken(storedToken)
            console.log("Session restored from localStorage")
          } catch (parseError) {
            console.error("Error parsing stored user data:", parseError)
            logout()
            return
          }

          // Validate session with server in background
          const isValid = await validateSession(storedToken)
          if (!isValid) {
            console.log("Session validation failed, clearing session")
            logout()
            return
          }

          console.log("Session validated successfully")
        } else {
          // No stored session, redirect to login
          console.log("No stored session found")
          router.push("/login")
        }
      } catch (error) {
        console.error("Auth initialization error:", error)
        logout()
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [pathname, router])

  const logout = () => {
    console.log("Logging out...")
    setUser(null)
    setToken(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)

    if (pathname !== "/login") {
      router.push("/login")
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        logout,
        isLoading,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
