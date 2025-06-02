"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, Users, TrendingUp, Loader2, Search, Plus, Edit, Download, AlertCircle } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"

interface LeaveType {
  id: number
  description: string | null
  default_days_annually: number | null
  is_paid: boolean
  requires_approval: boolean
}

interface LeaveBalance {
  employee_id: number
  leave_type_id: number
  year: number
  allocated_days: number
  taken_days: number
  id: number
  leave_type_name: string
  balance_days: number
}

interface Employee {
  id: number
  user_first_name: string
  user_last_name: string
  user_email: string
  job_title: string | null
  department: {
    id: number
    name: string
  } | null
  employment_status: string
}

interface EmployeeWithBalances extends Employee {
  balances: LeaveBalance[]
  totalAllocated: number
  totalTaken: number
  totalRemaining: number
}

interface BalanceAdjustment {
  employee_id: number
  leave_type_id: number
  allocated_days: number
  taken_days: number
  year: number
}

export default function LeaveBalancesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [employeeBalances, setEmployeeBalances] = useState<EmployeeWithBalances[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("0")
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("0")

  // Adjustment modal state
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [adjustmentData, setAdjustmentData] = useState<BalanceAdjustment>({
    employee_id: 0,
    leave_type_id: 0,
    allocated_days: 0,
    taken_days: 0,
    year: new Date().getFullYear(),
  })
  const [isAdjusting, setIsAdjusting] = useState(false)

  // Bulk allocation state
  const [isBulkAllocationOpen, setIsBulkAllocationOpen] = useState(false)
  const [bulkAllocation, setBulkAllocation] = useState({
    leave_type_id: 0,
    allocated_days: 0,
    year: new Date().getFullYear(),
    department_id: 0,
  })
  const [isBulkAllocating, setIsBulkAllocating] = useState(false)

  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log("Fetching leave balances data...")

      // Fetch employees
      const employeesResponse = await fetchWithAuth("/api/v1/employees/")

      // Fetch leave types
      const typesResponse = await fetchWithAuth("/api/v1/leaves/types/")

      if (!employeesResponse.ok || !typesResponse.ok) {
        setError("Failed to fetch data. Please try again.")
        return
      }

      const employeesData = await employeesResponse.json()
      const typesData = await typesResponse.json()

      setEmployees(Array.isArray(employeesData) ? employeesData : [])
      setLeaveTypes(Array.isArray(typesData) ? typesData : [])

      // Fetch balances for each employee
      await fetchEmployeeBalances(employeesData)
    } catch (err) {
      console.error("Error fetching data:", err)
      setError("An error occurred while fetching data")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchEmployeeBalances = async (employeesList: Employee[]) => {
    const employeesWithBalances: EmployeeWithBalances[] = []

    for (const employee of employeesList) {
      try {
        const balancesResponse = await fetchWithAuth(
          `/api/v1/leaves/balances/employee/${employee.id}?year=${selectedYear}`,
        )

        let balances: LeaveBalance[] = []
        if (balancesResponse.ok) {
          const balancesData = await balancesResponse.json()
          balances = Array.isArray(balancesData) ? balancesData : []
        }

        const totalAllocated = balances.reduce((sum, b) => sum + b.allocated_days, 0)
        const totalTaken = balances.reduce((sum, b) => sum + b.taken_days, 0)
        const totalRemaining = balances.reduce((sum, b) => sum + b.balance_days, 0)

        employeesWithBalances.push({
          ...employee,
          balances,
          totalAllocated,
          totalTaken,
          totalRemaining,
        })
      } catch (err) {
        console.error(`Error fetching balances for employee ${employee.id}:`, err)
        // Add employee with empty balances
        employeesWithBalances.push({
          ...employee,
          balances: [],
          totalAllocated: 0,
          totalTaken: 0,
          totalRemaining: 0,
        })
      }
    }

    setEmployeeBalances(employeesWithBalances)
  }

  const handleAdjustBalance = async () => {
    if (!selectedEmployee || !adjustmentData.leave_type_id) {
      toast({
        title: "Missing information",
        description: "Please select an employee and leave type",
        variant: "destructive",
      })
      return
    }

    try {
      setIsAdjusting(true)

      const response = await fetchWithAuth(
        `/api/v1/leaves/balances/employee/${selectedEmployee.id}/adjust?leave_type_id=${adjustmentData.leave_type_id}&year=${adjustmentData.year}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            allocated_days: adjustmentData.allocated_days,
            taken_days: adjustmentData.taken_days,
          }),
        },
      )

      if (response.ok) {
        toast({
          title: "Balance adjusted",
          description: "Leave balance has been updated successfully",
        })

        // Refresh data
        await fetchEmployeeBalances(employees)
        setIsAdjustmentOpen(false)
        resetAdjustmentForm()
      } else {
        const errorData = await response.json().catch(() => null)
        toast({
          title: "Adjustment failed",
          description: errorData?.detail || "Failed to adjust balance",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error adjusting balance:", err)
      toast({
        title: "Error",
        description: "An error occurred while adjusting the balance",
        variant: "destructive",
      })
    } finally {
      setIsAdjusting(false)
    }
  }

  const handleBulkAllocation = async () => {
    if (!bulkAllocation.leave_type_id || bulkAllocation.allocated_days <= 0) {
      toast({
        title: "Invalid data",
        description: "Please select a leave type and enter valid allocation days",
        variant: "destructive",
      })
      return
    }

    try {
      setIsBulkAllocating(true)

      // Filter employees based on department if selected
      let targetEmployees = employees
      if (bulkAllocation.department_id > 0) {
        targetEmployees = employees.filter((emp) => emp.department?.id === bulkAllocation.department_id)
      }

      let successCount = 0
      let errorCount = 0

      for (const employee of targetEmployees) {
        try {
          const response = await fetchWithAuth(
            `/api/v1/leaves/balances/employee/${employee.id}/adjust?leave_type_id=${bulkAllocation.leave_type_id}&year=${bulkAllocation.year}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                allocated_days: bulkAllocation.allocated_days,
              }),
            },
          )

          if (response.ok) {
            successCount++
          } else {
            errorCount++
          }
        } catch {
          errorCount++
        }
      }

      toast({
        title: "Bulk allocation completed",
        description: `Successfully allocated for ${successCount} employees. ${errorCount} errors.`,
        variant: errorCount > 0 ? "destructive" : "default",
      })

      // Refresh data
      await fetchEmployeeBalances(employees)
      setIsBulkAllocationOpen(false)
      resetBulkAllocationForm()
    } catch (err) {
      console.error("Error in bulk allocation:", err)
      toast({
        title: "Error",
        description: "An error occurred during bulk allocation",
        variant: "destructive",
      })
    } finally {
      setIsBulkAllocating(false)
    }
  }

  const openAdjustmentModal = (employee: Employee, balance?: LeaveBalance) => {
    setSelectedEmployee(employee)
    setAdjustmentData({
      employee_id: employee.id,
      leave_type_id: balance?.leave_type_id || 0,
      allocated_days: balance?.allocated_days || 0,
      taken_days: balance?.taken_days || 0,
      year: selectedYear,
    })
    setIsAdjustmentOpen(true)
  }

  const resetAdjustmentForm = () => {
    setSelectedEmployee(null)
    setAdjustmentData({
      employee_id: 0,
      leave_type_id: 0,
      allocated_days: 0,
      taken_days: 0,
      year: new Date().getFullYear(),
    })
  }

  const resetBulkAllocationForm = () => {
    setBulkAllocation({
      leave_type_id: 0,
      allocated_days: 0,
      year: new Date().getFullYear(),
      department_id: 0,
    })
  }

  const exportBalances = () => {
    const csvData = employeeBalances.map((emp) => ({
      Employee: `${emp.user_first_name} ${emp.user_last_name}`,
      Email: emp.user_email,
      Department: emp.department?.name || "N/A",
      "Total Allocated": emp.totalAllocated,
      "Total Taken": emp.totalTaken,
      "Total Remaining": emp.totalRemaining,
      ...emp.balances.reduce(
        (acc, balance) => {
          acc[`${balance.leave_type_name} Allocated`] = balance.allocated_days
          acc[`${balance.leave_type_name} Taken`] = balance.taken_days
          acc[`${balance.leave_type_name} Remaining`] = balance.balance_days
          return acc
        },
        {} as Record<string, number>,
      ),
    }))

    const csv = [Object.keys(csvData[0] || {}).join(","), ...csvData.map((row) => Object.values(row).join(","))].join(
      "\n",
    )

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `leave-balances-${selectedYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter employees
  const filteredEmployees = employeeBalances.filter((emp) => {
    const matchesSearch =
      emp.user_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.user_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.user_email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDepartment = selectedDepartment === "0" || emp.department?.id.toString() === selectedDepartment

    return matchesSearch && matchesDepartment
  })

  // Get unique departments
  const departments = Array.from(new Set(employees.map((emp) => emp.department).filter(Boolean))).map((dept) => dept!)

  // Calculate statistics
  const stats = {
    totalEmployees: employeeBalances.length,
    totalAllocated: employeeBalances.reduce((sum, emp) => sum + emp.totalAllocated, 0),
    totalTaken: employeeBalances.reduce((sum, emp) => sum + emp.totalTaken, 0),
    totalRemaining: employeeBalances.reduce((sum, emp) => sum + emp.totalRemaining, 0),
    utilizationRate:
      employeeBalances.length > 0
        ? (employeeBalances.reduce((sum, emp) => sum + emp.totalTaken, 0) /
            employeeBalances.reduce((sum, emp) => sum + emp.totalAllocated, 0)) *
          100
        : 0,
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading leave balances...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button variant="outline" size="sm" className="ml-4" onClick={fetchData}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Employee Leave Balances</h1>
          <p className="text-muted-foreground">Manage and track employee leave allocations and usage</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportBalances}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Dialog open={isBulkAllocationOpen} onOpenChange={setIsBulkAllocationOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Bulk Allocate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Leave Allocation</DialogTitle>
                <DialogDescription>Allocate leave days to multiple employees at once</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="bulk-leave-type">Leave Type</Label>
                  <Select
                    value={bulkAllocation.leave_type_id.toString()}
                    onValueChange={(value) =>
                      setBulkAllocation((prev) => ({ ...prev, leave_type_id: Number.parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.description || `Leave Type ${type.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bulk-days">Allocated Days</Label>
                  <Input
                    id="bulk-days"
                    type="number"
                    value={bulkAllocation.allocated_days}
                    onChange={(e) =>
                      setBulkAllocation((prev) => ({ ...prev, allocated_days: Number.parseInt(e.target.value) || 0 }))
                    }
                    min="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bulk-department">Department (Optional)</Label>
                  <Select
                    value={bulkAllocation.department_id.toString()}
                    onValueChange={(value) =>
                      setBulkAllocation((prev) => ({ ...prev, department_id: Number.parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All Departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bulk-year">Year</Label>
                  <Input
                    id="bulk-year"
                    type="number"
                    value={bulkAllocation.year}
                    onChange={(e) =>
                      setBulkAllocation((prev) => ({
                        ...prev,
                        year: Number.parseInt(e.target.value) || new Date().getFullYear(),
                      }))
                    }
                    min="2020"
                    max="2030"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsBulkAllocationOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkAllocation} disabled={isBulkAllocating}>
                  {isBulkAllocating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Allocate
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => openAdjustmentModal(employees[0])}>
            <Plus className="mr-2 h-4 w-4" />
            Adjust Balance
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Allocated</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAllocated}</div>
            <p className="text-xs text-muted-foreground">Days allocated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Taken</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTaken}</div>
            <p className="text-xs text-muted-foreground">Days used</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.utilizationRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Leave usage</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detailed">Detailed View</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Search Employees</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All Departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(value) => setSelectedYear(Number.parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leave-type-filter">Leave Type</Label>
                  <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All Types</SelectItem>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.description || `Leave Type ${type.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee Balances Table */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Leave Balances</CardTitle>
              <CardDescription>
                {filteredEmployees.length} of {employeeBalances.length} employees
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No employees found matching your criteria</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Total Allocated</TableHead>
                      <TableHead>Total Taken</TableHead>
                      <TableHead>Total Remaining</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => {
                      const utilizationRate =
                        employee.totalAllocated > 0 ? (employee.totalTaken / employee.totalAllocated) * 100 : 0

                      return (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {employee.user_first_name} {employee.user_last_name}
                              </div>
                              <div className="text-sm text-muted-foreground">{employee.user_email}</div>
                            </div>
                          </TableCell>
                          <TableCell>{employee.department?.name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{employee.totalAllocated} days</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{employee.totalTaken} days</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">{employee.totalRemaining} days</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Progress value={utilizationRate} className="w-16" />
                              <span className="text-sm">{utilizationRate.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => openAdjustmentModal(employee)}>
                              <Edit className="h-4 w-4 mr-1" />
                              Adjust
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Leave Balances</CardTitle>
              <CardDescription>Breakdown by leave type for each employee</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {filteredEmployees.map((employee) => (
                  <div key={employee.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-semibold">
                          {employee.user_first_name} {employee.user_last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {employee.department?.name || "No Department"} • {employee.user_email}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openAdjustmentModal(employee)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Adjust
                      </Button>
                    </div>

                    {employee.balances.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">No leave balances configured</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {employee.balances.map((balance) => (
                          <Card key={balance.id}>
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <h4 className="font-medium">{balance.leave_type_name}</h4>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span>Allocated:</span>
                                    <span>{balance.allocated_days} days</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Taken:</span>
                                    <span>{balance.taken_days} days</span>
                                  </div>
                                  <div className="flex justify-between font-medium">
                                    <span>Remaining:</span>
                                    <span className="text-green-600">{balance.balance_days} days</span>
                                  </div>
                                </div>
                                <Progress
                                  value={
                                    balance.allocated_days > 0 ? (balance.taken_days / balance.allocated_days) * 100 : 0
                                  }
                                  className="h-2"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="w-full"
                                  onClick={() => openAdjustmentModal(employee, balance)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Adjust
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Leave Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leaveTypes.map((type) => {
                    const totalAllocated = employeeBalances.reduce(
                      (sum, emp) =>
                        sum +
                        emp.balances
                          .filter((b) => b.leave_type_id === type.id)
                          .reduce((s, b) => s + b.allocated_days, 0),
                      0,
                    )
                    const totalTaken = employeeBalances.reduce(
                      (sum, emp) =>
                        sum +
                        emp.balances.filter((b) => b.leave_type_id === type.id).reduce((s, b) => s + b.taken_days, 0),
                      0,
                    )
                    const utilizationRate = totalAllocated > 0 ? (totalTaken / totalAllocated) * 100 : 0

                    return (
                      <div key={type.id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{type.description || `Leave Type ${type.id}`}</span>
                          <span className="text-sm text-muted-foreground">{utilizationRate.toFixed(1)}%</span>
                        </div>
                        <Progress value={utilizationRate} />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Allocated: {totalAllocated}</span>
                          <span>Taken: {totalTaken}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Department Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {departments.map((dept) => {
                    const deptEmployees = employeeBalances.filter((emp) => emp.department?.id === dept.id)
                    const totalAllocated = deptEmployees.reduce((sum, emp) => sum + emp.totalAllocated, 0)
                    const totalTaken = deptEmployees.reduce((sum, emp) => sum + emp.totalTaken, 0)
                    const utilizationRate = totalAllocated > 0 ? (totalTaken / totalAllocated) * 100 : 0

                    return (
                      <div key={dept.id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{dept.name}</span>
                          <span className="text-sm text-muted-foreground">{deptEmployees.length} employees</span>
                        </div>
                        <Progress value={utilizationRate} />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Allocated: {totalAllocated}</span>
                          <span>
                            Taken: {totalTaken} ({utilizationRate.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Adjustment Modal */}
      <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Leave Balance</DialogTitle>
            <DialogDescription>
              {selectedEmployee && (
                <>
                  Adjust leave balance for {selectedEmployee.user_first_name} {selectedEmployee.user_last_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="adj-leave-type">Leave Type</Label>
              <Select
                value={adjustmentData.leave_type_id.toString()}
                onValueChange={(value) =>
                  setAdjustmentData((prev) => ({ ...prev, leave_type_id: Number.parseInt(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.description || `Leave Type ${type.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="adj-allocated">Allocated Days</Label>
                <Input
                  id="adj-allocated"
                  type="number"
                  value={adjustmentData.allocated_days}
                  onChange={(e) =>
                    setAdjustmentData((prev) => ({ ...prev, allocated_days: Number.parseInt(e.target.value) || 0 }))
                  }
                  min="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adj-taken">Taken Days</Label>
                <Input
                  id="adj-taken"
                  type="number"
                  value={adjustmentData.taken_days}
                  onChange={(e) =>
                    setAdjustmentData((prev) => ({ ...prev, taken_days: Number.parseInt(e.target.value) || 0 }))
                  }
                  min="0"
                  max={adjustmentData.allocated_days}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adj-year">Year</Label>
              <Input
                id="adj-year"
                type="number"
                value={adjustmentData.year}
                onChange={(e) =>
                  setAdjustmentData((prev) => ({
                    ...prev,
                    year: Number.parseInt(e.target.value) || new Date().getFullYear(),
                  }))
                }
                min="2020"
                max="2030"
              />
            </div>
            {adjustmentData.allocated_days > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Balance Preview</span>
                  <span className="text-sm">
                    {adjustmentData.allocated_days - adjustmentData.taken_days} days remaining
                  </span>
                </div>
                <Progress
                  value={
                    adjustmentData.allocated_days > 0
                      ? (adjustmentData.taken_days / adjustmentData.allocated_days) * 100
                      : 0
                  }
                />
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAdjustmentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustBalance} disabled={isAdjusting}>
              {isAdjusting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adjust Balance
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
