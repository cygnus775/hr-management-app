"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Calendar, Clock, Loader2, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"

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

export default function ManagerMyLeavesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [reason, setReason] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { fetchWithAuth, user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchLeaveData = async () => {
      if (!user) {
        setError("User not authenticated")
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        console.log("Fetching leave data...")

        // Fetch leave types
        const leaveTypesResponse = await fetchWithAuth("/api/v1/leaves/types/")
        console.log("Leave types response status:", leaveTypesResponse.status)

        // Fetch leave balances
        const leaveBalancesResponse = await fetchWithAuth("/api/v1/leaves/balances/me")
        console.log("Leave balances response status:", leaveBalancesResponse.status)

        // Fetch leave requests
        const leaveRequestsResponse = await fetchWithAuth("/api/v1/leaves/requests/me")
        console.log("Leave requests response status:", leaveRequestsResponse.status)

        if (leaveTypesResponse.ok) {
          const typesData = await leaveTypesResponse.json()
          console.log("Leave types data:", typesData)
          setLeaveTypes(Array.isArray(typesData) ? typesData : [])
        } else {
          console.error("Failed to fetch leave types:", leaveTypesResponse.status)
        }

        if (leaveBalancesResponse.ok) {
          const balancesData = await leaveBalancesResponse.json()
          console.log("Leave balances data:", balancesData)
          setLeaveBalances(Array.isArray(balancesData) ? balancesData : [])
        } else {
          console.error("Failed to fetch leave balances:", leaveBalancesResponse.status)
        }

        if (leaveRequestsResponse.ok) {
          const requestsData = await leaveRequestsResponse.json()
          console.log("Leave requests data:", requestsData)
          setLeaveRequests(Array.isArray(requestsData) ? requestsData : [])
        } else {
          console.error("Failed to fetch leave requests:", leaveRequestsResponse.status)
        }

        // If any critical data failed to load, show error
        if (!leaveTypesResponse.ok && !leaveBalancesResponse.ok && !leaveRequestsResponse.ok) {
          setError("Failed to fetch leave data. Please try again later.")
        }
      } catch (err) {
        console.error("Error fetching leave data:", err)
        setError("An error occurred while fetching leave data. Please check your connection and try again.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeaveData()
  }, [fetchWithAuth, user])

  const calculateLeaveDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const timeDiff = end.getTime() - start.getTime()
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1 // +1 to include both start and end dates
  }

  const getLeaveBalance = (leaveTypeId: number): LeaveBalance | null => {
    return leaveBalances.find((balance) => balance.leave_type_id === leaveTypeId) || null
  }

  const validateLeaveBalance = (): boolean => {
    if (!selectedLeaveType || !startDate || !endDate) return false

    const leaveTypeId = Number.parseInt(selectedLeaveType, 10)
    const balance = getLeaveBalance(leaveTypeId)
    const requestedDays = calculateLeaveDays(startDate, endDate)

    if (!balance) {
      toast({
        title: "No leave balance found",
        description: "You don't have any allocation for this leave type",
        variant: "destructive",
      })
      return false
    }

    if (requestedDays > balance.balance_days) {
      toast({
        title: "Insufficient leave balance",
        description: `You only have ${balance.balance_days} days remaining for ${balance.leave_type_name}. You're requesting ${requestedDays} days.`,
        variant: "destructive",
      })
      return false
    }

    return true
  }

  const handleCancelRequest = async (requestId: number) => {
    try {
      const response = await fetchWithAuth(`/api/v1/leaves/requests/${requestId}/cancel`, {
        method: "PUT",
      })

      if (response.ok) {
        const updatedRequest = await response.json()
        setLeaveRequests((prev) => prev.map((req) => (req.id === requestId ? updatedRequest : req)))

        toast({
          title: "Leave request cancelled",
          description: "Your leave request has been cancelled successfully",
        })
      } else {
        const errorData = await response.json().catch(() => null)
        toast({
          title: "Failed to cancel request",
          description: errorData?.detail || "Please try again later",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error cancelling leave request:", err)
      toast({
        title: "Error",
        description: "An error occurred while cancelling your leave request",
        variant: "destructive",
      })
    }
  }

  const validateDates = () => {
    if (!startDate || !endDate) {
      toast({
        title: "Missing dates",
        description: "Please select both start and end dates",
        variant: "destructive",
      })
      return false
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (start < today) {
      toast({
        title: "Invalid start date",
        description: "Start date cannot be in the past",
        variant: "destructive",
      })
      return false
    }

    if (end < start) {
      toast({
        title: "Invalid date range",
        description: "End date cannot be before start date",
        variant: "destructive",
      })
      return false
    }

    return true
  }

  const handleSubmitLeaveRequest = async () => {
    if (!selectedLeaveType || !validateDates() || !validateLeaveBalance()) {
      return
    }

    try {
      setIsSubmitting(true)

      // Ensure proper data types according to API schema
      const requestData = {
        leave_type_id: Number.parseInt(selectedLeaveType, 10), // Ensure integer
        start_date: startDate, // Already in YYYY-MM-DD format
        end_date: endDate, // Already in YYYY-MM-DD format
        reason: reason.trim() || null, // Send null if empty, not empty string
      }

      console.log("Submitting leave request:", requestData)

      const response = await fetchWithAuth("/api/v1/leaves/requests/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      })

      console.log("Leave request response status:", response.status)

      if (response.ok) {
        const newLeaveRequest = await response.json()
        setLeaveRequests([newLeaveRequest, ...leaveRequests])

        toast({
          title: "Leave request submitted",
          description: "Your leave request has been submitted successfully",
        })

        // Reset form and close dialog
        setSelectedLeaveType("")
        setStartDate("")
        setEndDate("")
        setReason("")
        setIsDialogOpen(false)

        // Refresh leave balances
        try {
          const balancesResponse = await fetchWithAuth("/api/v1/leaves/balances/me")
          if (balancesResponse.ok) {
            const balancesData = await balancesResponse.json()
            setLeaveBalances(Array.isArray(balancesData) ? balancesData : [])
          }
        } catch (err) {
          console.error("Error refreshing balances:", err)
        }
      } else {
        const errorData = await response.json().catch(() => null)
        console.error("Leave request error:", errorData)

        let errorMessage = "Please try again later"
        if (errorData?.detail) {
          if (Array.isArray(errorData.detail)) {
            // Handle validation errors
            errorMessage = errorData.detail.map((err: any) => err.msg).join(", ")
          } else {
            errorMessage = errorData.detail
          }
        }

        toast({
          title: "Failed to submit leave request",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error submitting leave request:", err)
      toast({
        title: "Error",
        description: "An error occurred while submitting your leave request",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading leave data...</p>
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
          <Button variant="outline" size="sm" className="ml-4" onClick={() => window.location.reload()}>
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
          <h1 className="text-3xl font-bold">My Leave Management</h1>
          <p className="text-muted-foreground">Manage your personal leave requests and balances</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={leaveTypes.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
              <DialogDescription>Submit a new leave request for approval</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="leave-type">Leave Type</Label>
                <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((type) => {
                      const balance = getLeaveBalance(type.id)
                      return (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          <div className="flex justify-between items-center w-full">
                            <span>{type.description || `Leave Type ${type.id}`}</span>
                            {balance && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({balance.balance_days} days left)
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {selectedLeaveType && (
                  <div className="text-sm text-muted-foreground">
                    {(() => {
                      const balance = getLeaveBalance(Number.parseInt(selectedLeaveType, 10))
                      const requestedDays = startDate && endDate ? calculateLeaveDays(startDate, endDate) : 0

                      if (!balance) {
                        return <span className="text-red-600">No balance available for this leave type</span>
                      }

                      return (
                        <div className="flex justify-between">
                          <span>Available: {balance.balance_days} days</span>
                          {requestedDays > 0 && (
                            <span className={requestedDays > balance.balance_days ? "text-red-600" : "text-green-600"}>
                              Requesting: {requestedDays} days
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Please provide a reason for your leave request"
                  className="min-h-[80px]"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitLeaveRequest}
                disabled={
                  isSubmitting ||
                  !selectedLeaveType ||
                  !startDate ||
                  !endDate ||
                  (selectedLeaveType &&
                    startDate &&
                    endDate &&
                    calculateLeaveDays(startDate, endDate) >
                      (getLeaveBalance(Number.parseInt(selectedLeaveType, 10))?.balance_days || 0))
                }
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leave Balances */}
      {leaveBalances.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {leaveBalances.map((balance) => (
            <Card key={balance.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{balance.leave_type_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Allocated:</span>
                    <span>{balance.allocated_days} days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Taken:</span>
                    <span>{balance.taken_days} days</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span>Remaining:</span>
                    <span className="text-green-600">{balance.balance_days} days</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${balance.allocated_days > 0 ? (balance.taken_days / balance.allocated_days) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No leave balances found. Contact HR to set up your leave allocations.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Leave Requests */}
      <Card>
        <CardHeader>
          <CardTitle>My Leave Requests</CardTitle>
          <CardDescription>View your leave request history and status</CardDescription>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No leave requests found</p>
              <p className="text-sm">Apply for your first leave using the button above</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied On</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.leave_type_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(request.start_date).toLocaleDateString()} -{" "}
                          {new Date(request.end_date).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{request.number_of_days} days</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>{new Date(request.applied_on).toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-xs truncate">{request.reason || "—"}</TableCell>
                    <TableCell>
                      {request.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => handleCancelRequest(request.id)}>
                          Cancel
                        </Button>
                      )}
                      {request.status !== "pending" && request.manager_remarks && (
                        <div className="text-xs text-muted-foreground italic">"{request.manager_remarks}"</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
