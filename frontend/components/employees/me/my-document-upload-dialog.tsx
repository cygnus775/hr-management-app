"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EmployeeDocumentUploadSchema, type EmployeeDocumentUploadFormValues } from "@/lib/schemas"
import { employeeDocumentTypesApi } from "@/lib/api-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { uploadMyDocumentAction } from "@/lib/actions"
import { Loader2, AlertTriangle, UploadCloud } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

interface MyDocumentUploadDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  employeeId: number // Required for the correct API endpoint
}

const getDocumentTypeDisplayName = (docType: string): string => {
  return docType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export default function MyDocumentUploadDialog({
  isOpen,
  onClose,
  onSuccess,
  employeeId,
}: MyDocumentUploadDialogProps) {
  const { toast } = useToast()
  const { token } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<EmployeeDocumentUploadFormValues>({
    resolver: zodResolver(EmployeeDocumentUploadSchema),
    defaultValues: {
      documentType: undefined,
      description: "",
      file: undefined,
    },
  })

  const onSubmit = async (values: EmployeeDocumentUploadFormValues) => {
    setIsSubmitting(true)
    setFormError(null)

    if (!token) {
      setFormError("Authentication required.")
      setIsSubmitting(false)
      toast({ title: "Authentication Error", variant: "destructive" })
      return
    }

    if (!employeeId) {
      setFormError("Employee ID is required.")
      setIsSubmitting(false)
      toast({ title: "Error", description: "Employee ID is missing.", variant: "destructive" })
      return
    }

    const formData = new FormData()
    formData.append("file", values.file[0])
    formData.append("document_type", values.documentType)
    if (values.description) {
      formData.append("description", values.description)
    }

    console.log("Submitting document upload for employee:", employeeId, {
      documentType: values.documentType,
      description: values.description,
      fileName: values.file[0]?.name,
      fileSize: values.file[0]?.size,
      fileType: values.file[0]?.type,
    })

    // Pass the employeeId to the server action
    const result = await uploadMyDocumentAction(formData, token, employeeId)
    setIsSubmitting(false)

    if (result.success) {
      toast({ title: "Success!", description: result.message })
      form.reset()
      onSuccess()
      onClose()
    } else {
      setFormError(result.message || "An error occurred.")
      toast({ title: "Upload Failed", description: result.message, variant: "destructive" })
    }
  }

  if (!isOpen) return null

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          form.reset()
          setFormError(null)
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <UploadCloud className="mr-2 h-5 w-5 text-primary" />
            Upload New Document
          </DialogTitle>
          <DialogDescription>
            Select the type of document and upload the file. The file will be uploaded to employee ID: {employeeId}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
            {formError && (
              <div className="flex items-center p-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md">
                <AlertTriangle className="h-4 w-4 mr-2 shrink-0" />
                {formError}
              </div>
            )}

            <FormField
              control={form.control}
              name="documentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employeeDocumentTypesApi.map((type) => (
                        <SelectItem key={type} value={type}>
                          {getDocumentTypeDisplayName(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter a brief description" className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File *</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      onChange={(e) => field.onChange(e.target.files)}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset()
                    setFormError(null)
                    onClose()
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload Document"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
