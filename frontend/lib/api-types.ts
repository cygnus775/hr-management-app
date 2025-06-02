// Employee Document Types
export const employeeDocumentTypesApi = [
  "resume",
  "id_card",
  "passport",
  "driving_license",
  "educational_certificate",
  "experience_letter",
  "salary_certificate",
  "bank_statement",
  "medical_certificate",
  "other",
] as const

export type EmployeeDocumentTypeApi = (typeof employeeDocumentTypesApi)[number]

// API Response Types
export interface UploadEmployeeDocumentApiResponse {
  success: boolean
  message: string
  document_id?: number
}

export interface ApiError {
  detail?: string
  message?: string
  errors?: Record<string, string[]>
}
