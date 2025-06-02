"use client"

import { DialogTrigger } from "@/components/ui/dialog"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Target, Calendar, Plus, Edit, Loader2, CheckCircle, Clock, AlertCircle, Users } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

interface AppraisalCycle {
  id: number
  name: string
  start_date: string
  end_date: string
  feedback_start_date: string | null
  feedback_end_date: string | null
  status: "draft" | "active" | "feedback_collection" | "review_meeting" | "closed" | "archived"
  description: string | null
}

interface Goal {
  id: number
  employee_id: number
  appraisal_cycle_id: number | null
  title: string
  description: string | null
  key_performance_indicator: string | null
  target_value: string | null
  start_date: string | null
  due_date: string | null
  status: "not_started" | "in_progress" | "completed" | "on_hold" | "cancelled"
  weightage: number | null
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

// Helper function to extract error messages
const extractErrorMessage = (errorData: any): string => {
  if (!errorData) return "An unknown error occurred"
  if (typeof errorData.detail === "string") return errorData.detail
  if (Array.isArray(errorData.detail)) {
    return errorData.detail.map((err: any) => err.msg || err.message || "Validation error").join(", ")
  }
  return errorData.message || errorData.error || "An error occurred"
}

export default function AdminPerformancePage() {
  const [activeTab, setActiveTab] = useState("cycles")
  const [cycles, setCycles] = useState<AppraisalCycle[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCycleDialogOpen, setIsCycleDialogOpen] = useState(false)
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState<AppraisalCycle | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null)

