"use server"

import { revalidatePath } from "next/cache"
import { uploadMyEmployeeDocumentApi } from "./api-client"
import type { EmployeeDocumentTypeApi } from "./api-types"

export async function uploadMyDocumentAction(rawFormData: FormData, token: string | null, employeeId: number) {
  if (!token) {
    return { success: false, message: "Authentication token is missing." }
  }

  if (!employeeId) {
    return { success: false, message: "Employee ID is required." }
  }

  // Extract data from FormData
  const fileValue = rawFormData.get("file")
  const formSelectedDocumentType = rawFormData.get("document_type") as string | null
  const descriptionValue = rawFormData.get("description") as string | null

  // Server-side validation of the extracted data
  let fileObject: File | null = null
  if (fileValue instanceof File) {
    fileObject = fileValue
  } else {
    return { success: false, message: "Server validation: File is missing or invalid." }
  }

  if (typeof formSelectedDocumentType !== "string" || formSelectedDocumentType.trim() === "") {
    return { success: false, message: "Server validation: Document type is required." }
  }

  // Ensure the documentType is one of the allowed enum values
  const finalDocumentTypeForJson = formSelectedDocumentType.trim() as EmployeeDocumentTypeApi

  const descriptionString =
    typeof descriptionValue === "string" && descriptionValue.trim() !== "" ? descriptionValue.trim() : null

  // Prepare data for the API client according to OpenAPI spec
  const docDataForApi = {
    document_type: finalDocumentTypeForJson,
    description: descriptionString,
  }
  const docDataJsonString = JSON.stringify(docDataForApi)

  const apiFormData = new FormData()
  apiFormData.append("doc_data_json", docDataJsonString)
  apiFormData.append("file", fileObject)

  try {
    // Call the API client function with the correct employee ID
    await uploadMyEmployeeDocumentApi(employeeId, apiFormData, token)
    revalidatePath(`/employee/profile`) // Revalidate the path to show the new document
    return { success: true, message: "Your document uploaded successfully!" }
  } catch (error: any) {
    console.error(`Error uploading document for employee ${employeeId}:`, error)
    return { success: false, message: error.message || "Failed to upload your document." }
  }
}
