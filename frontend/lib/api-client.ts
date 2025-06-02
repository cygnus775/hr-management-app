// Centralized API client with proper error handling
import { API_CONFIG } from "./config"

export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
  message?: string
}

export interface UploadEmployeeDocumentApiResponse {
  success: boolean
  message: string
  document_id?: number
}

export interface EmployeeDocumentCreate {
  document_type: string
  description?: string | null
}

export interface EmployeeDocumentRead {
  id: number
  document_type: string
  description?: string
  file_url: string
  uploaded_at: string
}

interface ApiClientOptions {
  method?: string
  body?: any
  needsAuth?: boolean
  token?: string | null
  isFormData?: boolean
}

// Generic API client function
async function genericApiClient<T>(endpoint: string, options: ApiClientOptions = {}): Promise<T> {
  const { method = "GET", body, needsAuth = false, token, isFormData = false } = options

  const url = `${API_CONFIG.BASE_URL}${endpoint}`

  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  }

  // Add auth header if needed
  if (needsAuth && token) {
    headers.Authorization = `Bearer ${token}`
  }

  // Add content type for non-FormData requests
  if (!isFormData && body) {
    headers["Content-Type"] = "application/json"
  }

  const config: RequestInit = {
    method,
    headers,
    mode: "cors",
    credentials: "omit",
  }

  // Add body if provided
  if (body) {
    if (isFormData) {
      config.body = body // FormData - browser will set correct Content-Type
    } else {
      config.body = JSON.stringify(body)
    }
  }

  console.log("API Request:", url, method, { isFormData, hasAuth: !!token })

  try {
    const response = await fetch(url, config)

    console.log("API Response:", response.status, response.statusText)

    const contentType = response.headers.get("content-type")
    const isJson = contentType && contentType.includes("application/json")

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`

      if (isJson) {
        try {
          const errorData = await response.json()
          errorMessage = errorData?.detail || errorData?.message || errorMessage

          // Handle validation errors (422)
          if (response.status === 422 && errorData?.errors) {
            const validationErrors = Object.entries(errorData.errors)
              .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
              .join("; ")
            errorMessage = `Validation errors: ${validationErrors}`
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      const error = new Error(errorMessage) as any
      error.status = response.status
      throw error
    }

    if (isJson) {
      return await response.json()
    } else {
      return (await response.text()) as unknown as T
    }
  } catch (error) {
    console.error("API Error:", error)
    throw error
  }
}

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_CONFIG.BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`
      console.log("API Request:", url, options.method || "GET")

      const response = await fetch(url, {
        ...options,
        headers: {
          "ngrok-skip-browser-warning": "true",
          Accept: "application/json",
          ...options.headers,
        },
        mode: "cors",
        credentials: "omit",
      })

      console.log("API Response:", response.status, response.statusText)

      const contentType = response.headers.get("content-type")
      const isJson = contentType && contentType.includes("application/json")

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`

        if (isJson) {
          try {
            const errorData = await response.json()
            errorMessage = errorData?.detail || errorData?.message || errorMessage
          } catch {
            // Ignore JSON parse errors for error responses
          }
        }

        return {
          success: false,
          error: errorMessage,
        }
      }

      if (isJson) {
        const data = await response.json()
        return {
          success: true,
          data,
        }
      } else {
        const text = await response.text()
        return {
          success: true,
          data: text as unknown as T,
        }
      }
    } catch (error) {
      console.error("API Error:", error)

      let errorMessage = "Network error"
      if (error instanceof TypeError && error.message.includes("fetch")) {
        errorMessage = "Unable to connect to server"
      } else if (error instanceof SyntaxError) {
        errorMessage = "Invalid response from server"
      } else if (error instanceof Error) {
        errorMessage = error.message
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  async get<T>(endpoint: string, token?: string): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    return this.makeRequest<T>(endpoint, {
      method: "GET",
      headers,
    })
  }

  async post<T>(endpoint: string, data?: any, token?: string): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    let body: any
    if (data instanceof FormData) {
      body = data
      // Don't set Content-Type for FormData - browser will set multipart/form-data automatically
    } else {
      headers["Content-Type"] = "application/json"
      body = JSON.stringify(data)
    }

    return this.makeRequest<T>(endpoint, {
      method: "POST",
      headers,
      body,
    })
  }

  async put<T>(endpoint: string, data: any, token?: string): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    return this.makeRequest<T>(endpoint, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    })
  }

  async delete<T>(endpoint: string, token?: string): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    return this.makeRequest<T>(endpoint, {
      method: "DELETE",
      headers,
    })
  }

  // Specific method for uploading employee documents
  async uploadEmployeeDocument(
    employeeId: number,
    docData: EmployeeDocumentCreate,
    file: File,
    token: string,
  ): Promise<ApiResponse<EmployeeDocumentRead>> {
    const formData = new FormData()
    formData.append("doc_data_json", JSON.stringify(docData))
    formData.append("file", file)

    // The post method will automatically handle FormData correctly
    return this.post<EmployeeDocumentRead>(`/api/v1/employees/${employeeId}/documents/`, formData, token)
  }
}

export const apiClientInstance = new ApiClient()

// Updated API function to use the correct endpoint with employee ID
export async function uploadMyEmployeeDocumentApi(
  employeeId: number,
  formData: FormData,
  token: string | null,
): Promise<UploadEmployeeDocumentApiResponse> {
  if (!token) {
    throw new Error("Authentication token is required")
  }

  try {
    const response = await apiClientInstance.post<EmployeeDocumentRead>(
      `/api/v1/employees/${employeeId}/documents/`,
      formData,
      token,
    )

    if (response.success && response.data) {
      return {
        success: true,
        message: "Document uploaded successfully!",
        document_id: response.data.id,
      }
    } else {
      throw new Error(response.error || "Upload failed")
    }
  } catch (error: any) {
    console.error("Upload API Error:", error)
    throw error
  }
}
