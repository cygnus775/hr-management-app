"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, Target, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface TeamMember {
  id: number
  user_first_name: string
  user_last_name: string
  job_title: string | null
  employment_status: string
  department: {
    id: number
    name: string
    description: string | null
  } | null
}

interface LeaveRequest {
  id: number
  employee_first_name: string
  employee_last_name: string
  start_date: string
  end_date: string
  reason: string | null
  status: string
}

export default function ManagerDashboard() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { fetchWithAuth } = useAuth()

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)

        // Fetch team members (employees under the manager)
        const employeesResponse = await fetchWithAuth("/api/v1/employees/")

        // Fetch pending leave requests
        const leavesResponse = await fetchWithAuth("/api/v1/leaves/requests/team?status=pending")

        if (employeesResponse.ok && leavesResponse.ok) {
          const employees = await employeesResponse.json()
          const leaves = await leavesResponse.json()

          // Filter employees to get direct reports (in a real app, this would be done by the API)
          // For now, we'll just use all employees as team members
          setTeamMembers(employees)
          setPendingLeaves(leaves)
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manager Dashboard</h1>
        <p className="text-muted-foreground">Manage your team effectively</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
            <p className="text-xs text-muted-foreground">Direct reports</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingLeaves.length}</div>
            <p className="text-xs text-muted-foreground">Leave requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Performance</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Goals completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Your direct reports</CardDescription>
          </CardHeader>
          <CardContent>
            {teamMembers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No team members found</div>
            ) : (
              <div className="space-y-4">
                {teamMembers.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {member.user_first_name.charAt(0)}
                        {member.user_last_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {member.user_first_name} {member.user_last_name}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          <span>{member.job_title || "—"}</span>
                          {member.department && (
                            <>
                              <span> • </span>
                              <span>{member.department.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {member.employment_status === "active" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                ))}
                {teamMembers.length > 5 && (
                  <div className="text-center text-sm text-muted-foreground pt-2">
                    +{teamMembers.length - 5} more team members
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Actions</CardTitle>
            <CardDescription>Items requiring your attention</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingLeaves.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No pending actions</div>
            ) : (
              <div className="space-y-4">
                {pendingLeaves.slice(0, 5).map((leave) => (
                  <div key={leave.id} className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Leave request from {leave.employee_first_name} {leave.employee_last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(leave.start_date).toLocaleDateString()} -{" "}
                        {new Date(leave.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">Pending</span>
                  </div>
                ))}
                {pendingLeaves.length > 5 && (
                  <div className="text-center text-sm text-muted-foreground pt-2">
                    +{pendingLeaves.length - 5} more pending requests
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
