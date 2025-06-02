"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, Building2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Department {
  id: number
  name: string
  description: string | null
}

interface AddDepartmentModalProps {
  onDepartmentAdded?: (department: Department) => void
  children?: React.ReactNode
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

export function AddDepartmentModal({ onDepartmentAdded, children }: AddDepartmentModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  const resetForm = () => {
    setName("")
    setDescription("")
  }

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

      const response = await fetchWithAuth("/api/v1/employees/departments/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      })

      if (response.ok) {
        const newDepartment = await response.json()

        toast({
          title: "Department created successfully",
          description: `${name} has been added to the system`,
        })

        // Call the callback function to update the parent component
        if (onDepartmentAdded) {
          onDepartmentAdded(newDepartment)
        }

        // Reset form and close modal
        resetForm()
        setIsOpen(false)
      } else {
        const errorData = await response.json().catch(() => null)
        const errorMessage = extractErrorMessage(errorData)
        throw new Error(errorMessage)
      }
    } catch (err: any) {
      console.error("Error creating department:", err)
      const errorMessage = err.message || "An error occurred while creating the department"
      toast({
        title: "Failed to create department",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Department
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Add New Department</span>
          </DialogTitle>
          <DialogDescription>Create a new department for your organization</DialogDescription>
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
            <Button variant="outline" type="button" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Department
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
