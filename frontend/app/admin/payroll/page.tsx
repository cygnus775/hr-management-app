"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  CalendarDays,
  Eye,
  Download,
  Filter,
  Search,
  ArrowUpDown,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  FileText,
  User,
  Plus,
  DollarSign,
  Users,
  Play,
  CreditCard,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/components/auth-provider"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import jsPDF from "jspdf"

interface PayrollRun {
  id: number
  month: number
  year: number
  status: "draft" | "pending_approval" | "approved" | "processed" | "paid" | "rejected"
  run_date: string
  processed_by_user_id?: number
  processed_by_user_email?: string
  notes?: string
}

interface Payslip {
  id: number
  employee_id: number
  payroll_run_id: number
  gross_earnings: number
  total_deductions: number
  net_salary: number
  salary_details: Record<string, any>
  total_working_days_in_month: number
  days_present: number
  paid_leave_days: number
  unpaid_leave_days: number
  loss_of_pay_deduction: number
  generated_at: string
  employee_first_name: string
  employee_last_name: string
  employee_email: string
  month: number
  year: number
}

interface SalaryComponent {
  id: number
  name: string
  type: "earning_fixed" | "earning_variable" | "deduction_fixed" | "deduction_variable" | "statutory_deduction"
  description?: string
  is_taxable: boolean
  calculation_formula?: string
}

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

interface PaymentGatewayResponse {
  transaction_id: string
  status: "success" | "failed" | "pending"
  message: string
}

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  processed: "bg-green-100 text-green-800",
  paid: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
}

const statusIcons = {
  draft: Clock,
  pending_approval: AlertCircle,
  approved: CheckCircle,
  processed: CheckCircle,
  paid: CheckCircle,
  rejected: XCircle,
}

