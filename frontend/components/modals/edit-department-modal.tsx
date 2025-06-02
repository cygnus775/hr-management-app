"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Building2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Department {
  id: number
  name: string
  description: string | null
}

interface EditDepartmentModalProps {
  department: Department
  onDepartmentUpdated: (department: Department) => void
  onClose: () => void
}

// Helper function to extract error messages from API responses
const extractErrorMessage = (errorData: any): string => {
  if (!errorData) {
    return "An unknown error occurred"
  }

  if (typeof errorData.detail === "string") {
    return errorData.detail
  }

  if (Array.isArray(errorData.detail)) {
    return errorData.detail
      .map((err: any) => {
        if (typeof err === "string") {
          return err
        }
        if (err && typeof err === "object") {
          return err.msg || err.message || "Validation error"
        }
        return "Validation error"
      })
      .join(", ")
  }

  if (errorData.detail && typeof errorData.detail === "object") {
    const messages: string[] = []

    const extractFromObject = (obj: any): void => {
      if (typeof obj === "string") {
        messages.push(obj)
      } else if (Array.isArray(obj)) {
        obj.forEach((item) => extractFromObject(item))
      } else if (obj && typeof obj === "object") {
        if (obj.msg) {
          messages.push(obj.msg)
        } else if (obj.message) {
          messages.push(obj.message)
        } else {
          Object.values(obj).forEach((value) => extractFromObject(value))
        }
      }
    }

    extractFromObject(errorData.detail)

    if (messages.length > 0) {
      return messages.join(", ")
    }
  }

  if (errorData.message) {
    return errorData.message
  }

  if (errorData.error) {
    return errorData.error
  }

  return "An error occurred"
}

export function EditDepartmentModal({ department, onDepartmentUpdated, onClose }: EditDepartmentModalProps) {
  const [name, setName] = useState(department.name)
  const [description, setDescription] = useState(department.description || "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    setName(department.name)
    setDescription(department.description || "")
  }, [department])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        title: "Missing required field",
        description: "Please enter a department name",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetchWithAuth(`/api/v1/employees/departments/${department.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      })

      if (response.ok) {
        const updatedDepartment = await response.json()

        toast({
          title: "Department updated successfully",
          description: `${name} has been updated`,
        })

        // Call the callback function to update the parent component
        onDepartmentUpdated(updatedDepartment)
      } else {
        const errorData = await response.json().catch(() => null)
        const errorMessage = extractErrorMessage(errorData)
        throw new Error(errorMessage)
      }
    } catch (err: any) {
      console.error("Error updating department:", err)
      const errorMessage = err.message || "An error occurred while updating the department"
      toast({
        title: "Failed to update department",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Edit Department</span>
          </DialogTitle>
          <DialogDescription>Update the department information</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Department Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Human Resources, Engineering, Marketing"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the department's role and responsibilities"
              className="min-h-[80px]"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Department
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
