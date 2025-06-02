"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TrendingUp, TrendingDown, Target, Award, Star, Loader2, AlertCircle, BarChart3, Clock } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"

interface PerformanceReview {
  id: number
  employee_id: number
  reviewer_id: number
  review_period_start: string
  review_period_end: string
  overall_rating: number
  goals_achievement: number
  technical_skills: number
  communication_skills: number
  leadership_skills: number
  teamwork: number
  innovation: number
  punctuality: number
  comments: string | null
  strengths: string | null
  areas_for_improvement: string | null
  goals_for_next_period: string | null
  status: "draft" | "submitted" | "approved" | "rejected"
  created_at: string
  updated_at: string
  reviewer_name: string
  employee_name: string
}

interface Goal {
  id: number
  employee_id: number
  title: string
  description: string | null
  target_date: string
  status: "not_started" | "in_progress" | "completed" | "overdue"
  priority: "low" | "medium" | "high"
  progress_percentage: number
  created_at: string
  updated_at: string
}

interface PerformanceMetric {
  metric_name: string
  current_value: number
  target_value: number
  trend: "up" | "down" | "stable"
  period: string
}

export default function ManagerPerformancePage() {
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchPerformanceData()
  }, [])

  const fetchPerformanceData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log("Fetching performance data...")

      // Fetch performance reviews
      const reviewsResponse = await fetchWithAuth("/api/v1/performance/reviews/me")
      console.log("Reviews response status:", reviewsResponse.status)

      // Fetch goals
      const goalsResponse = await fetchWithAuth("/api/v1/performance/goals/me")
      console.log("Goals response status:", goalsResponse.status)

      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json()
        console.log("Reviews data:", reviewsData)
        setPerformanceReviews(Array.isArray(reviewsData) ? reviewsData : [])
      } else {
        console.error("Failed to fetch reviews:", reviewsResponse.status)
      }

      if (goalsResponse.ok) {
        const goalsData = await goalsResponse.json()
        console.log("Goals data:", goalsData)
        setGoals(Array.isArray(goalsData) ? goalsData : [])
      } else {
        console.error("Failed to fetch goals:", goalsResponse.status)
      }

      // Mock metrics data for now
      setMetrics([
        {
          metric_name: "Team Performance",
          current_value: 85,
          target_value: 90,
          trend: "up",
          period: "Q4 2024",
        },
        {
          metric_name: "Project Completion Rate",
          current_value: 92,
          target_value: 95,
          trend: "up",
          period: "Q4 2024",
        },
        {
          metric_name: "Team Satisfaction",
          current_value: 88,
          target_value: 85,
          trend: "up",
          period: "Q4 2024",
        },
        {
          metric_name: "Innovation Score",
          current_value: 78,
          target_value: 80,
          trend: "stable",
          period: "Q4 2024",
        },
      ])

      // If both critical requests failed, show error
      if (!reviewsResponse.ok && !goalsResponse.ok) {
        setError("Failed to fetch performance data. Please try again later.")
      }
    } catch (err) {
      console.error("Error fetching performance data:", err)
      setError("An error occurred while fetching performance data. Please check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "Draft", variant: "secondary" as const },
      submitted: { label: "Submitted", variant: "default" as const },
      approved: { label: "Approved", variant: "default" as const },
      rejected: { label: "Rejected", variant: "destructive" as const },
      not_started: { label: "Not Started", variant: "secondary" as const },
      in_progress: { label: "In Progress", variant: "default" as const },
      completed: { label: "Completed", variant: "default" as const },
      overdue: { label: "Overdue", variant: "destructive" as const },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { label: "Low", variant: "secondary" as const },
      medium: { label: "Medium", variant: "default" as const },
      high: { label: "High", variant: "destructive" as const },
    }

    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <BarChart3 className="h-4 w-4 text-gray-600" />
    }
  }

  const calculateAverageRating = () => {
    if (performanceReviews.length === 0) return 0
    const sum = performanceReviews.reduce((acc, review) => acc + review.overall_rating, 0)
    return (sum / performanceReviews.length).toFixed(1)
  }

  const getCompletedGoalsCount = () => {
    return goals.filter((goal) => goal.status === "completed").length
  }

  const getInProgressGoalsCount = () => {
    return goals.filter((goal) => goal.status === "in_progress").length
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading performance data...</p>
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
          <Button variant="outline" size="sm" className="ml-4" onClick={fetchPerformanceData}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Performance</h1>
        <p className="text-muted-foreground">Track your performance, goals, and development</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Performance Reviews</TabsTrigger>
          <TabsTrigger value="goals">Goals & Objectives</TabsTrigger>
          <TabsTrigger value="metrics">Key Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Performance Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{calculateAverageRating()}</div>
                <p className="text-xs text-muted-foreground">Out of 5.0</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Goals</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getCompletedGoalsCount()}</div>
                <p className="text-xs text-muted-foreground">This period</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getInProgressGoalsCount()}</div>
                <p className="text-xs text-muted-foreground">In progress</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reviews</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performanceReviews.length}</div>
                <p className="text-xs text-muted-foreground">Total reviews</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Performance Review */}
          {performanceReviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Latest Performance Review</CardTitle>
                <CardDescription>Your most recent performance evaluation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    const latestReview = performanceReviews[0]
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">Overall Rating:</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">{latestReview.overall_rating}/5</span>
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-4 w-4 ${
                                      star <= latestReview.overall_rating
                                        ? "text-yellow-400 fill-current"
                                        : "text-gray-300"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">Review Period:</span>
                            <span className="text-sm">
                              {new Date(latestReview.review_period_start).toLocaleDateString()} -{" "}
                              {new Date(latestReview.review_period_end).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">Status:</span>
                            {getStatusBadge(latestReview.status)}
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium">Reviewer:</span>
                            <span className="text-sm">{latestReview.reviewer_name}</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <span className="text-sm font-medium">Key Skills Assessment:</span>
                            <div className="mt-2 space-y-2">
                              <div className="flex justify-between text-xs">
                                <span>Technical Skills</span>
                                <span>{latestReview.technical_skills}/5</span>
                              </div>
                              <Progress value={(latestReview.technical_skills / 5) * 100} className="h-2" />

                              <div className="flex justify-between text-xs">
                                <span>Communication</span>
                                <span>{latestReview.communication_skills}/5</span>
                              </div>
                              <Progress value={(latestReview.communication_skills / 5) * 100} className="h-2" />

                              <div className="flex justify-between text-xs">
                                <span>Leadership</span>
                                <span>{latestReview.leadership_skills}/5</span>
                              </div>
                              <Progress value={(latestReview.leadership_skills / 5) * 100} className="h-2" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Goals */}
          {goals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Goals</CardTitle>
                <CardDescription>Your current objectives and progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {goals.slice(0, 3).map((goal) => (
                    <div key={goal.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium">{goal.title}</h4>
                          {getPriorityBadge(goal.priority)}
                          {getStatusBadge(goal.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{goal.description}</p>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>Due: {new Date(goal.target_date).toLocaleDateString()}</span>
                          <span>Progress: {goal.progress_percentage}%</span>
                        </div>
                        <Progress value={goal.progress_percentage} className="h-2 mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Reviews</CardTitle>
              <CardDescription>Your performance review history</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceReviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No performance reviews found</p>
                  <p className="text-sm">Your reviews will appear here once they are created</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Review Period</TableHead>
                      <TableHead>Overall Rating</TableHead>
                      <TableHead>Reviewer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceReviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell>
                          {new Date(review.review_period_start).toLocaleDateString()} -{" "}
                          {new Date(review.review_period_end).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{review.overall_rating}/5</span>
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${
                                    star <= review.overall_rating ? "text-yellow-400 fill-current" : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{review.reviewer_name}</TableCell>
                        <TableCell>{getStatusBadge(review.status)}</TableCell>
                        <TableCell>{new Date(review.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Goals & Objectives</CardTitle>
              <CardDescription>Track your professional development goals</CardDescription>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No goals found</p>
                  <p className="text-sm">Your goals and objectives will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {goals.map((goal) => (
                    <Card key={goal.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-medium">{goal.title}</h4>
                              {getPriorityBadge(goal.priority)}
                              {getStatusBadge(goal.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">{goal.description}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{goal.progress_percentage}%</span>
                          </div>
                          <Progress value={goal.progress_percentage} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Target Date: {new Date(goal.target_date).toLocaleDateString()}</span>
                            <span>Created: {new Date(goal.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {metrics.map((metric, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{metric.metric_name}</CardTitle>
                  {getTrendIcon(metric.trend)}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.current_value}%</div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span>Target: {metric.target_value}%</span>
                    <span>•</span>
                    <span>{metric.period}</span>
                  </div>
                  <Progress value={(metric.current_value / metric.target_value) * 100} className="h-2 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