export default function PayrollManagementPage() {
  const { user, token } = useAuth()
  const { toast } = useToast()

  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [allPayslips, setAllPayslips] = useState<Payslip[]>([])
  const [salaryComponents, setSalaryComponents] = useState<SalaryComponent[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeSalaryStructures, setEmployeeSalaryStructures] = useState<Record<number, EmployeeSalaryStructure[]>>(
    {},
  )

  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null)
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [paymentProcessing, setPaymentProcessing] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"date" | "employee" | "amount">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const [paymentProgress, setPaymentProgress] = useState(0)
  const [paymentResults, setPaymentResults] = useState<Record<number, PaymentGatewayResponse>>({})

  // Dialog states
  const [showCreateRun, setShowCreateRun] = useState(false)
  const [showCreateComponent, setShowCreateComponent] = useState(false)
  const [showAddStructure, setShowAddStructure] = useState(false)

  // Form states
  const [newRun, setNewRun] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    employee_ids: [] as number[],
  })

  const [newComponent, setNewComponent] = useState({
    name: "",
    type: "earning_fixed" as const,
    description: "",
    is_taxable: true,
    calculation_formula: "",
  })

  const [newStructure, setNewStructure] = useState({
    employee_id: 0,
    component_id: 0,
    amount: 0,
    effective_from: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    if (token) {
      fetchAllData()
    }
  }, [token])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      const [runsResponse, componentsResponse, employeesResponse] = await Promise.all([
        apiClient.get<PayrollRun[]>("/api/v1/payroll/runs/", token),
        apiClient.get<SalaryComponent[]>("/api/v1/payroll/components/", token),
        apiClient.get<Employee[]>("/api/v1/employees/", token),
      ])

      if (runsResponse.success) {
        setPayrollRuns(runsResponse.data || [])

        // After getting all runs, fetch payslips for each run
        if (runsResponse.data && runsResponse.data.length > 0) {
          await fetchAllPayslips(runsResponse.data)
        }
      }

      if (componentsResponse.success) {
        setSalaryComponents(componentsResponse.data || [])
      }

      if (employeesResponse.success) {
        setEmployees(employeesResponse.data || [])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch payroll data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchAllPayslips = async (runs: PayrollRun[]) => {
    try {
      const allPayslipsPromises = runs.map((run) =>
        apiClient.get<Payslip[]>(`/api/v1/payroll/runs/${run.id}/payslips`, token),
      )

      const responses = await Promise.all(allPayslipsPromises)

      let combinedPayslips: Payslip[] = []
      responses.forEach((response) => {
        if (response.success && response.data) {
          combinedPayslips = [...combinedPayslips, ...response.data]
        }
      })

      setAllPayslips(combinedPayslips)
    } catch (error) {
      console.error("Error fetching all payslips:", error)
      toast({
        title: "Error",
        description: "Failed to fetch all payslips",
        variant: "destructive",
      })
    }
  }

  const fetchPayslips = async (runId: number) => {
    try {
      const response = await apiClient.get<Payslip[]>(`/api/v1/payroll/runs/${runId}/payslips`, token)
      if (response.success) {
        setPayslips(response.data || [])
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch payslips",
        variant: "destructive",
      })
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

  const createPayrollRun = async () => {
    try {
      const response = await apiClient.post<PayrollRun>("/api/v1/payroll/runs/", newRun, token)
      if (response.success) {
        toast({
          title: "Success",
          description: "Payroll run created successfully",
        })
        setShowCreateRun(false)
        setNewRun({
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          employee_ids: [],
        })
        fetchAllData()
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create payroll run",
        variant: "destructive",
      })
    }
  }

  const createSalaryComponent = async () => {
    try {
      const response = await apiClient.post<SalaryComponent>("/api/v1/payroll/components/", newComponent, token)
      if (response.success) {
        toast({
          title: "Success",
          description: "Salary component created successfully",
        })
        setShowCreateComponent(false)
        setNewComponent({
          name: "",
          type: "earning_fixed",
          description: "",
          is_taxable: true,
          calculation_formula: "",
        })
        fetchAllData()
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create salary component",
        variant: "destructive",
      })
    }
  }

  const addEmployeeSalaryStructure = async () => {
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

  const updatePayrollStatus = async (runId: number, status: string, notes?: string) => {
    try {
      setProcessing(true)
      const response = await apiClient.put(`/api/v1/payroll/runs/${runId}/status`, { status, notes }, token)
      if (response.success) {
        toast({
          title: "Success",
          description: "Payroll run status updated successfully",
        })
        fetchAllData()
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update payroll run status",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const processPayments = async (runId: number) => {
    try {
      setPaymentProcessing(true)
      setPaymentProgress(0)
      const newPaymentResults: Record<number, PaymentGatewayResponse> = {}

      const payslipsToProcess = payslips.filter((p) => p.payroll_run_id === runId)
      const totalPayslips = payslipsToProcess.length

      for (let i = 0; i < payslipsToProcess.length; i++) {
        const payslip = payslipsToProcess[i]
        const paymentResult = await simulatePaymentGateway(payslip)

        newPaymentResults[payslip.id] = paymentResult
        setPaymentResults((prev) => ({ ...prev, [payslip.id]: paymentResult }))
        setPaymentProgress(((i + 1) / totalPayslips) * 100)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      // Check if all payments were successful
      const allSuccessful = Object.values(newPaymentResults).every((result) => result.status === "success")

      if (allSuccessful) {
        await updatePayrollStatus(runId, "paid", "All payments processed successfully via payment gateway")
        toast({
          title: "Success",
          description: "All payments processed successfully and payroll marked as paid",
        })
      } else {
        toast({
          title: "Warning",
          description: "Some payments failed. Please review and retry failed payments.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process payments",
        variant: "destructive",
      })
    } finally {
      setPaymentProcessing(false)
    }
  }

  const simulatePaymentGateway = async (payslip: Payslip): Promise<PaymentGatewayResponse> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const success = Math.random() > 0.1
        resolve({
          transaction_id: `TXN_${Date.now()}_${payslip.id}`,
          status: success ? "success" : "failed",
          message: success ? "Payment processed successfully" : "Payment failed - insufficient funds",
        })
      }, 1000)
    })
  }

  const getMonthName = (month: number) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]
    return months[month - 1]
  }

  const getPaymentStatus = (payslipId: number) => {
    const result = paymentResults[payslipId]
    if (!result) return "pending"
    return result.status
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const calculateTotalSalary = (structures: EmployeeSalaryStructure[]) => {
    const earnings = structures
      .filter((s) => s.component_type.includes("earning"))
      .reduce((total, s) => total + s.amount, 0)

    const deductions = structures
      .filter((s) => s.component_type.includes("deduction"))
      .reduce((total, s) => total + s.amount, 0)

    return { earnings, deductions, net: earnings - deductions }
  }

  const downloadBankAdvice = async (runId: number) => {
    try {
      const response = await apiClient.get(`/api/v1/payroll/runs/${runId}/bank-advice`, token, { responseType: "blob" })

      if (response.success && response.data) {
        const blob = new Blob([response.data as BlobPart], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `bank_advice_payroll_run_${runId}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        toast({
          title: "Error",
          description: "Failed to download bank advice",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error downloading bank advice:", error)
      toast({
        title: "Error",
        description: "Failed to download bank advice",
        variant: "destructive",
      })
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
          <p className="text-muted-foreground">Manage salary calculations, deductions, and payslips</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payrollRuns.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Components</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salaryComponents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Month</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getMonthName(new Date().getMonth() + 1)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="runs" className="space-y-6">
        <TabsList>
          <TabsTrigger value="runs">Payroll Runs</TabsTrigger>
          <TabsTrigger value="components">Salary Components</TabsTrigger>
          <TabsTrigger value="employees">Employee Structures</TabsTrigger>
          <TabsTrigger value="payslips">All Payslips</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Payroll Runs</CardTitle>
                  <CardDescription>Manage and process payroll runs</CardDescription>
                </div>
                <Dialog open={showCreateRun} onOpenChange={setShowCreateRun}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Run
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Payroll Run</DialogTitle>
                      <DialogDescription>Create a new payroll run for processing salaries</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="month">Month</Label>
                          <Select
                            value={newRun.month.toString()}
                            onValueChange={(value) => setNewRun({ ...newRun, month: Number.parseInt(value) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  {getMonthName(i + 1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="year">Year</Label>
                          <Input
                            type="number"
                            value={newRun.year}
                            onChange={(e) => setNewRun({ ...newRun, year: Number.parseInt(e.target.value) })}
                            min="2020"
                            max="2030"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowCreateRun(false)}>
                          Cancel
                        </Button>
                        <Button onClick={createPayrollRun}>Create Run</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payrollRuns.map((run) => {
                  const StatusIcon = statusIcons[run.status]
                  return (
                    <div key={run.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <StatusIcon className="h-5 w-5" />
                        <div>
                          <h3 className="font-medium">
                            {getMonthName(run.month)} {run.year}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Run Date: {format(new Date(run.run_date), "PPP")}
                          </p>
                          {run.processed_by_user_email && (
                            <p className="text-sm text-muted-foreground">Processed by: {run.processed_by_user_email}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge className={statusColors[run.status]}>{run.status.replace("_", " ")}</Badge>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRun(run)
                            fetchPayslips(run.id)
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>

                        {run.status === "draft" && (
                          <Button size="sm" onClick={() => updatePayrollStatus(run.id, "processed")}>
                            Process
                          </Button>
                        )}
                        {run.status === "processed" && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => updatePayrollStatus(run.id, "paid", "Marked as paid manually")}
                            disabled={processing}
                          >
                            Mark as Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Salary Components</CardTitle>
                  <CardDescription>Manage earnings and deduction components</CardDescription>
                </div>
                <Dialog open={showCreateComponent} onOpenChange={setShowCreateComponent}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Component
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Salary Component</DialogTitle>
                      <DialogDescription>Add a new salary component for earnings or deductions</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Component Name</Label>
                        <Input
                          value={newComponent.name}
                          onChange={(e) => setNewComponent({ ...newComponent, name: e.target.value })}
                          placeholder="e.g., Basic Salary, HRA, PF"
                        />
                      </div>
                      <div>
                        <Label htmlFor="type">Component Type</Label>
                        <Select
                          value={newComponent.type}
                          onValueChange={(value: any) => setNewComponent({ ...newComponent, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="earning_fixed">Fixed Earning</SelectItem>
                            <SelectItem value="earning_variable">Variable Earning</SelectItem>
                            <SelectItem value="deduction_fixed">Fixed Deduction</SelectItem>
                            <SelectItem value="deduction_variable">Variable Deduction</SelectItem>
                            <SelectItem value="statutory_deduction">Statutory Deduction</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          value={newComponent.description}
                          onChange={(e) => setNewComponent({ ...newComponent, description: e.target.value })}
                          placeholder="Component description"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is_taxable"
                          checked={newComponent.is_taxable}
                          onCheckedChange={(checked) => setNewComponent({ ...newComponent, is_taxable: !!checked })}
                        />
                        <Label htmlFor="is_taxable">Taxable Component</Label>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowCreateComponent(false)}>
                          Cancel
                        </Button>
                        <Button onClick={createSalaryComponent}>Create Component</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Taxable</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryComponents.map((component) => (
                    <TableRow key={component.id}>
                      <TableCell className="font-medium">{component.name}</TableCell>
                      <TableCell>
                        <Badge variant={component.type.includes("earning") ? "default" : "secondary"}>
                          {component.type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={component.is_taxable ? "default" : "secondary"}>
                          {component.is_taxable ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>{component.description || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Employee List */}
            <Card>
              <CardHeader>
                <CardTitle>Employees</CardTitle>
                <CardDescription>Select an employee to manage their salary structure</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {employees.map((employee) => (
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
                            <Button onClick={addEmployeeSalaryStructure}>Add Component</Button>
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
                                  <Badge
                                    variant={structure.component_type.includes("earning") ? "default" : "secondary"}
                                  >
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
                      <div className="text-center py-8 text-gray-500">
                        No salary structure configured for this employee
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Select an employee to view their salary structure
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payslips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Payslips</CardTitle>
              <CardDescription>View and filter all generated payslips</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by employee name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger className="w-[180px]">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="amount">Amount</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Gross Pay</TableHead>
                        <TableHead>Deductions</TableHead>
                        <TableHead>Net Pay</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allPayslips.length > 0 ? (
                        allPayslips
                          .filter((payslip) => {
                            if (searchTerm === "") return true
                            const fullName =
                              `${payslip.employee_first_name} ${payslip.employee_last_name}`.toLowerCase()
                            const email = payslip.employee_email.toLowerCase()
                            const search = searchTerm.toLowerCase()
                            return fullName.includes(search) || email.includes(search)
                          })
                          .filter((payslip) => {
                            if (statusFilter === "all") return true
                            const status = getPaymentStatus(payslip.id)
                            return status === statusFilter
                          })
                          .sort((a, b) => {
                            if (sortBy === "date") {
                              const dateA = new Date(a.year, a.month - 1)
                              const dateB = new Date(b.year, b.month - 1)
                              return sortOrder === "asc"
                                ? dateA.getTime() - dateB.getTime()
                                : dateB.getTime() - dateA.getTime()
                            } else if (sortBy === "employee") {
                              const nameA = `${a.employee_first_name} ${a.employee_last_name}`
                              const nameB = `${b.employee_first_name} ${b.employee_last_name}`
                              return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
                            } else if (sortBy === "amount") {
                              return sortOrder === "asc" ? a.net_salary - b.net_salary : b.net_salary - a.net_salary
                            }
                            return 0
                          })
                          .map((payslip) => (
                            <TableRow key={payslip.id}>
                              <TableCell>
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <User className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      {payslip.employee_first_name} {payslip.employee_last_name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{payslip.employee_email}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{format(new Date(payslip.year, payslip.month - 1), "MMM yyyy")}</TableCell>
                              <TableCell>₹{payslip.gross_earnings.toLocaleString()}</TableCell>
                              <TableCell>₹{payslip.total_deductions.toLocaleString()}</TableCell>
                              <TableCell className="font-medium">₹{payslip.net_salary.toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge className={getPaymentStatusColor(getPaymentStatus(payslip.id))}>
                                  {getPaymentStatus(payslip.id)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" onClick={() => setSelectedPayslip(payslip)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No payslips found</p>
                            <p className="text-sm">Payslips will appear here once payroll runs are processed</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payslip Detail Dialog */}
      <Dialog open={!!selectedPayslip} onOpenChange={() => setSelectedPayslip(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Payslip Details - {selectedPayslip?.employee_first_name} {selectedPayslip?.employee_last_name}
            </DialogTitle>
            <DialogDescription>
              {selectedPayslip && format(new Date(selectedPayslip.year, selectedPayslip.month - 1), "MMMM yyyy")}{" "}
              Payslip
            </DialogDescription>
          </DialogHeader>

          {selectedPayslip && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-lg mb-3">Employee Information</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span>
                          {selectedPayslip.employee_first_name} {selectedPayslip.employee_last_name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span>{selectedPayslip.employee_email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Employee ID:</span>
                        <span>{selectedPayslip.employee_id}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-lg mb-3">Pay Period</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Period:</span>
                        <span>{format(new Date(selectedPayslip.year, selectedPayslip.month - 1), "MMMM yyyy")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Generated:</span>
                        <span>{format(new Date(selectedPayslip.generated_at), "PPP")}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-lg mb-3">Attendance Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Working Days:</span>
                        <span>{selectedPayslip.total_working_days_in_month}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Days Present:</span>
                        <span>{selectedPayslip.days_present}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paid Leave Days:</span>
                        <span>{selectedPayslip.paid_leave_days}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Unpaid Leave Days:</span>
                        <span>{selectedPayslip.unpaid_leave_days}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-lg mb-3">Payment Status</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge className={getPaymentStatusColor(getPaymentStatus(selectedPayslip.id))}>
                          {getPaymentStatus(selectedPayslip.id)}
                        </Badge>
                      </div>
                      {paymentResults[selectedPayslip.id] && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Transaction ID:</span>
                          <span className="text-sm font-mono">{paymentResults[selectedPayslip.id].transaction_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Gross Earnings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      ₹{selectedPayslip.gross_earnings.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Total Deductions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      ₹{selectedPayslip.total_deductions.toLocaleString()}
                    </div>
                    {selectedPayslip.loss_of_pay_deduction > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Includes LOP: ₹{selectedPayslip.loss_of_pay_deduction.toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Net Salary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      ₹{selectedPayslip.net_salary.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedPayslip) {
                      try {
                        // Create a simple PDF with the payslip data
                        const doc = new jsPDF()

                        // Add company header
                        doc.setFontSize(18)
                        doc.text("HR Management System", 105, 20, { align: "center" })
                        doc.setFontSize(14)
                        doc.text("PAYSLIP", 105, 30, { align: "center" })

                        // Add horizontal line
                        doc.setLineWidth(0.5)
                        doc.line(20, 35, 190, 35)

                        // Employee and payslip details
                        doc.setFontSize(12)
                        doc.text(
                          `Employee: ${selectedPayslip.employee_first_name} ${selectedPayslip.employee_last_name}`,
                          20,
                          45,
                        )
                        doc.text(`Employee ID: ${selectedPayslip.employee_id}`, 20, 55)
                        doc.text(`Email: ${selectedPayslip.employee_email}`, 20, 65)

                        doc.text(
                          `Pay Period: ${format(new Date(selectedPayslip.year, selectedPayslip.month - 1), "MMMM yyyy")}`,
                          20,
                          75,
                        )
                        doc.text(`Generated: ${format(new Date(selectedPayslip.generated_at), "dd/MM/yyyy")}`, 20, 85)

                        // Attendance details
                        doc.setFontSize(13)
                        doc.setFont(undefined, "bold")
                        doc.text("Attendance Details", 20, 100)
                        doc.setFontSize(11)
                        doc.setFont(undefined, "normal")
                        doc.text(`Total Working Days: ${selectedPayslip.total_working_days_in_month}`, 25, 110)
                        doc.text(`Days Present: ${selectedPayslip.days_present}`, 25, 120)
                        doc.text(`Paid Leave Days: ${selectedPayslip.paid_leave_days}`, 25, 130)
                        doc.text(`Unpaid Leave Days: ${selectedPayslip.unpaid_leave_days}`, 25, 140)

                        // Financial summary
                        doc.setFontSize(13)
                        doc.setFont(undefined, "bold")
                        doc.text("Financial Summary", 20, 160)
                        doc.setFontSize(11)
                        doc.setFont(undefined, "normal")
                        doc.text(`Gross Earnings: Rs. ${selectedPayslip.gross_earnings.toLocaleString()}`, 25, 170)
                        doc.text(`Total Deductions: Rs. ${selectedPayslip.total_deductions.toLocaleString()}`, 25, 180)

                        if (selectedPayslip.loss_of_pay_deduction > 0) {
                          doc.text(
                            `Loss of Pay Deduction: Rs. ${selectedPayslip.loss_of_pay_deduction.toLocaleString()}`,
                            25,
                            190,
                          )
                        }

                        // Net salary with emphasis
                        doc.setFontSize(14)
                        doc.setFont(undefined, "bold")
                        doc.text(`Net Salary: Rs. ${selectedPayslip.net_salary.toLocaleString()}`, 25, 205)

                        // Add the raw JSON data
                        doc.addPage()
                        doc.setFontSize(10)
                        doc.setFont(undefined, "normal")
                        doc.text("Complete Payslip Data (JSON):", 20, 20)

                        // Format the JSON data for better readability
                        const jsonData = JSON.stringify(selectedPayslip, null, 2)
                        const jsonLines = jsonData.split("\n")

                        // Add each line of the JSON data
                        let yPos = 30
                        jsonLines.forEach((line) => {
                          if (yPos > 280) {
                            doc.addPage()
                            yPos = 20
                          }
                          // Truncate long lines to fit on page
                          const truncatedLine = line.length > 80 ? line.substring(0, 80) + "..." : line
                          doc.text(truncatedLine, 20, yPos)
                          yPos += 5
                        })

                        // Save the PDF
                        const fileName = `payslip-${selectedPayslip.employee_first_name}-${selectedPayslip.employee_last_name}-${format(new Date(selectedPayslip.year, selectedPayslip.month - 1), "MMM-yyyy")}.pdf`
                        doc.save(fileName)

                        toast({
                          title: "Success",
                          description: "Payslip PDF downloaded successfully",
                        })
                      } catch (error) {
                        console.error("Error generating PDF:", error)
                        toast({
                          title: "Error",
                          description: "Failed to generate PDF. Please try again.",
                          variant: "destructive",
                        })
                      }
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Payroll Run Details - {selectedRun && getMonthName(selectedRun.month)} {selectedRun?.year}
            </DialogTitle>
            <DialogDescription>Details of the payroll run, including status and payslips information</DialogDescription>
          </DialogHeader>

          {selectedRun && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-medium text-lg mb-3">Run Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Month/Year:</span>
                      <span>
                        {getMonthName(selectedRun.month)} {selectedRun.year}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Run Date:</span>
                      <span>{format(new Date(selectedRun.run_date), "PPP")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge className={statusColors[selectedRun.status]}>{selectedRun.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-lg mb-3">Processing Details</h3>
                  <div className="space-y-2">
                    {selectedRun.processed_by_user_email ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Processed By:</span>
                          <span>{selectedRun.processed_by_user_email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Processed On:</span>
                          <span>{format(new Date(selectedRun.run_date), "PPP")}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Not yet processed</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-lg mb-3">Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Payslips:</span>
                      <span>{payslips.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Amount:</span>
                      <span>₹{payslips.reduce((sum, p) => sum + p.net_salary, 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Salary:</span>
                      <span>
                        ₹
                        {payslips.length > 0
                          ? (payslips.reduce((sum, p) => sum + p.net_salary, 0) / payslips.length).toLocaleString()
                          : "0"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {selectedRun.notes && (
                <>
                  <div>
                    <h3 className="font-medium text-lg mb-3">Notes</h3>
                    <p className="text-muted-foreground">{selectedRun.notes}</p>
                  </div>
                  <Separator />
                </>
              )}

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium text-lg">Payslips ({payslips.length})</h3>
                  <div className="flex space-x-2">
                    {selectedRun.status === "processed" && (
                      <>
                        <Button
                          variant="default"
                          onClick={() => processPayments(selectedRun.id)}
                          disabled={paymentProcessing}
                          size="sm"
                        >
                          {paymentProcessing ? (
                            <>
                              Processing...
                              <div className="ml-2 w-16">
                                <Progress value={paymentProgress} className="h-2" />
                              </div>
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-4 w-4 mr-2" />
                              Process Payments
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => updatePayrollStatus(selectedRun.id, "paid", "Marked as paid manually")}
                          disabled={processing}
                          size="sm"
                        >
                          Mark as Paid
                        </Button>
                      </>
                    )}
                    <Button variant="outline" onClick={() => downloadBankAdvice(selectedRun.id)} size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Bank Advice
                    </Button>
                  </div>
                </div>

                {payslips.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Working Days</TableHead>
                          <TableHead>Present Days</TableHead>
                          <TableHead>Gross Earnings</TableHead>
                          <TableHead>Deductions</TableHead>
                          <TableHead>Net Salary</TableHead>
                          <TableHead>Payment Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payslips.map((payslip) => (
                          <TableRow key={payslip.id}>
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <User className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {payslip.employee_first_name} {payslip.employee_last_name}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{payslip.employee_email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {employees.find((e) => e.id === payslip.employee_id)?.department?.name || "N/A"}
                            </TableCell>
                            <TableCell>{payslip.total_working_days_in_month}</TableCell>
                            <TableCell>
                              <div className="text-center">
                                <span className="font-medium">{payslip.days_present}</span>
                                {payslip.paid_leave_days > 0 && (
                                  <div className="text-xs text-green-600">+{payslip.paid_leave_days} PL</div>
                                )}
                                {payslip.unpaid_leave_days > 0 && (
                                  <div className="text-xs text-red-600">-{payslip.unpaid_leave_days} UL</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-green-600">
                              ₹{payslip.gross_earnings.toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium text-red-600">
                              ₹{payslip.total_deductions.toLocaleString()}
                              {payslip.loss_of_pay_deduction > 0 && (
                                <div className="text-xs text-red-500">
                                  LOP: ₹{payslip.loss_of_pay_deduction.toLocaleString()}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-bold text-blue-600">
                              ₹{payslip.net_salary.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={getPaymentStatusColor(getPaymentStatus(payslip.id))}>
                                {getPaymentStatus(payslip.id)}
                              </Badge>
                              {paymentResults[payslip.id]?.transaction_id && (
                                <div className="text-xs text-muted-foreground mt-1 font-mono">
                                  {paymentResults[payslip.id].transaction_id.slice(-8)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-1">
                                <Button variant="outline" size="sm" onClick={() => setSelectedPayslip(payslip)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (payslip) {
                                      try {
                                        // Create a simple PDF with the payslip data
                                        const doc = new jsPDF()

                                        // Add company header
                                        doc.setFontSize(18)
                                        doc.text("HR Management System", 105, 20, { align: "center" })
                                        doc.setFontSize(14)
                                        doc.text("PAYSLIP", 105, 30, { align: "center" })

                                        // Add horizontal line
                                        doc.setLineWidth(0.5)
                                        doc.line(20, 35, 190, 35)

                                        // Employee and payslip details
                                        doc.setFontSize(12)
                                        doc.text(
                                          `Employee: ${payslip.employee_first_name} ${payslip.employee_last_name}`,
                                          20,
                                          45,
                                        )
                                        doc.text(`Employee ID: ${payslip.employee_id}`, 20, 55)
                                        doc.text(`Email: ${payslip.employee_email}`, 20, 65)

                                        doc.text(
                                          `Pay Period: ${format(new Date(payslip.year, payslip.month - 1), "MMMM yyyy")}`,
                                          20,
                                          75,
                                        )
                                        doc.text(
                                          `Generated: ${format(new Date(payslip.generated_at), "dd/MM/yyyy")}`,
                                          20,
                                          85,
                                        )

                                        // Attendance details
                                        doc.setFontSize(13)
                                        doc.setFont(undefined, "bold")
                                        doc.text("Attendance Details", 20, 100)
                                        doc.setFontSize(11)
                                        doc.setFont(undefined, "normal")
                                        doc.text(`Total Working Days: ${payslip.total_working_days_in_month}`, 25, 110)
                                        doc.text(`Days Present: ${payslip.days_present}`, 25, 120)
                                        doc.text(`Paid Leave Days: ${payslip.paid_leave_days}`, 25, 130)
                                        doc.text(`Unpaid Leave Days: ${payslip.unpaid_leave_days}`, 25, 140)

                                        // Financial summary
                                        doc.setFontSize(13)
                                        doc.setFont(undefined, "bold")
                                        doc.text("Financial Summary", 20, 160)
                                        doc.setFontSize(11)
                                        doc.setFont(undefined, "normal")
                                        doc.text(
                                          `Gross Earnings: Rs. ${payslip.gross_earnings.toLocaleString()}`,
                                          25,
                                          170,
                                        )
                                        doc.text(
                                          `Total Deductions: Rs. ${payslip.total_deductions.toLocaleString()}`,
                                          25,
                                          180,
                                        )

                                        if (payslip.loss_of_pay_deduction > 0) {
                                          doc.text(
                                            `Loss of Pay Deduction: Rs. ${payslip.loss_of_pay_deduction.toLocaleString()}`,
                                            25,
                                            190,
                                          )
                                        }

                                        // Net salary with emphasis
                                        doc.setFontSize(14)
                                        doc.setFont(undefined, "bold")
                                        doc.text(`Net Salary: Rs. ${payslip.net_salary.toLocaleString()}`, 25, 205)

                                        // Add the raw JSON data
                                        doc.addPage()
                                        doc.setFontSize(10)
                                        doc.setFont(undefined, "normal")
                                        doc.text("Complete Payslip Data (JSON):", 20, 20)

                                        // Format the JSON data for better readability
                                        const jsonData = JSON.stringify(payslip, null, 2)
                                        const jsonLines = jsonData.split("\n")

                                        // Add each line of the JSON data
                                        let yPos = 30
                                        jsonLines.forEach((line) => {
                                          if (yPos > 280) {
                                            doc.addPage()
                                            yPos = 20
                                          }
                                          // Truncate long lines to fit on page
                                          const truncatedLine = line.length > 80 ? line.substring(0, 80) + "..." : line
                                          doc.text(truncatedLine, 20, yPos)
                                          yPos += 5
                                        })

                                        // Save the PDF
                                        const fileName = `payslip-${payslip.employee_first_name}-${payslip.employee_last_name}-${format(new Date(payslip.year, payslip.month - 1), "MMM-yyyy")}.pdf`
                                        doc.save(fileName)

                                        toast({
                                          title: "Success",
                                          description: "Payslip PDF downloaded successfully",
                                        })
                                      } catch (error) {
                                        console.error("Error generating PDF:", error)
                                        toast({
                                          title: "Error",
                                          description: "Failed to generate PDF. Please try again.",
                                          variant: "destructive",
                                        })
                                      }
                                    }
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No payslips found for this payroll run</p>
                    <p className="text-sm">Payslips will appear here once the payroll is processed</p>
                  </div>
                )}
              </div>

              {paymentProcessing && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <div className="flex-1">
                      <p className="font-medium">Processing Payments...</p>
                      <p className="text-sm text-muted-foreground">
                        {Math.round(paymentProgress)}% complete ({Math.round((paymentProgress * payslips.length) / 100)}{" "}
                        of {payslips.length} processed)
                      </p>
                    </div>
                  </div>
                  <Progress value={paymentProgress} className="mt-3" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
