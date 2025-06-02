import { z } from "zod"

// Employee Document Upload Schema
export const EmployeeDocumentUploadSchema = z.object({
  documentType: z.string().min(1, "Document type is required"),
  description: z.string().optional(),
  file: z
    .any()
    .refine((files) => files?.length > 0, "File is required")
    .refine(
      (files) => files?.[0]?.size <= 10 * 1024 * 1024, // 10MB
      "File size must be less than 10MB",
    )
    .refine((files) => {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ]
      return allowedTypes.includes(files?.[0]?.type)
    }, "File must be PDF, DOC, DOCX, JPG, JPEG, or PNG"),
})

export type EmployeeDocumentUploadFormValues = z.infer<typeof EmployeeDocumentUploadSchema>

// Other schemas
export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export type LoginFormValues = z.infer<typeof LoginSchema>
