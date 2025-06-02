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
import { Calendar, Clock, CheckCircle, XCircle, Loader2, Search } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

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

interface TeamMember {
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

export default function ManagerLeavesPage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [isActionLoading, setIsActionLoading] = useState<number | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [actionType, setActionType] = useState<"approved" | "rejected" | null>(null)
  const [managerRemarks, setManagerRemarks] = useState("")
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false)

  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  const fetchLeaveData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log("Fetching manager leave data...")

      // Fetch team leave requests
      const requestsResponse = await fetchWithAuth("/api/v1/leaves/requests/team?limit=100")
      console.log("Team requests response status:", requestsResponse.status)

      // Fetch team members
      const teamResponse = await fetchWithAuth("/api/v1/employees/")
      console.log("Team response status:", teamResponse.status)

      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json()
        setLeaveRequests(Array.isArray(requestsData) ? requestsData : [])
      } else {
        console.error("Failed to fetch team requests:", requestsResponse.status)
      }

      if (teamResponse.ok) {
        const teamData = await teamResponse.json()
        setTeamMembers(Array.isArray(teamData) ? teamData : [])
      } else {
        console.error("Failed to fetch team data:", teamResponse.status)
      }

      // If both critical requests failed, show error
      if (!requestsResponse.ok && !teamResponse.ok) {
        setError("Failed to fetch team leave data. Please check your permissions and try again.")
      }
    } catch (err) {
      console.error("Error fetching leave data:", err)
      setError("An error occurred while fetching leave data. Please try again later.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaveData()
  }, [fetchWithAuth])

  const handleLeaveAction = async () => {
    if (!selectedRequest || !actionType) return

    try {
      setIsActionLoading(selectedRequest.id)

      const response = await fetchWithAuth(`/api/v1/leaves/requests/${selectedRequest.id}/action`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: actionType,
          manager_remarks: managerRemarks || null,
        }),
      })

      if (response.ok) {
        const updatedRequest = await response.json()
        setLeaveRequests((prev) => prev.map((req) => (req.id === selectedRequest.id ? updatedRequest : req)))

        toast({
          title: `Leave request ${actionType}`,
          description: `The leave request has been ${actionType} successfully`,
        })

        setIsActionDialogOpen(false)
        setSelectedRequest(null)
        setActionType(null)
        setManagerRemarks("")
      } else {
        const errorData = await response.json().catch(() => null)
        toast({
          title: "Action failed",
          description: errorData?.detail || `Failed to ${actionType} leave request`,
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

  const openActionDialog = (request: LeaveRequest, action: "approved" | "rejected") => {
    setSelectedRequest(request)
    setActionType(action)
    setManagerRemarks("")
    setIsActionDialogOpen(true)
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
      request.employee_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.employee_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.leave_type_name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || request.status === statusFilter

    return matchesSearch && matchesStatus
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
      <div>
        <h1 className="text-3xl font-bold">Team Leave Management</h1>
        <p className="text-muted-foreground">Review and approve leave requests from your team</p>
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
            <p className="text-xs text-muted-foreground">From your team</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">Awaiting your approval</p>
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
          <TabsTrigger value="team">Team Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
            </CardContent>
          </Card>

          {/* Leave Requests Table */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Requests</CardTitle>
              <CardDescription>
                {filteredRequests.length} of {leaveRequests.length} requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredRequests.length === 0 ? (
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
                      <TableHead>Reason</TableHead>
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
                        <TableCell className="max-w-xs truncate">{request.reason || "—"}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>{new Date(request.applied_on).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {request.status === "pending" && (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => openActionDialog(request, "approved")}
                                disabled={isActionLoading === request.id}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openActionDialog(request, "rejected")}
                                disabled={isActionLoading === request.id}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                          {request.status !== "pending" && (
                            <div className="text-sm text-muted-foreground">
                              {request.status === "approved"
                                ? "Approved"
                                : request.status === "rejected"
                                  ? "Rejected"
                                  : "Cancelled"}
                              {request.manager_remarks && (
                                <div className="text-xs mt-1 italic">"{request.manager_remarks}"</div>
                              )}
                            </div>
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

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Overview of your team members and their leave status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamMembers.map((member) => {
                  const memberRequests = leaveRequests.filter((r) => r.employee_id === member.id)
                  const pendingCount = memberRequests.filter((r) => r.status === "pending").length

                  return (
                    <Card key={member.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {member.user_first_name.charAt(0)}
                            {member.user_last_name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">
                              {member.user_first_name} {member.user_last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{member.job_title || "Employee"}</p>
                            {member.department && (
                              <p className="text-xs text-muted-foreground">{member.department.name}</p>
                            )}
                          </div>
                          {pendingCount > 0 && <Badge variant="secondary">{pendingCount} pending</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === "approved" ? "Approve" : "Reject"} Leave Request</DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  {actionType === "approved" ? "Approve" : "Reject"} leave request from{" "}
                  {selectedRequest.employee_first_name} {selectedRequest.employee_last_name} for{" "}
                  {selectedRequest.number_of_days} days ({selectedRequest.leave_type_name})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="remarks">Manager Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                placeholder={`Add your comments for ${actionType === "approved" ? "approving" : "rejecting"} this request...`}
                value={managerRemarks}
                onChange={(e) => setManagerRemarks(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLeaveAction}
              disabled={isActionLoading !== null}
              variant={actionType === "approved" ? "default" : "destructive"}
            >
              {isActionLoading !== null && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionType === "approved" ? "Approve" : "Reject"} Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
