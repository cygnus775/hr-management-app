// Enhanced error handling utility
export function extractErrorMessage(error: any): string {
  // Handle string errors
  if (typeof error === "string") {
    return error
  }

  // Handle arrays (validation errors)
  if (Array.isArray(error)) {
    return error
      .map((err) => extractErrorMessage(err))
      .filter((msg) => typeof msg === "string")
      .join(", ")
  }

  // Handle objects with nested errors
  if (error && typeof error === "object") {
    // Check for common error message properties
    if (error.detail) return extractErrorMessage(error.detail)
    if (error.message) return extractErrorMessage(error.message)
    if (error.msg) return extractErrorMessage(error.msg)

    // Handle validation error format
    if (error.loc && error.msg) {
      return `${error.loc.join(".")}: ${error.msg}`
    }

    // Handle nested error objects
    const errorValues = Object.values(error)
    const stringErrors = errorValues
      .map((val) => extractErrorMessage(val))
      .filter((msg) => typeof msg === "string" && msg.length > 0)

    if (stringErrors.length > 0) {
      return stringErrors.join(", ")
    }
  }

  // Fallback
  return "An unexpected error occurred"
}

export function handleApiError(error: any, fallbackMessage = "An error occurred"): string {
  console.error("API Error:", error)

  try {
    return extractErrorMessage(error)
  } catch {
    return fallbackMessage
  }
}
