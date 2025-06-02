"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  CreditCard,
  Edit3,
  Save,
  X,
  Upload,
  Download,
  Trash2,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  documents: EmployeeDocument[]
  user_email: string
  user_first_name: string
  user_last_name: string
  user_role: string
  manager_email: string | null
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

type DocumentType = "id_proof" | "offer_letter" | "contract" | "policy_acknowledgement" | "other"

export default function ManagerProfilePage() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDocType, setUploadDocType] = useState<DocumentType | "">("")
  const [uploadDescription, setUploadDescription] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Editable fields
  const [phoneNumber, setPhoneNumber] = useState("")
  const [bankAccountNumber, setBankAccountNumber] = useState("")
  const [bankIfscCode, setBankIfscCode] = useState("")

  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetchWithAuth("/api/v1/employees/me/profile")

      if (response.ok) {
        const profileData = await response.json()
        setProfile(profileData)

        // Set editable fields
        setPhoneNumber(profileData.phone_number || "")
        setBankAccountNumber(profileData.bank_account_number || "")
        setBankIfscCode(profileData.bank_ifsc_code || "")
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || "Failed to fetch profile information")
      }
    } catch (err: any) {
      console.error("Error fetching profile:", err)
      setError(err.message || "An error occurred while fetching your profile")
      toast({
        title: "Error",
        description: err.message || "Failed to load profile data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!profile) return

    try {
      setSaving(true)
      setError(null)

      // Prepare update data according to API schema
      const updateData = {
        job_title: profile.job_title,
        phone_number: phoneNumber || null,
        hire_date: profile.hire_date,
        employment_status: profile.employment_status,
        resignation_date: profile.resignation_date,
        termination_date: profile.termination_date,
        last_working_day: profile.last_working_day,
        bank_account_number: bankAccountNumber || null,
        bank_ifsc_code: bankIfscCode || null,
        department_id: profile.department_id,
        manager_id: null, // This would need to be set if changing manager
      }

      const response = await fetchWithAuth(`/api/v1/employees/${profile.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        const updatedProfile = await response.json()
        setProfile(updatedProfile)
        setIsEditing(false)
        toast({
          title: "Profile updated",
          description: "Your profile information has been updated successfully",
        })
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || "Failed to update profile")
      }
    } catch (err: any) {
      console.error("Error updating profile:", err)
      setError(err.message || "An error occurred while updating your profile")
      toast({
        title: "Update failed",
        description: err.message || "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (profile) {
      setPhoneNumber(profile.phone_number || "")
      setBankAccountNumber(profile.bank_account_number || "")
      setBankIfscCode(profile.bank_ifsc_code || "")
    }
    setIsEditing(false)
    setError(null)
  }

  const handleFileUpload = async () => {
    try {
      setUploadError(null)
      setIsUploading(true)

      // Validate required fields
      if (!uploadFile) {
        setUploadError("Please select a file to upload")
        return
      }

      if (!uploadDocType) {
        setUploadError("Please select a document type")
        return
      }

      if (!profile) {
        setUploadError("Profile not found")
        return
      }

      // Validate file size (max 10MB)
      if (uploadFile.size > 10 * 1024 * 1024) {
        setUploadError("File size must be less than 10MB")
        return
      }

      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]

      if (!allowedTypes.includes(uploadFile.type)) {
        setUploadError("Only PDF, Word documents, and images (JPG, PNG) are allowed")
        return
      }

      // Create form data
      const formData = new FormData()

      // Add document metadata as JSON string
      const docData = {
        document_type: uploadDocType,
        description: uploadDescription.trim() || null,
      }

      formData.append("doc_data_json", JSON.stringify(docData))
      formData.append("file", uploadFile)

      // Upload document
      const response = await fetchWithAuth(`/api/v1/employees/${profile.id}/documents/`, {
        method: "POST",
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary
      })

      if (response.ok) {
        const newDocument = await response.json()

        // Update profile state with new document
        setProfile({
          ...profile,
          documents: [...profile.documents, newDocument],
        })

        toast({
          title: "Document uploaded",
          description: "Document has been uploaded successfully",
        })

        // Reset form and close dialog
        setUploadDocType("")
        setUploadDescription("")
        setUploadFile(null)
        setIsUploadDialogOpen(false)
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || "Failed to upload document")
      }
    } catch (err: any) {
      console.error("Error uploading document:", err)
      setUploadError(err.message || "An error occurred while uploading the document")
      toast({
        title: "Upload failed",
        description: err.message || "Failed to upload document",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadDocument = async (documentId: number, fileName: string) => {
    try {
      const response = await fetchWithAuth(`/api/v1/employees/documents/${documentId}/download`)

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error("Failed to download document")
      }
    } catch (err: any) {
      console.error("Error downloading document:", err)
      toast({
        title: "Download failed",
        description: err.message || "Failed to download document",
        variant: "destructive",
      })
    }
  }

  const handleDeleteDocument = async (documentId: number) => {
    try {
      const response = await fetchWithAuth(`/api/v1/employees/documents/${documentId}`, {
        method: "DELETE",
      })

      if (response.status === 204) {
        // Update profile state by removing the deleted document
        if (profile) {
          setProfile({
            ...profile,
            documents: profile.documents.filter((doc) => doc.id !== documentId),
          })
        }

        toast({
          title: "Document deleted",
          description: "Document has been deleted successfully",
        })
      } else {
        throw new Error("Failed to delete document")
      }
    } catch (err: any) {
      console.error("Error deleting document:", err)
      toast({
        title: "Delete failed",
        description: err.message || "Failed to delete document",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: "Active", variant: "default" as const },
      onboarding: { label: "Onboarding", variant: "secondary" as const },
      on_notice: { label: "On Notice", variant: "destructive" as const },
      resigned: { label: "Resigned", variant: "outline" as const },
      terminated: { label: "Terminated", variant: "destructive" as const },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getDocumentTypeLabel = (type: string) => {
    const typeLabels = {
      id_proof: "ID Proof",
      offer_letter: "Offer Letter",
      contract: "Contract",
      policy_acknowledgement: "Policy Acknowledgement",
      other: "Other",
    }
    return typeLabels[type as keyof typeof typeLabels] || type
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !profile) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
        <Button variant="outline" size="sm" className="ml-auto" onClick={fetchProfile}>
          Retry
        </Button>
      </Alert>
    )
  }

  if (!profile) {
    return (
      <Alert className="my-4">
        <AlertDescription>Profile not found</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">Manage your personal information and documents</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>
            <Edit3 className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex space-x-2">
            <Button onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
            <Button variant="outline" onClick={handleCancelEdit}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Personal Information
            </CardTitle>
            <CardDescription>Your basic personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">First Name</Label>
                <p className="text-sm">{profile.user_first_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Last Name</Label>
                <p className="text-sm">{profile.user_last_name}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                <p className="text-sm">{profile.user_email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                {isEditing ? (
                  <Input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter phone number"
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm">{profile.phone_number || "Not provided"}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              Employment Information
            </CardTitle>
            <CardDescription>Your job and department details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Job Title</Label>
              <p className="text-sm">{profile.job_title || "Not assigned"}</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Department</Label>
              <p className="text-sm">{profile.department?.name || "Not assigned"}</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Employment Status</Label>
              <div className="mt-1">{getStatusBadge(profile.employment_status)}</div>
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Hire Date</Label>
                <p className="text-sm">
                  {profile.hire_date ? new Date(profile.hire_date).toLocaleDateString() : "Not provided"}
                </p>
              </div>
            </div>

            {profile.manager_email && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Manager</Label>
                <p className="text-sm">{profile.manager_email}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Banking Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Banking Information
            </CardTitle>
            <CardDescription>Your salary account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Bank Account Number</Label>
              {isEditing ? (
                <Input
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="Enter account number"
                  className="mt-1"
                />
              ) : (
                <p className="text-sm">{profile.bank_account_number || "Not provided"}</p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Bank IFSC Code</Label>
              {isEditing ? (
                <Input
                  value={bankIfscCode}
                  onChange={(e) => setBankIfscCode(e.target.value)}
                  placeholder="Enter IFSC code"
                  className="mt-1"
                />
              ) : (
                <p className="text-sm">{profile.bank_ifsc_code || "Not provided"}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Documents
              </div>
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                    <DialogDescription>Upload a new document to your profile</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {uploadError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{uploadError}</AlertDescription>
                      </Alert>
                    )}

                    <div>
                      <Label htmlFor="document-type">Document Type</Label>
                      <Select value={uploadDocType} onValueChange={(value) => setUploadDocType(value as DocumentType)}>
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

                    <div>
                      <Label htmlFor="file">File</Label>
                      <Input
                        id="file"
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Supported formats: PDF, Word documents, Images (JPG, PNG). Max size: 10MB
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Textarea
                        id="description"
                        value={uploadDescription}
                        onChange={(e) => setUploadDescription(e.target.value)}
                        placeholder="Enter description"
                        className="mt-1"
                      />
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleFileUpload} disabled={!uploadFile || !uploadDocType || isUploading}>
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
            <CardDescription>Your uploaded documents</CardDescription>
          </CardHeader>
          <CardContent>
            {profile.documents.length === 0 ? (
              <div className="text-center py-6">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No documents uploaded yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click the Upload button to add documents to your profile
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {profile.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{doc.file_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {getDocumentTypeLabel(doc.document_type)}
                        </Badge>
                      </div>
                      {doc.description && <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>}
                      <p className="text-xs text-muted-foreground">
                        Uploaded on {new Date(doc.upload_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(doc.id, doc.file_name)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteDocument(doc.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
