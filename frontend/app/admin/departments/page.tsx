"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Building2, Users, Edit, Trash2, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AddDepartmentModal } from "@/components/modals/add-department-modal"
import { EditDepartmentModal } from "@/components/modals/edit-department-modal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"

interface Department {
  id: number
  name: string
  description: string | null
  employee_count?: number
}

export default function DepartmentsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch departments
      const departmentsResponse = await fetchWithAuth("/api/v1/employees/departments/")

      // Fetch employees to get department counts
      const employeesResponse = await fetchWithAuth("/api/v1/employees/")

      if (departmentsResponse.ok && employeesResponse.ok) {
        const departmentsData = await departmentsResponse.json()
        const employeesData = await employeesResponse.json()

        // Calculate employee count per department
        const departmentCounts = employeesData.reduce((acc: Record<number, number>, employee: any) => {
          if (employee.department?.id) {
            acc[employee.department.id] = (acc[employee.department.id] || 0) + 1
          }
          return acc
        }, {})

        // Add employee counts to departments
        const departmentsWithCounts = departmentsData.map((dept: Department) => ({
          ...dept,
          employee_count: departmentCounts[dept.id] || 0,
        }))

        setDepartments(departmentsWithCounts)
      } else {
        const errorData = await departmentsResponse.json().catch(() => null)
        setError(errorData?.detail || "Failed to fetch departments")
      }
    } catch (err) {
      console.error("Error fetching departments:", err)
      setError("An error occurred while fetching departments")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDepartmentAdded = (newDepartment: Department) => {
    setDepartments((prev) => [{ ...newDepartment, employee_count: 0 }, ...prev])
  }

  const handleDepartmentUpdated = (updatedDepartment: Department) => {
    setDepartments((prev) =>
      prev.map((dept) =>
        dept.id === updatedDepartment.id ? { ...updatedDepartment, employee_count: dept.employee_count } : dept,
      ),
    )
    setEditingDepartment(null)
  }

  const handleDeleteDepartment = async (departmentId: number) => {
    try {
      setIsDeleting(departmentId)

      // Note: The API spec doesn't show a delete endpoint for departments
      // This would typically be a DELETE request to /api/v1/employees/departments/{department_id}
      // For now, we'll show a message that deletion is not available
      toast({
        title: "Delete not available",
        description: "Department deletion is not currently supported by the API",
        variant: "destructive",
      })
    } catch (err) {
      console.error("Error deleting department:", err)
      toast({
        title: "Failed to delete department",
        description: "An error occurred while deleting the department",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const filteredDepartments = departments.filter(
    (department) =>
      department.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (department.description && department.description.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Departments</h1>
          <p className="text-muted-foreground">Manage your organization's departments</p>
        </div>
        <AddDepartmentModal onDepartmentAdded={handleDepartmentAdded} />
      </div>

      {/* Department Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Departments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
            <p className="text-xs text-muted-foreground">Active departments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {departments.reduce((total, dept) => total + (dept.employee_count || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all departments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {departments.length > 0
                ? Math.round(
                    departments.reduce((total, dept) => total + (dept.employee_count || 0), 0) / departments.length,
                  )
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Employees per department</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Directory</CardTitle>
          <CardDescription>View and manage all departments in your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Employee Count</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No departments found matching your search" : "No departments found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDepartments.map((department) => (
                    <TableRow key={department.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {department.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{department.name}</div>
                            <div className="text-sm text-muted-foreground">ID: {department.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="text-sm">{department.description || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {department.employee_count || 0} employees
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => setEditingDepartment(department)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700"
                                disabled={isDeleting === department.id}
                              >
                                {isDeleting === department.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Department</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{department.name}"? This action cannot be undone and
                                  may affect {department.employee_count || 0} employees.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDepartment(department.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Department Modal */}
      {editingDepartment && (
        <EditDepartmentModal
          department={editingDepartment}
          onDepartmentUpdated={handleDepartmentUpdated}
          onClose={() => setEditingDepartment(null)}
        />
      )}
    </div>
  )
}
