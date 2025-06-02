"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Target,
  Calendar,
  TrendingUp,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Award,
  MessageSquare,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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

interface AppraisalCycle {
  id: number
  name: string
  start_date: string
  end_date: string
  feedback_start_date: string
  feedback_end_date: string
  status: "draft" | "active" | "feedback_collection" | "review_meeting" | "closed" | "archived"
  description: string | null
}

interface PerformanceReview {
  id: number
  appraisal_cycle_id: number
  employee_id: number
  manager_id: number
  self_evaluation_text: string | null
  self_evaluation_rating: number | null
  self_evaluation_submitted_on: string | null
  manager_feedback_text: string | null
  manager_rating: number | null
  manager_feedback_submitted_on: string | null
  review_status: "pending_self_evaluation" | "pending_manager_feedback" | "completed"
  employee_name: string
  manager_name: string
  appraisal_cycle_name: string
}

export default function EmployeePerformancePage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [cycles, setCycles] = useState<AppraisalCycle[]>([])
  const [currentReview, setCurrentReview] = useState<PerformanceReview | null>(null)
  const [selectedCycle, setSelectedCycle] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selfEvaluationText, setSelfEvaluationText] = useState("")
  const [selfEvaluationRating, setSelfEvaluationRating] = useState<string>("")
  const [isSubmittingEvaluation, setIsSubmittingEvaluation] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedCycle) {
      fetchGoalsForCycle(selectedCycle)
      fetchReviewForCycle(selectedCycle)
    }
  }, [selectedCycle])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch appraisal cycles
      const cyclesResponse = await fetchWithAuth("/api/v1/performance/cycles/")

      // Fetch all goals (without cycle filter initially)
      const goalsResponse = await fetchWithAuth("/api/v1/performance/goals/my")

      if (cyclesResponse.ok && goalsResponse.ok) {
        const cyclesData = await cyclesResponse.json()
        const goalsData = await goalsResponse.json()

        setCycles(cyclesData)
        setGoals(goalsData)

        // Set the first active cycle as default
        const activeCycle = cyclesData.find((cycle: AppraisalCycle) => cycle.status === "active")
        if (activeCycle) {
          setSelectedCycle(activeCycle.id.toString())
        } else if (cyclesData.length > 0) {
          setSelectedCycle(cyclesData[0].id.toString())
        }
      } else {
        setError("Failed to fetch performance data")
      }
    } catch (err) {
      console.error("Error fetching performance data:", err)
      setError("An error occurred while fetching performance data")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchGoalsForCycle = async (cycleId: string) => {
    try {
      const response = await fetchWithAuth(`/api/v1/performance/goals/my?cycle_id=${cycleId}`)
      if (response.ok) {
        const goalsData = await response.json()
        setGoals(goalsData)
      }
    } catch (err) {
      console.error("Error fetching goals for cycle:", err)
    }
  }

  const fetchReviewForCycle = async (cycleId: string) => {
    try {
      const response = await fetchWithAuth(`/api/v1/performance/reviews/my/cycle/${cycleId}`)
      if (response.ok) {
        const reviewData = await response.json()
        setCurrentReview(reviewData)
      } else {
        setCurrentReview(null)
      }
    } catch (err) {
      console.error("Error fetching review for cycle:", err)
      setCurrentReview(null)
    }
  }

  const handleSubmitSelfEvaluation = async () => {
    if (!currentReview) return

    try {
      setIsSubmittingEvaluation(true)

      const response = await fetchWithAuth(`/api/v1/performance/reviews/${currentReview.id}/self-evaluation`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          self_evaluation_text: selfEvaluationText || null,
          self_evaluation_rating: selfEvaluationRating ? Number.parseFloat(selfEvaluationRating) : null,
        }),
      })

      if (response.ok) {
        const updatedReview = await response.json()
        setCurrentReview(updatedReview)
        setIsDialogOpen(false)
        setSelfEvaluationText("")
        setSelfEvaluationRating("")

        toast({
          title: "Self-evaluation submitted",
          description: "Your self-evaluation has been submitted successfully",
        })
      } else {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || "Failed to submit self-evaluation")
      }
    } catch (err: any) {
      console.error("Error submitting self-evaluation:", err)
      toast({
        title: "Submission failed",
        description: err.message || "Failed to submit self-evaluation",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingEvaluation(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      not_started: { label: "Not Started", variant: "secondary" as const, icon: Clock },
      in_progress: { label: "In Progress", variant: "default" as const, icon: TrendingUp },
      completed: { label: "Completed", variant: "default" as const, icon: CheckCircle },
      on_hold: { label: "On Hold", variant: "destructive" as const, icon: AlertCircle },
      cancelled: { label: "Cancelled", variant: "outline" as const, icon: AlertCircle },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_started
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </Badge>
    )
  }

  const getProgressPercentage = (status: string) => {
    const progressMap = {
      not_started: 0,
      in_progress: 50,
      completed: 100,
      on_hold: 25,
      cancelled: 0,
    }
    return progressMap[status as keyof typeof progressMap] || 0
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
    ))
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

  const completedGoals = goals.filter((goal) => goal.status === "completed").length
  const totalGoals = goals.length
  const goalCompletionRate = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Performance</h1>
          <p className="text-muted-foreground">Track your goals and performance reviews</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedCycle} onValueChange={setSelectedCycle}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select appraisal cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((cycle) => (
                <SelectItem key={cycle.id} value={cycle.id.toString()}>
                  {cycle.name} ({cycle.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGoals}</div>
            <p className="text-xs text-muted-foreground">Active goals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Goals</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedGoals}</div>
            <p className="text-xs text-muted-foreground">{goalCompletionRate.toFixed(1)}% completion rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Rating</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentReview?.manager_rating ? currentReview.manager_rating.toFixed(1) : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentReview?.manager_rating ? "Latest rating" : "No rating yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Review */}
      {currentReview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Performance Review - {currentReview.appraisal_cycle_name}
              </div>
              {currentReview.review_status === "pending_self_evaluation" && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setSelfEvaluationText(currentReview.self_evaluation_text || "")
                        setSelfEvaluationRating(currentReview.self_evaluation_rating?.toString() || "")
                      }}
                    >
                      Submit Self-Evaluation
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Self-Evaluation</DialogTitle>
                      <DialogDescription>
                        Provide your self-evaluation for this performance review cycle
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="self-evaluation">Self-Evaluation Text</Label>
                        <Textarea
                          id="self-evaluation"
                          value={selfEvaluationText}
                          onChange={(e) => setSelfEvaluationText(e.target.value)}
                          placeholder="Describe your achievements, challenges, and areas for improvement..."
                          className="min-h-32"
                        />
                      </div>

                      <div>
                        <Label htmlFor="self-rating">Self-Rating (1-5)</Label>
                        <Select value={selfEvaluationRating} onValueChange={setSelfEvaluationRating}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your rating" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Needs Improvement</SelectItem>
                            <SelectItem value="2">2 - Below Expectations</SelectItem>
                            <SelectItem value="3">3 - Meets Expectations</SelectItem>
                            <SelectItem value="4">4 - Exceeds Expectations</SelectItem>
                            <SelectItem value="5">5 - Outstanding</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSubmitSelfEvaluation} disabled={isSubmittingEvaluation}>
                          {isSubmittingEvaluation && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Submit Evaluation
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardTitle>
            <CardDescription>Review status: {currentReview.review_status.replace(/_/g, " ")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Self Evaluation */}
              <div className="space-y-4">
                <h3 className="font-medium">Self-Evaluation</h3>
                {currentReview.self_evaluation_submitted_on ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Rating:</span>
                      <div className="flex">
                        {currentReview.self_evaluation_rating && renderStars(currentReview.self_evaluation_rating)}
                      </div>
                      <span className="text-sm text-muted-foreground">({currentReview.self_evaluation_rating}/5)</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Comments:</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentReview.self_evaluation_text || "No comments provided"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Submitted on {new Date(currentReview.self_evaluation_submitted_on).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Self-evaluation not submitted yet</p>
                )}
              </div>

              {/* Manager Feedback */}
              <div className="space-y-4">
                <h3 className="font-medium">Manager Feedback</h3>
                {currentReview.manager_feedback_submitted_on ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Rating:</span>
                      <div className="flex">
                        {currentReview.manager_rating && renderStars(currentReview.manager_rating)}
                      </div>
                      <span className="text-sm text-muted-foreground">({currentReview.manager_rating}/5)</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Feedback:</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentReview.manager_feedback_text || "No feedback provided"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Submitted on {new Date(currentReview.manager_feedback_submitted_on).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Manager feedback pending</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            My Goals
          </CardTitle>
          <CardDescription>{selectedCycle ? `Goals for selected cycle` : "All your goals"}</CardDescription>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No goals found for the selected period</p>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => (
                <div key={goal.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{goal.title}</h3>
                      {goal.description && <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>}
                    </div>
                    {getStatusBadge(goal.status)}
                  </div>

                  {goal.key_performance_indicator && (
                    <div>
                      <span className="text-sm font-medium">KPI: </span>
                      <span className="text-sm">{goal.key_performance_indicator}</span>
                    </div>
                  )}

                  {goal.target_value && (
                    <div>
                      <span className="text-sm font-medium">Target: </span>
                      <span className="text-sm">{goal.target_value}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{getProgressPercentage(goal.status)}%</span>
                    </div>
                    <Progress value={getProgressPercentage(goal.status)} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center space-x-4">
                      {goal.start_date && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Start: {new Date(goal.start_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {goal.due_date && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Due: {new Date(goal.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    {goal.weightage && <span>Weight: {goal.weightage}%</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
