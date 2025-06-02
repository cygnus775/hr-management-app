"use client"

import { DialogTrigger } from "@/components/ui/dialog"

import type React from "react"
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Briefcase,
  FileText,
  Edit,
  Loader2,
  Upload,
  Download,
  Trash2,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

interface EmployeeProfile {
  id: number
  user_id: number
  job_title: string | null
  phone_number: string | null
  hire_date: string | null
  employment_status: string
  resignation_date: string | null
  termination_date: string | null
  last_working_day: string | null
  bank_account_number: string | null
  bank_ifsc_code: string | null
  department_id: number | null
  department: {
    id: number
    name: string
    description: string | null
  } | null
  user_email: string
  user_first_name: string
  user_last_name: string
  user_role: string
  manager_email: string | null
  documents: EmployeeDocument[]
}

interface EmployeeDocument {
  id: number
  document_type: string
  file_name: string
  file_path: string
  upload_date: string
  description: string | null
  employee_id: number
}

const extractErrorMessage = (errorData: any): string => {
  if (!errorData) return "An unknown error occurred"
  if (typeof errorData.detail === "string") return errorData.detail
  if (errorData.message) return errorData.message
  if (errorData.error) return errorData.error
  return "An error occurred"
}

export default function EmployeeDetailsPage() {
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [documentType, setDocumentType] = useState("id_proof")
  const [documentDescription, setDocumentDescription] = useState("")
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const employeeId = params.id as string

  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const employeeResponse = await fetchWithAuth(`/api/v1/employees/${employeeId}`)

        if (employeeResponse.ok) {
          const employeeData = await employeeResponse.json()
          setEmployee(employeeData)
        } else {
          setError("Failed to fetch employee details")
        }
      } catch (err) {
        setError("An error occurred while fetching employee details")
      } finally {
        setIsLoading(false)
      }
    }

    fetchEmployeeData()
  }, [fetchWithAuth, employeeId])

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!documentFile) {
      toast({
        title: "Validation Error",
        description: "Please select a file to upload.",
        variant: "destructive",
      })
      return
    }

    if (!documentType) {
      toast({
        title: "Validation Error",
        description: "Please select a document type.",
        variant: "destructive",
      })
      return
    }

    if (documentFile.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      })
      return
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    if (!allowedTypes.includes(documentFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, Word document, or image file.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUploading(true)

      const formData = new FormData()
      const docMetadata = {
        document_type: documentType,
        description: documentDescription.trim() || null,
      }

      formData.append("doc_data_json", JSON.stringify(docMetadata))
      formData.append("file", documentFile, documentFile.name)

      const response = await fetchWithAuth(`/api/v1/employees/${employeeId}/documents/`, {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const newDocument = await response.json()

        if (employee) {
          setEmployee({
            ...employee,
            documents: [...employee.documents, newDocument],
          })
        }

        toast({
          title: "Document uploaded successfully",
          description: "The document has been added to the employee's profile",
        })

        setDocumentType("id_proof")
        setDocumentDescription("")
        setDocumentFile(null)
        setIsUploadDialogOpen(false)
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(extractErrorMessage(errorData) || "Upload failed")
      }
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "An error occurred while uploading the document",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDocument = async (documentId: number) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return
    }

    try {
      const response = await fetchWithAuth(`/api/v1/employees/documents/${documentId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        if (employee) {
          setEmployee({
            ...employee,
            documents: employee.documents.filter((doc) => doc.id !== documentId),
          })
        }

        toast({
          title: "Document deleted successfully",
          description: "The document has been removed from the employee's profile",
        })
      } else {
        throw new Error("Failed to delete document")
      }
    } catch (err: any) {
      toast({
        title: "Failed to delete document",
        description: err.message || "An error occurred while deleting the document",
        variant: "destructive",
      })
    }
  }

  const downloadDocument = async (documentId: number) => {
    try {
      toast({
        title: "Starting download...",
        description: "Please wait while we prepare your document",
      })

      // Use fetchWithAuth to download the file with proper authentication
      const response = await fetchWithAuth(`/api/v1/employees/documents/${documentId}/download`)

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`)
      }

      // Get the file as a blob
      const blob = await response.blob()

      // Get filename from response headers or use a default
      const contentDisposition = response.headers.get("content-disposition")
      let filename = `document_${documentId}`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "")
        }
      }

      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob)

      // Create a temporary link element and trigger download
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()

      // Clean up
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Download completed",
        description: "Your document has been downloaded successfully",
      })
    } catch (err: any) {
      console.error("Error downloading document:", err)
      toast({
        title: "Download failed",
        description: err.message || "Failed to download the document. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: "Active", variant: "default" as const },
      on_notice: { label: "On Notice", variant: "secondary" as const },
      resigned: { label: "Resigned", variant: "destructive" as const },
      terminated: { label: "Terminated", variant: "destructive" as const },
      onboarding: { label: "Onboarding", variant: "outline" as const },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatDocumentType = (type: string) => {
    const types: Record<string, string> = {
      id_proof: "ID Proof",
      offer_letter: "Offer Letter",
      contract: "Contract",
      policy_acknowledgement: "Policy Acknowledgement",
      other: "Other",
    }
    return types[type] || type
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !employee) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertDescription>{error || "Employee not found"}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" onClick={() => router.back()} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {employee.user_first_name} {employee.user_last_name}
            </h1>
            <div className="flex items-center space-x-2">
              <p className="text-muted-foreground">{employee.job_title || "No Job Title"}</p>
              <span className="text-muted-foreground">•</span>
              <p className="text-muted-foreground">{employee.department?.name || "No Department"}</p>
            </div>
          </div>
        </div>
        <Button onClick={() => router.push(`/admin/employees/${employeeId}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Employee
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-xl font-medium">
          {employee.user_first_name.charAt(0)}
          {employee.user_last_name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-semibold">
              {employee.user_first_name} {employee.user_last_name}
            </h2>
            {getStatusBadge(employee.employment_status)}
          </div>
          <p className="text-muted-foreground">{employee.user_email}</p>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Employee Details</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-4">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">
                      {employee.user_first_name} {employee.user_last_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email Address</p>
                    <p className="font-medium">{employee.user_email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone Number</p>
                    <p className="font-medium">{employee.phone_number || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{employee.department?.name || "—"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-4">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Job Title</p>
                    <p className="font-medium">{employee.job_title || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Hire Date</p>
                    <p className="font-medium">
                      {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="font-medium capitalize">{employee.user_role}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{employee.employment_status}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {(employee.resignation_date || employee.termination_date || employee.last_working_day) && (
            <Card>
              <CardHeader>
                <CardTitle>Separation Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {employee.resignation_date && (
                    <div className="flex items-center space-x-4">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Resignation Date</p>
                        <p className="font-medium">{new Date(employee.resignation_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}
                  {employee.termination_date && (
                    <div className="flex items-center space-x-4">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Termination Date</p>
                        <p className="font-medium">{new Date(employee.termination_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}
                  {employee.last_working_day && (
                    <div className="flex items-center space-x-4">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Last Working Day</p>
                        <p className="font-medium">{new Date(employee.last_working_day).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {(employee.bank_account_number || employee.bank_ifsc_code) && (
            <Card>
              <CardHeader>
                <CardTitle>Banking Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {employee.bank_account_number && (
                    <div className="flex items-center space-x-4">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Bank Account Number</p>
                        <p className="font-medium">{employee.bank_account_number}</p>
                      </div>
                    </div>
                  )}
                  {employee.bank_ifsc_code && (
                    <div className="flex items-center space-x-4">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Bank IFSC Code</p>
                        <p className="font-medium">{employee.bank_ifsc_code}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 mt-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Employee Documents</h3>
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Document</DialogTitle>
                  <DialogDescription>Add a new document to this employee's profile</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUploadDocument} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="document-type">Document Type</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="id_proof">ID Proof</SelectItem>
                        <SelectItem value="offer_letter">Offer Letter</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="policy_acknowledgement">Policy Acknowledgement</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="document-description">Description (Optional)</Label>
                    <Input
                      id="document-description"
                      value={documentDescription}
                      onChange={(e) => setDocumentDescription(e.target.value)}
                      placeholder="Brief description of the document"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="document-file">File</Label>
                    <Input
                      id="document-file"
                      type="file"
                      onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" type="button" onClick={() => setIsUploadDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isUploading}>
                      {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Upload
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {employee.documents && employee.documents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No documents uploaded yet</p>
                <Button variant="outline" className="mt-4" onClick={() => setIsUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload First Document
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Type</TableHead>
                      <TableHead>File Name</TableHead>
                      <TableHead>Upload Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employee.documents &&
                      employee.documents.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell className="font-medium">{formatDocumentType(document.document_type)}</TableCell>
                          <TableCell>{document.file_name}</TableCell>
                          <TableCell>{new Date(document.upload_date).toLocaleDateString()}</TableCell>
                          <TableCell>{document.description || "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button variant="outline" size="icon" onClick={() => downloadDocument(document.id)}>
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-red-600"
                                onClick={() => handleDeleteDocument(document.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
