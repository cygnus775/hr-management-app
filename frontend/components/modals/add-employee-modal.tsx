"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus } from "lucide-react"
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
import { ScrollArea } from "@/components/ui/scroll-area"

interface Department {
  id: number
  name: string
  description: string | null
}

interface AddEmployeeModalProps {
  onEmployeeAdded?: (employee: any) => void
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

export function AddEmployeeModal({ onEmployeeAdded, children }: AddEmployeeModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [role, setRole] = useState("employee")
  const [departmentId, setDepartmentId] = useState("")
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen) {
      fetchDepartments()
    }
  }, [isOpen])

  const fetchDepartments = async () => {
    try {
      setIsLoading(true)
      const response = await fetchWithAuth("/api/v1/employees/departments/")

      if (response.ok) {
        const data = await response.json()
        setDepartments(data)
      } else {
        toast({
          title: "Failed to fetch departments",
          description: "Please try again later",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error fetching departments:", err)
      toast({
        title: "Error",
        description: "An error occurred while fetching departments",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFirstName("")
    setLastName("")
    setEmail("")
    setPassword("")
    setJobTitle("")
    setPhoneNumber("")
    setRole("employee")
    setDepartmentId("")
  }

  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      // Try to fetch users with this email (if the API supports it)
      // This is a preventive check to avoid creating duplicate users
      const response = await fetchWithAuth(`/api/v1/users/?email=${encodeURIComponent(email)}`)
      if (response.ok) {
        const users = await response.json()
        return Array.isArray(users) && users.length > 0
      }
    } catch (err) {
      // If the endpoint doesn't exist or fails, we'll proceed with creation
      console.log("Email check endpoint not available, proceeding with creation")
    }
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!firstName || !lastName || !email || !password) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      // Check if email already exists
      const emailExists = await checkEmailExists(email)
      if (emailExists) {
        toast({
          title: "Email already exists",
          description: `A user with email ${email} already exists. Please use a different email address.`,
          variant: "destructive",
        })
        return
      }

      let userData: any
      let userCreated = false

      // Step 1: Try to create the user
      try {
        // Check if email already exists
        const emailExists = await checkEmailExists(email)
        if (emailExists) {
          throw new Error(`A user with email ${email} already exists. Please use a different email address.`)
        }

        const userResponse = await fetchWithAuth("/api/v1/users/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            first_name: firstName,
            last_name: lastName,
            password,
            role,
          }),
        })

        if (userResponse.ok) {
          userData = await userResponse.json()
          userCreated = true
        } else {
          const errorData = await userResponse.json().catch(() => null)
          const errorMessage = extractErrorMessage(errorData)

          // Check if user already exists
          if (
            errorMessage.toLowerCase().includes("already exists") ||
            errorMessage.toLowerCase().includes("duplicate") ||
            userResponse.status === 409
          ) {
            throw new Error(`A user with email ${email} already exists. Please use a different email address.`)
          }

          throw new Error(errorMessage)
        }
      } catch (err: any) {
        // If user creation failed, don't proceed
        throw err
      }

      // Step 2: Create employee profile
      try {
        const profileData: any = {
          user_id: userData.id,
          job_title: jobTitle || null,
          phone_number: phoneNumber || null,
        }

        if (departmentId) {
          profileData.department_id = Number.parseInt(departmentId)
        }

        const profileResponse = await fetchWithAuth("/api/v1/employees/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profileData),
        })

        if (profileResponse.ok) {
          const newEmployee = await profileResponse.json()

          toast({
            title: "Employee added successfully",
            description: `${firstName} ${lastName} has been added to the system`,
          })

          // Call the callback function to update the parent component
          if (onEmployeeAdded) {
            onEmployeeAdded(newEmployee)
          }

          // Reset form and close modal
          resetForm()
          setIsOpen(false)
        } else {
          const errorData = await profileResponse.json().catch(() => null)
          const errorMessage = extractErrorMessage(errorData)

          // Check if profile already exists
          if (
            errorMessage.toLowerCase().includes("already exists") ||
            errorMessage.toLowerCase().includes("profile already exists")
          ) {
            // Try to fetch the existing employee profile
            try {
              const existingEmployeeResponse = await fetchWithAuth(`/api/v1/employees/?user_id=${userData.id}`)
              if (existingEmployeeResponse.ok) {
                const employees = await existingEmployeeResponse.json()
                const existingEmployee = employees.find((emp: any) => emp.user_id === userData.id)

                if (existingEmployee) {
                  toast({
                    title: "Employee already exists",
                    description: `${firstName} ${lastName} is already in the system`,
                    variant: "destructive",
                  })

                  // Still call the callback to refresh the list
                  if (onEmployeeAdded) {
                    onEmployeeAdded(existingEmployee)
                  }

                  resetForm()
                  setIsOpen(false)
                  return
                }
              }
            } catch (fetchErr) {
              console.error("Error fetching existing employee:", fetchErr)
            }

            throw new Error(
              `An employee profile already exists for this user. Please check if ${firstName} ${lastName} is already in the system.`,
            )
          }

          throw new Error(errorMessage)
        }
      } catch (profileErr: any) {
        // If profile creation failed but user was created, we should clean up
        if (userCreated && userData?.id) {
          try {
            // Attempt to delete the created user to avoid orphaned records
            await fetchWithAuth(`/api/v1/users/${userData.id}`, {
              method: "DELETE",
            })
          } catch (cleanupErr) {
            console.error("Failed to cleanup user after profile creation failure:", cleanupErr)
          }
        }
        throw profileErr
      }
    } catch (err: any) {
      console.error("Error adding employee:", err)
      const errorMessage = err.message || "An error occurred while adding the employee"
      toast({
        title: "Failed to add employee",
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
            Add Employee
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>Create a new employee account and profile</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Create login credentials for the employee</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">
                        First Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">
                        Last Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Password <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">
                      Role <span className="text-red-500">*</span>
                    </Label>
                    <Select value={role} onValueChange={setRole} disabled={isSubmitting}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Employee Details</CardTitle>
                  <CardDescription>Add professional information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle">Job Title</Label>
                      <Input
                        id="jobTitle"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <Input
                        id="phoneNumber"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select value={departmentId} onValueChange={setDepartmentId} disabled={isSubmitting || isLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoading ? "Loading departments..." : "Select department"} />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id.toString()}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end space-x-4 pt-4">
                <Button variant="outline" type="button" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Employee
                </Button>
              </div>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
