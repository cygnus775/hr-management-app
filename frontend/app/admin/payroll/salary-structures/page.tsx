"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/components/auth-provider"
import { Plus, Edit, Search, Users, DollarSign } from "lucide-react"

interface Employee {
  id: number
  user_email: string
  user_first_name: string
  user_last_name: string
  job_title?: string
  department?: {
    id: number
    name: string
  }
}

interface SalaryComponent {
  id: number
  name: string
  type: string
  description?: string
  is_taxable: boolean
}

interface EmployeeSalaryStructure {
  id: number
  employee_id: number
  component_id: number
  amount: number
  effective_from: string
  effective_to?: string
  component_name: string
  component_type: string
}

export default function SalaryStructuresPage() {
  const { user, token } = useAuth()
  const { toast } = useToast()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [salaryComponents, setSalaryComponents] = useState<SalaryComponent[]>([])
  const [employeeSalaryStructures, setEmployeeSalaryStructures] = useState<Record<number, EmployeeSalaryStructure[]>>(
    {},
  )
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showAddStructure, setShowAddStructure] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const [newStructure, setNewStructure] = useState({
    employee_id: 0,
    component_id: 0,
    amount: 0,
    effective_from: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    if (token) {
      fetchData()
    }
  }, [token])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [employeesResponse, componentsResponse] = await Promise.all([
        apiClient.get<Employee[]>("/api/v1/employees/", token),
        apiClient.get<SalaryComponent[]>("/api/v1/payroll/components/", token),
      ])

      if (employeesResponse.success) {
        setEmployees(employeesResponse.data || [])
      }

      if (componentsResponse.success) {
        setSalaryComponents(componentsResponse.data || [])
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployeeSalaryStructure = async (employeeId: number) => {
    try {
      const response = await apiClient.get<EmployeeSalaryStructure[]>(
        `/api/v1/payroll/employee-structure/${employeeId}`,
        token,
      )
      if (response.success) {
        setEmployeeSalaryStructures((prev) => ({
          ...prev,
          [employeeId]: response.data || [],
        }))
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch employee salary structure",
        variant: "destructive",
      })
    }
  }

  const addSalaryStructure = async () => {
    try {
      const response = await apiClient.post<EmployeeSalaryStructure>(
        "/api/v1/payroll/employee-structure/",
        newStructure,
        token,
      )
      if (response.success) {
        toast({
          title: "Success",
          description: "Salary structure added successfully",
        })
        setShowAddStructure(false)
        setNewStructure({
          employee_id: 0,
          component_id: 0,
          amount: 0,
          effective_from: new Date().toISOString().split("T")[0],
        })
        if (selectedEmployee) {
          fetchEmployeeSalaryStructure(selectedEmployee.id)
        }
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add salary structure",
        variant: "destructive",
      })
    }
  }

  const filteredEmployees = employees.filter(
    (employee) =>
      `${employee.user_first_name} ${employee.user_last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department?.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const calculateTotalSalary = (structures: EmployeeSalaryStructure[]) => {
    const earnings = structures
      .filter((s) => s.component_type.includes("earning"))
      .reduce((total, s) => total + s.amount, 0)

    const deductions = structures
      .filter((s) => s.component_type.includes("deduction"))
      .reduce((total, s) => total + s.amount, 0)

    return { earnings, deductions, net: earnings - deductions }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Employee Salary Structures</h1>
          <p className="text-gray-600">Manage individual employee salary components and structures</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salary Components</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salaryComponents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Configured Structures</CardTitle>
            <Edit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(employeeSalaryStructures).length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee List */}
        <Card>
          <CardHeader>
            <CardTitle>Employees</CardTitle>
            <CardDescription>Select an employee to view their salary structure</CardDescription>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedEmployee?.id === employee.id ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                  }`}
                  onClick={() => {
                    setSelectedEmployee(employee)
                    fetchEmployeeSalaryStructure(employee.id)
                  }}
                >
                  <div className="font-medium">
                    {employee.user_first_name} {employee.user_last_name}
                  </div>
                  <div className="text-sm text-gray-500">{employee.user_email}</div>
                  {employee.job_title && <div className="text-sm text-gray-500">{employee.job_title}</div>}
                  {employee.department && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      {employee.department.name}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Salary Structure */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  {selectedEmployee
                    ? `${selectedEmployee.user_first_name} ${selectedEmployee.user_last_name}'s Salary Structure`
                    : "Salary Structure"}
                </CardTitle>
                <CardDescription>
                  {selectedEmployee
                    ? "Manage salary components and amounts"
                    : "Select an employee to view their salary structure"}
                </CardDescription>
              </div>
              {selectedEmployee && (
                <Dialog open={showAddStructure} onOpenChange={setShowAddStructure}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Component
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Salary Component</DialogTitle>
                      <DialogDescription>
                        Add a new salary component for {selectedEmployee.user_first_name}{" "}
                        {selectedEmployee.user_last_name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="component">Salary Component</Label>
                        <Select
                          value={newStructure.component_id.toString()}
                          onValueChange={(value) =>
                            setNewStructure({
                              ...newStructure,
                              component_id: Number.parseInt(value),
                              employee_id: selectedEmployee.id,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select component" />
                          </SelectTrigger>
                          <SelectContent>
                            {salaryComponents.map((component) => (
                              <SelectItem key={component.id} value={component.id.toString()}>
                                {component.name} ({component.type.replace("_", " ")})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="amount">Amount (₹)</Label>
                        <Input
                          type="number"
                          value={newStructure.amount}
                          onChange={(e) =>
                            setNewStructure({ ...newStructure, amount: Number.parseFloat(e.target.value) || 0 })
                          }
                          placeholder="Enter amount"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <Label htmlFor="effective_from">Effective From</Label>
                        <Input
                          type="date"
                          value={newStructure.effective_from}
                          onChange={(e) => setNewStructure({ ...newStructure, effective_from: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowAddStructure(false)}>
                          Cancel
                        </Button>
                        <Button onClick={addSalaryStructure}>Add Component</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedEmployee ? (
              <div className="space-y-4">
                {employeeSalaryStructures[selectedEmployee.id]?.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Component</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Effective From</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeSalaryStructures[selectedEmployee.id].map((structure) => (
                          <TableRow key={structure.id}>
                            <TableCell className="font-medium">{structure.component_name}</TableCell>
                            <TableCell>
                              <Badge variant={structure.component_type.includes("earning") ? "default" : "secondary"}>
                                {structure.component_type.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">₹{structure.amount.toFixed(2)}</TableCell>
                            <TableCell>{new Date(structure.effective_from).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Salary Summary */}
                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-2">Salary Summary</h3>
                      {(() => {
                        const { earnings, deductions, net } = calculateTotalSalary(
                          employeeSalaryStructures[selectedEmployee.id],
                        )
                        return (
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-sm text-gray-500">Total Earnings</p>
                              <p className="text-lg font-semibold text-green-600">₹{earnings.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Total Deductions</p>
                              <p className="text-lg font-semibold text-red-600">₹{deductions.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Net Salary</p>
                              <p className="text-xl font-bold text-blue-600">₹{net.toFixed(2)}</p>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">No salary structure configured for this employee</div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">Select an employee to view their salary structure</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
