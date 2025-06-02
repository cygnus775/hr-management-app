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
import { Calendar, Clock, CheckCircle, XCircle, Loader2, Search, Plus, RefreshCw } from "lucide-react"
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

interface LeaveType {
  id: number
  description: string | null
  default_days_annually: number | null
  is_paid: boolean
  requires_approval: boolean
}

interface LeaveRequest {
  id: number
  employee_id: number
  leave_type_id: number
  start_date: string
  end_date: string
  reason: string | null
  status: "pending" | "approved" | "rejected" | "cancelled"
  number_of_days: number
  applied_on: string
  manager_remarks: string | null
  approved_or_rejected_by_id: number | null
  approved_or_rejected_on: string | null
  employee_first_name: string
  employee_last_name: string
  leave_type_name: string
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
}

export default function AdminLeavesPage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedEmployee, setSelectedEmployee] = useState<string>("0")
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("0")
  const [isActionLoading, setIsActionLoading] = useState<number | null>(null)

  // New leave type form
  const [isCreateTypeOpen, setIsCreateTypeOpen] = useState(false)
  const [newLeaveType, setNewLeaveType] = useState({
    description: "",
    default_days_annually: 0,
    is_paid: true,
    requires_approval: true,
  })

  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  const fetchLeaveData = async () => {
    try {
      setIsRefreshing(true)
      setError(null)

      console.log("Fetching admin leave data...")

      // Fetch team leave requests
      const requestsResponse = await fetchWithAuth("/api/v1/leaves/requests/team?limit=100")
      console.log("Team requests response status:", requestsResponse.status)

      // Fetch employees
      const employeesResponse = await fetchWithAuth("/api/v1/employees/")
      console.log("Employees response status:", employeesResponse.status)

      // Fetch leave types
      const typesResponse = await fetchWithAuth("/api/v1/leaves/types/?limit=100")
      console.log("Leave types response status:", typesResponse.status)

      // Process leave requests
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json()
        setLeaveRequests(Array.isArray(requestsData) ? requestsData : [])
      } else {
        console.error("Failed to fetch team requests:", requestsResponse.status)

        // Try alternative approach - fetch by status
        try {
          const allRequests: LeaveRequest[] = []
          const statuses = ["pending", "approved", "rejected", "cancelled"]

          for (const status of statuses) {
            const statusResponse = await fetchWithAuth(`/api/v1/leaves/requests/team?limit=100&status=${status}`)
            if (statusResponse.ok) {
              const statusData = await statusResponse.json()
              if (Array.isArray(statusData)) {
                allRequests.push(...statusData)
              }
            }
          }

          if (allRequests.length > 0) {
            setLeaveRequests(allRequests)
            console.log(`Fetched ${allRequests.length} requests using status filters`)
          }
        } catch (err) {
          console.error("Alternative request fetch failed:", err)
        }
      }

      // Process employees
      if (employeesResponse.ok) {
        const employeesData = await employeesResponse.json()
        setEmployees(Array.isArray(employeesData) ? employeesData : [])
      } else {
        console.error("Failed to fetch employees:", employeesResponse.status)
      }

      // Process leave types
      if (typesResponse.ok) {
        const typesData = await typesResponse.json()
        setLeaveTypes(Array.isArray(typesData) ? typesData : [])
      } else {
        console.error("Failed to fetch leave types:", typesResponse.status)
      }

      // If all critical requests failed, show error
      if (!requestsResponse.ok && !employeesResponse.ok) {
        setError("Failed to fetch leave management data. Please check your permissions and try again.")
      }
    } catch (err) {
      console.error("Error fetching leave data:", err)
      setError("An error occurred while fetching leave data. Please try again later.")
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaveData()
  }, [fetchWithAuth])

  const handleLeaveAction = async (requestId: number, status: "approved" | "rejected", remarks?: string) => {
    try {
      setIsActionLoading(requestId)

      console.log(`Attempting to ${status} leave request ${requestId}`)

      const response = await fetchWithAuth(`/api/v1/leaves/requests/${requestId}/action`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          manager_remarks: remarks || null,
        }),
      })

      console.log(`Action response status: ${response.status}`)

      if (response.ok) {
        const updatedRequest = await response.json()
        setLeaveRequests((prev) => prev.map((req) => (req.id === requestId ? updatedRequest : req)))

        toast({
          title: `Leave request ${status}`,
          description: `The leave request has been ${status} successfully`,
        })
      } else if (response.status === 403) {
        console.error("403 Forbidden - Admin user may not have permission to approve/reject leave requests")

        const errorData = await response.json().catch(() => null)
        console.log("Error details:", errorData)

        toast({
          title: "Permission Denied",
          description:
            "Admin users may not have permission to approve/reject leave requests. This action might be restricted to managers only.",
          variant: "destructive",
        })
      } else {
        const errorData = await response.json().catch(() => null)
        console.error("Action failed:", response.status, errorData)

        toast({
          title: "Action failed",
          description: errorData?.detail || `Failed to ${status} leave request (Status: ${response.status})`,
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error updating leave request:", err)
      toast({
        title: "Error",
        description: "An error occurred while updating the leave request",
        variant: "destructive",
      })
    } finally {
      setIsActionLoading(null)
    }
  }

  const handleCreateLeaveType = async () => {
    try {
      const response = await fetchWithAuth("/api/v1/leaves/types/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newLeaveType),
      })

      if (response.ok) {
        const createdType = await response.json()
        setLeaveTypes((prev) => [...prev, createdType])
        setIsCreateTypeOpen(false)
        setNewLeaveType({
          description: "",
          default_days_annually: 0,
          is_paid: true,
          requires_approval: true,
        })

        toast({
          title: "Leave type created",
          description: "New leave type has been created successfully",
        })
      } else {
        const errorData = await response.json().catch(() => null)
        toast({
          title: "Creation failed",
          description: errorData?.detail || "Failed to create leave type",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error creating leave type:", err)
      toast({
        title: "Error",
        description: "An error occurred while creating the leave type",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pending", variant: "secondary" as const },
      approved: { label: "Approved", variant: "default" as const },
      rejected: { label: "Rejected", variant: "destructive" as const },
      cancelled: { label: "Cancelled", variant: "outline" as const },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  // Filter leave requests
  const filteredRequests = leaveRequests.filter((request) => {
    const matchesSearch =
      request.employee_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.employee_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.leave_type_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || request.status === statusFilter
    const matchesEmployee = selectedEmployee === "0" || request.employee_id.toString() === selectedEmployee
    const matchesLeaveType = selectedLeaveType === "0" || request.leave_type_id.toString() === selectedLeaveType

    return matchesSearch && matchesStatus && matchesEmployee && matchesLeaveType
  })

  // Calculate statistics
  const stats = {
    totalRequests: leaveRequests.length,
    pendingRequests: leaveRequests.filter((r) => r.status === "pending").length,
    approvedRequests: leaveRequests.filter((r) => r.status === "approved").length,
    rejectedRequests: leaveRequests.filter((r) => r.status === "rejected").length,
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground">Manage employee leave requests and policies</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={fetchLeaveData} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh Data
          </Button>
          <Dialog open={isCreateTypeOpen} onOpenChange={setIsCreateTypeOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Leave Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Leave Type</DialogTitle>
                <DialogDescription>Add a new leave type to the system</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newLeaveType.description}
                    onChange={(e) => setNewLeaveType((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., Annual Leave, Sick Leave"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="default_days">Default Days Annually</Label>
                  <Input
                    id="default_days"
                    type="number"
                    value={newLeaveType.default_days_annually}
                    onChange={(e) =>
                      setNewLeaveType((prev) => ({
                        ...prev,
                        default_days_annually: Number.parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_paid"
                    checked={newLeaveType.is_paid}
                    onChange={(e) => setNewLeaveType((prev) => ({ ...prev, is_paid: e.target.checked }))}
                  />
                  <Label htmlFor="is_paid">Paid Leave</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="requires_approval"
                    checked={newLeaveType.requires_approval}
                    onChange={(e) => setNewLeaveType((prev) => ({ ...prev, requires_approval: e.target.checked }))}
                  />
                  <Label htmlFor="requires_approval">Requires Approval</Label>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateTypeOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateLeaveType}>Create Leave Type</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests}</div>
            <p className="text-xs text-muted-foreground">All accessible requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedRequests}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejectedRequests}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Leave Requests</TabsTrigger>
          <TabsTrigger value="types">Leave Types</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee">Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="All employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All Employees</SelectItem>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id.toString()}>
                          {employee.user_first_name} {employee.user_last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leave-type">Leave Type</Label>
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

          {/* Leave Requests Table */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Requests</CardTitle>
              <CardDescription>
                {filteredRequests.length} of {leaveRequests.length} requests found
                {leaveRequests.length === 0 && " - Use 'Refresh Data' to fetch latest requests"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <div className="text-muted-foreground">No leave requests found. This could be due to:</div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• No leave requests in the system</li>
                    <li>• API permissions limiting access</li>
                    <li>• Network connectivity issues</li>
                  </ul>
                  <Button onClick={fetchLeaveData} disabled={isRefreshing}>
                    {isRefreshing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Try Refresh
                  </Button>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No leave requests found matching your criteria
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Applied On</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.employee_first_name} {request.employee_last_name}
                        </TableCell>
                        <TableCell>{request.leave_type_name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(request.start_date).toLocaleDateString()} -{" "}
                            {new Date(request.end_date).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>{request.number_of_days} days</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>{new Date(request.applied_on).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {request.status === "pending" && (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleLeaveAction(request.id, "approved")}
                                disabled={isActionLoading === request.id}
                              >
                                {isActionLoading === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleLeaveAction(request.id, "rejected")}
                                disabled={isActionLoading === request.id}
                              >
                                {isActionLoading === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                                Reject
                              </Button>
                            </div>
                          )}
                          {request.status !== "pending" && (
                            <span className="text-sm text-muted-foreground">
                              {request.status === "approved"
                                ? "Approved"
                                : request.status === "rejected"
                                  ? "Rejected"
                                  : "Cancelled"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave Types</CardTitle>
              <CardDescription>Manage different types of leave available in your organization</CardDescription>
            </CardHeader>
            <CardContent>
              {leaveTypes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No leave types found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Default Days</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Requires Approval</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveTypes.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-medium">{type.description || `Leave Type ${type.id}`}</TableCell>
                        <TableCell>{type.default_days_annually || 0} days</TableCell>
                        <TableCell>
                          <Badge variant={type.is_paid ? "default" : "secondary"}>
                            {type.is_paid ? "Paid" : "Unpaid"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={type.requires_approval ? "default" : "secondary"}>
                            {type.requires_approval ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employees Overview</CardTitle>
              <CardDescription>All employees in the system ({employees.length} total)</CardDescription>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No employee data available. Try refreshing the page.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Leave Requests</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => {
                      const employeeRequests = leaveRequests.filter((req) => req.employee_id === employee.id)
                      const pendingRequests = employeeRequests.filter((req) => req.status === "pending")

                      return (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">
                            {employee.user_first_name} {employee.user_last_name}
                          </TableCell>
                          <TableCell>{employee.user_email}</TableCell>
                          <TableCell>{employee.job_title || "N/A"}</TableCell>
                          <TableCell>{employee.department?.name || "N/A"}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Badge variant="outline">{employeeRequests.length} total</Badge>
                              {pendingRequests.length > 0 && (
                                <Badge variant="secondary">{pendingRequests.length} pending</Badge>
                              )}
                            </div>
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
      </Tabs>
    </div>
  )
}