  // Form states
  const [cycleForm, setCycleForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    feedback_start_date: "",
    feedback_end_date: "",
  })

  const [goalForm, setGoalForm] = useState({
    employee_id: "",
    appraisal_cycle_id: "",
    title: "",
    description: "",
    key_performance_indicator: "",
    target_value: "",
    start_date: "",
    due_date: "",
    weightage: "",
  })

  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [fetchWithAuth])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch all data in parallel
      const [cyclesRes, employeesRes] = await Promise.all([
        fetchWithAuth("/api/v1/performance/cycles/"),
        fetchWithAuth("/api/v1/employees/"),
      ])

      if (cyclesRes.ok && employeesRes.ok) {
        const cyclesData = await cyclesRes.json()
        const employeesData = await employeesRes.json()

        setCycles(cyclesData)
        setEmployees(employeesData)

        // If there are active cycles, fetch goals
        const activeCycles = cyclesData.filter((c: AppraisalCycle) => c.status === "active")
        if (activeCycles.length > 0) {
          await fetchGoals(activeCycles[0].id)
        }
      } else {
        const errorData = await cyclesRes.json().catch(() => null)
        setError(extractErrorMessage(errorData) || "Failed to fetch performance data")
      }
    } catch (err) {
      console.error("Error fetching performance data:", err)
      setError("An error occurred while fetching performance data")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchGoals = async (cycleId: number) => {
    try {
      const goalsRes = await fetchWithAuth(`/api/v1/performance/goals/team?cycle_id=${cycleId}`)

      if (goalsRes.ok) {
        const goalsData = await goalsRes.json()
        setGoals(goalsData)
      }
    } catch (err) {
      console.error("Error fetching goals:", err)
    }
  }

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetchWithAuth("/api/v1/performance/cycles/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cycleForm.name,
          description: cycleForm.description || null,
          start_date: cycleForm.start_date,
          end_date: cycleForm.end_date,
          feedback_start_date: cycleForm.feedback_start_date || null,
          feedback_end_date: cycleForm.feedback_end_date || null,
        }),
      })

      if (response.ok) {
        const newCycle = await response.json()
        setCycles([...cycles, newCycle])
        setIsCycleDialogOpen(false)
        setCycleForm({
          name: "",
          description: "",
          start_date: "",
          end_date: "",
          feedback_start_date: "",
          feedback_end_date: "",
        })
        toast({
          title: "Appraisal cycle created successfully",
          description: "The new appraisal cycle has been added",
        })
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(extractErrorMessage(errorData))
      }
    } catch (err: any) {
      console.error("Error creating cycle:", err)
      toast({
        title: "Failed to create appraisal cycle",
        description: err.message || "Please try again later",
        variant: "destructive",
      })
    }
  }

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!goalForm.employee_id) {
      toast({
        title: "Employee required",
        description: "Please select an employee for the goal",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetchWithAuth(`/api/v1/performance/goals/employee/${goalForm.employee_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: Number.parseInt(goalForm.employee_id),
          appraisal_cycle_id: goalForm.appraisal_cycle_id ? Number.parseInt(goalForm.appraisal_cycle_id) : null,
          title: goalForm.title,
          description: goalForm.description || null,
          key_performance_indicator: goalForm.key_performance_indicator || null,
          target_value: goalForm.target_value || null,
          start_date: goalForm.start_date || null,
          due_date: goalForm.due_date || null,
          weightage: goalForm.weightage ? Number.parseFloat(goalForm.weightage) : null,
        }),
      })

      if (response.ok) {
        const newGoal = await response.json()
        setGoals([...goals, newGoal])
        setIsGoalDialogOpen(false)
        setGoalForm({
          employee_id: "",
          appraisal_cycle_id: "",
          title: "",
          description: "",
          key_performance_indicator: "",
          target_value: "",
          start_date: "",
          due_date: "",
          weightage: "",
        })
        toast({
          title: "Goal created successfully",
          description: "The new goal has been assigned to the employee",
        })
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(extractErrorMessage(errorData))
      }
    } catch (err: any) {
      console.error("Error creating goal:", err)
      toast({
        title: "Failed to create goal",
        description: err.message || "Please try again later",
        variant: "destructive",
      })
    }
  }

  const handleUpdateCycleStatus = async (cycleId: number, status: string) => {
    try {
      const response = await fetchWithAuth(`/api/v1/performance/cycles/${cycleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        const updatedCycle = await response.json()
        setCycles(cycles.map((c) => (c.id === cycleId ? updatedCycle : c)))
        toast({
          title: "Cycle status updated",
          description: `Appraisal cycle status changed to ${status}`,
        })
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(extractErrorMessage(errorData))
      }
    } catch (err: any) {
      console.error("Error updating cycle status:", err)
      toast({
        title: "Failed to update cycle status",
        description: err.message || "Please try again later",
        variant: "destructive",
      })
    }
  }

  const handleInitiateReviews = async (cycleId: number) => {
    try {
      // Get all active employees for the review
      const activeEmployees = employees.filter((emp) => emp.id)
      const employeeIds = activeEmployees.map((emp) => emp.id)

      const response = await fetchWithAuth(`/api/v1/performance/cycles/${cycleId}/initiate-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_ids: employeeIds }),
      })

      if (response.ok) {
        toast({
          title: "Performance reviews initiated",
          description: `Reviews have been created for ${employeeIds.length} employees`,
        })
        // Refresh goals data
        await fetchGoals(cycleId)
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(extractErrorMessage(errorData))
      }
    } catch (err: any) {
      console.error("Error initiating reviews:", err)
      toast({
        title: "Failed to initiate reviews",
        description: err.message || "Please try again later",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "Draft", variant: "outline" as const, icon: Edit },
      active: { label: "Active", variant: "default" as const, icon: CheckCircle },
      feedback_collection: { label: "Feedback Collection", variant: "secondary" as const, icon: Clock },
      review_meeting: { label: "Review Meeting", variant: "secondary" as const, icon: Users },
      closed: { label: "Closed", variant: "destructive" as const, icon: AlertCircle },
      archived: { label: "Archived", variant: "outline" as const, icon: AlertCircle },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getGoalStatusBadge = (status: string) => {
    const statusConfig = {
      not_started: { label: "Not Started", variant: "outline" as const },
      in_progress: { label: "In Progress", variant: "secondary" as const },
      completed: { label: "Completed", variant: "default" as const },
      on_hold: { label: "On Hold", variant: "destructive" as const },
      cancelled: { label: "Cancelled", variant: "destructive" as const },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_started
    return <Badge variant={config.variant}>{config.label}</Badge>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Management</h1>
          <p className="text-muted-foreground">Manage appraisal cycles, goals, and performance reviews</p>
        </div>
      </div>

      {/* Performance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cycles</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cycles.filter((c) => c.status === "active").length}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goals.length}</div>
            <p className="text-xs text-muted-foreground">
              {goals.filter((g) => g.status === "completed").length} completed
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cycles">Appraisal Cycles</TabsTrigger>
          <TabsTrigger value="goals">Goals & KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="cycles" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Appraisal Cycles</h3>
            <Dialog open={isCycleDialogOpen} onOpenChange={setIsCycleDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Cycle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Appraisal Cycle</DialogTitle>
                  <DialogDescription>Set up a new performance appraisal cycle for your organization</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateCycle} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cycle-name">Cycle Name</Label>
                      <Input
                        id="cycle-name"
                        value={cycleForm.name}
                        onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
                        placeholder="e.g., Q1 2024 Performance Review"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cycle-description">Description</Label>
                      <Input
                        id="cycle-description"
                        value={cycleForm.description}
                        onChange={(e) => setCycleForm({ ...cycleForm, description: e.target.value })}
                        placeholder="Brief description"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={cycleForm.start_date}
                        onChange={(e) => setCycleForm({ ...cycleForm, start_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={cycleForm.end_date}
                        onChange={(e) => setCycleForm({ ...cycleForm, end_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="feedback-start">Feedback Start Date</Label>
                      <Input
                        id="feedback-start"
                        type="date"
                        value={cycleForm.feedback_start_date}
                        onChange={(e) => setCycleForm({ ...cycleForm, feedback_start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feedback-end">Feedback End Date</Label>
                      <Input
                        id="feedback-end"
                        type="date"
                        value={cycleForm.feedback_end_date}
                        onChange={(e) => setCycleForm({ ...cycleForm, feedback_end_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" type="button" onClick={() => setIsCycleDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Cycle</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cycle Name</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Feedback Period</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycles.map((cycle) => (
                    <TableRow key={cycle.id}>
                      <TableCell className="font-medium">{cycle.name}</TableCell>
                      <TableCell>
                        {new Date(cycle.start_date).toLocaleDateString()} -{" "}
                        {new Date(cycle.end_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(cycle.status)}</TableCell>
                      <TableCell>
                        {cycle.feedback_start_date && cycle.feedback_end_date
                          ? `${new Date(cycle.feedback_start_date).toLocaleDateString()} - ${new Date(
                              cycle.feedback_end_date,
                            ).toLocaleDateString()}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          {cycle.status === "draft" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateCycleStatus(cycle.id, "active")}
                            >
                              Activate
                            </Button>
                          )}
                          {cycle.status === "active" && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => handleInitiateReviews(cycle.id)}>
                                Initiate Reviews
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateCycleStatus(cycle.id, "feedback_collection")}
                              >
                                Start Feedback
                              </Button>
                            </>
                          )}
                          {cycle.status === "feedback_collection" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateCycleStatus(cycle.id, "closed")}
                            >
                              Close Cycle
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Goals & KPIs</h3>
            <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Goal
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Employee Goal</DialogTitle>
                  <DialogDescription>Set a new goal or KPI for an employee</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateGoal} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="goal-employee">Employee</Label>
                      <Select
                        value={goalForm.employee_id}
                        onValueChange={(value) => setGoalForm({ ...goalForm, employee_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id.toString()}>
                              {employee.user_first_name} {employee.user_last_name} - {employee.job_title || "No Title"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goal-cycle">Appraisal Cycle (Optional)</Label>
                      <Select
                        value={goalForm.appraisal_cycle_id}
                        onValueChange={(value) => setGoalForm({ ...goalForm, appraisal_cycle_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select cycle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No specific cycle</SelectItem>
                          {cycles.map((cycle) => (
                            <SelectItem key={cycle.id} value={cycle.id.toString()}>
                              {cycle.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-title">Goal Title</Label>
                    <Input
                      id="goal-title"
                      value={goalForm.title}
                      onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                      placeholder="e.g., Increase sales by 20%"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-description">Description</Label>
                    <Textarea
                      id="goal-description"
                      value={goalForm.description}
                      onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                      placeholder="Detailed description of the goal"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="goal-kpi">Key Performance Indicator</Label>
                      <Input
                        id="goal-kpi"
                        value={goalForm.key_performance_indicator}
                        onChange={(e) => setGoalForm({ ...goalForm, key_performance_indicator: e.target.value })}
                        placeholder="e.g., Revenue, Customer Satisfaction"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goal-target">Target Value</Label>
                      <Input
                        id="goal-target"
                        value={goalForm.target_value}
                        onChange={(e) => setGoalForm({ ...goalForm, target_value: e.target.value })}
                        placeholder="e.g., $100,000, 95%"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="goal-start">Start Date</Label>
                      <Input
                        id="goal-start"
                        type="date"
                        value={goalForm.start_date}
                        onChange={(e) => setGoalForm({ ...goalForm, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goal-due">Due Date</Label>
                      <Input
                        id="goal-due"
                        type="date"
                        value={goalForm.due_date}
                        onChange={(e) => setGoalForm({ ...goalForm, due_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goal-weightage">Weightage (%)</Label>
                      <Input
                        id="goal-weightage"
                        type="number"
                        min="0"
                        max="100"
                        value={goalForm.weightage}
                        onChange={(e) => setGoalForm({ ...goalForm, weightage: e.target.value })}
                        placeholder="0-100"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" type="button" onClick={() => setIsGoalDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Goal</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Goal Title</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>KPI</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Weightage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goals.map((goal) => (
                    <TableRow key={goal.id}>
                      <TableCell className="font-medium">{goal.title}</TableCell>
                      <TableCell>
                        {employees.find((emp) => emp.id === goal.employee_id)?.user_first_name}{" "}
                        {employees.find((emp) => emp.id === goal.employee_id)?.user_last_name}
                      </TableCell>
                      <TableCell>{goal.key_performance_indicator || "—"}</TableCell>
                      <TableCell>{goal.target_value || "—"}</TableCell>
                      <TableCell>{goal.due_date ? new Date(goal.due_date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{getGoalStatusBadge(goal.status)}</TableCell>
                      <TableCell>{goal.weightage ? `${goal.weightage}%` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
