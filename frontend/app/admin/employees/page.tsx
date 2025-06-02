"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Mail, Phone, Loader2, Eye, Edit } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AddEmployeeModal } from "@/components/modals/add-employee-modal"

interface Employee {
  id: number
  user_id: number
  user_email: string
  user_first_name: string
  user_last_name: string
  job_title: string | null
  phone_number: string | null
  employment_status: string
  department: {
    id: number
    name: string
    description: string | null
  } | null
}

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fetchWithAuth } = useAuth()
  const router = useRouter()

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      setIsLoading(true)
      const response = await fetchWithAuth("/api/v1/employees/")

      if (response.ok) {
        const data = await response.json()
        setEmployees(data)
      } else {
        const errorData = await response.json().catch(() => null)
        setError(errorData?.detail || "Failed to fetch employees")
      }
    } catch (err) {
      console.error("Error fetching employees:", err)
      setError("An error occurred while fetching employees")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmployeeAdded = (newEmployee: Employee) => {
    // Add the new employee to the list
    setEmployees((prev) => [newEmployee, ...prev])
  }

  const filteredEmployees = employees.filter(
    (employee) =>
      employee.user_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.user_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (employee.job_title && employee.job_title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (employee.department?.name && employee.department.name.toLowerCase().includes(searchTerm.toLowerCase())),
  )

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage your organization's workforce</p>
        </div>
        <AddEmployeeModal onEmployeeAdded={handleEmployeeAdded} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
          <CardDescription>View and manage all employees in your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
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
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {employee.user_first_name} {employee.user_last_name}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <div className="flex items-center">
                              <Mail className="mr-1 h-3 w-3" />
                              {employee.user_email}
                            </div>
                            {employee.phone_number && (
                              <div className="flex items-center">
                                <Phone className="mr-1 h-3 w-3" />
                                {employee.phone_number}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{employee.department?.name || "—"}</div>
                        {employee.department?.description && (
                          <div className="text-sm text-muted-foreground">{employee.department.description}</div>
                        )}
                      </TableCell>
                      <TableCell>{employee.job_title || "—"}</TableCell>
                      <TableCell>{getStatusBadge(employee.employment_status)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/admin/employees/${employee.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/admin/employees/${employee.id}/edit`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
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
    </div>
  )
}
