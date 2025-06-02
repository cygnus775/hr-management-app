"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Building2, Loader2 } from "lucide-react"

const API_BASE_URL = "http://localhost:8000"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("username", email)
      formData.append("password", password)

      console.log("Attempting login to:", `${API_BASE_URL}/api/v1/auth/token`)

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/token`, {
        method: "POST",
        body: formData,
        headers: {
          // Add ngrok bypass header if needed
          "ngrok-skip-browser-warning": "true",
          Accept: "application/json",
        },
        mode: "cors",
        credentials: "omit",
      })

      console.log("Response status:", response.status)
      console.log("Response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = "Login failed"

        try {
          const contentType = response.headers.get("content-type")
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json()
            errorMessage = errorData?.detail || errorData?.message || `HTTP ${response.status}: ${response.statusText}`
          } else {
            // If not JSON, get text response
            const textResponse = await response.text()
            console.log("Non-JSON response:", textResponse)
            errorMessage = `Server error (${response.status}): ${response.statusText}`
          }
        } catch (parseError) {
          console.error("Error parsing response:", parseError)
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }

        setError(errorMessage)
        return
      }

      // Check if response is JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Expected JSON response but got:", contentType)
        const textResponse = await response.text()
        console.log("Response body:", textResponse)
        setError("Invalid response format from server")
        return
      }

      const data = await response.json()
      console.log("Login successful, received data:", { ...data, access_token: "[REDACTED]" })

      // Store authentication data
      const userData = {
        id: data.user_id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role,
      }

      // Set expiry time (24 hours from now)
      const expiryTime = Date.now() + 24 * 60 * 60 * 1000

      localStorage.setItem("hr_auth_token", data.access_token)
      localStorage.setItem("hr_user_data", JSON.stringify(userData))
      localStorage.setItem("hr_token_expiry", expiryTime.toString())

      // Redirect based on role
      switch (data.role) {
        case "admin":
          router.push("/admin/dashboard")
          break
        case "manager":
          router.push("/manager/dashboard")
          break
        case "employee":
          router.push("/employee/dashboard")
          break
        default:
          router.push("/employee/dashboard")
      }
    } catch (err) {
      console.error("Login error:", err)

      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError("Unable to connect to server. Please check your internet connection.")
      } else if (err instanceof SyntaxError && err.message.includes("JSON")) {
        setError("Server returned invalid data. Please try again or contact support.")
      } else {
        setError("Login failed. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">HR Management System</CardTitle>
          <CardDescription className="text-center">Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          {/* Debug information in development */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
              <p>
                <strong>API Endpoint:</strong> {API_BASE_URL}/api/v1/auth/token
              </p>
              <p>
                <strong>Environment:</strong> {process.env.NODE_ENV}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
