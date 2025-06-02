"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, FileText, Target, DollarSign, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"

interface LeaveBalance {
  leave_type_name: string
  balance_days: number
}

interface LeaveRequest {
  id: number
  leave_type_name: string
  start_date: string
  end_date: string
  status: string
  applied_on: string
}

interface EmployeeProfile {
  id: number
  job_title: string | null
  employment_status: string
  department: {
    id: number
    name: string
  } | null
}

export default function EmployeeDashboard() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fetchWithAuth, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)

        // Fetch employee profile
        const profileResponse = await fetchWithAuth("/api/v1/employees/me/profile")

        // Fetch leave balances
        const leaveBalancesResponse = await fetchWithAuth("/api/v1/leaves/balances/me")

        // Fetch recent leave requests
        const leaveRequestsResponse = await fetchWithAuth("/api/v1/leaves/requests/me?limit=5")

        if (profileResponse.ok && leaveBalancesResponse.ok && leaveRequestsResponse.ok) {
          const profileData = await profileResponse.json()
          const balancesData = await leaveBalancesResponse.json()
          const requestsData = await leaveRequestsResponse.json()

          setProfile(profileData)
          setLeaveBalances(balancesData)
          setLeaveRequests(requestsData)
        } else {
          setError("Failed to fetch dashboard data")
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err)
        setError("An error occurred while fetching dashboard data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [fetchWithAuth])

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

  // Calculate total leave balance
  const totalLeaveBalance = leaveBalances.reduce((total, balance) => total + balance.balance_days, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.firstName}!</h1>
        <p className="text-muted-foreground">
          {profile?.job_title ? `${profile.job_title}` : ""}
          {profile?.department ? ` • ${profile.department.name} Department` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leave Balance</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeaveBalance}</div>
            <p className="text-xs text-muted-foreground">Days remaining</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goals Progress</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Current objectives</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Payslip</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">View details</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks you might need</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => router.push("/employee/leaves")}
              >
                <Calendar className="h-6 w-6 mb-2" />
                <span className="text-sm">Apply Leave</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => router.push("/employee/performance")}
              >
                <Target className="h-6 w-6 mb-2" />
                <span className="text-sm">View Goals</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => router.push("/employee/payslips")}
              >
                <FileText className="h-6 w-6 mb-2" />
                <span className="text-sm">View Payslip</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => router.push("/employee/profile")}
              >
                <FileText className="h-6 w-6 mb-2" />
                <span className="text-sm">My Profile</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Your recent work activities</CardDescription>
          </CardHeader>
          <CardContent>
            {leaveRequests.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No recent activities</div>
            ) : (
              <div className="space-y-4">
                {leaveRequests.map((request) => (
                  <div key={request.id} className="flex items-center space-x-4">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        request.status === "approved"
                          ? "bg-green-500"
                          : request.status === "rejected"
                            ? "bg-red-500"
                            : "bg-blue-500"
                      }`}
                    ></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Leave request {request.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {request.leave_type_name}: {new Date(request.start_date).toLocaleDateString()} -{" "}
                        {new Date(request.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(request.applied_on).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
