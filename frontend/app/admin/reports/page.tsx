"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Calendar, Users, TrendingUp, DollarSign, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { format } from "date-fns"
import { Chart } from "@/components/ui/chart"
import { useToast } from "@/hooks/use-toast"
import { DatePicker } from "@/components/ui/date-picker"

// Types based on the API specification
interface AttritionReport {
  period_start: string
  period_end: string
  starting_headcount: number
  ending_headcount: number
  separations: number
  attrition_rate_percentage: number
}

interface LeaveTrendItem {
  leave_type_id: number
  leave_type_name: string
  total_days_approved: number
  number_of_requests: number
}

interface MonthlySalaryExpense {
  year: number
  month: number
  total_net_salary_paid: number
  total_gross_salary: number
  employee_count: number
}

const renderDateRangePicker = (
  startDate: Date,
  setStartDate: (date: Date) => void,
  endDate: Date,
  setEndDate: (date: Date) => void,
  isLoading: boolean,
  onUpdate: () => void,
) => (
  <div className="flex flex-col sm:flex-row gap-4 mb-6">
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Start Date</span>
      <DatePicker date={startDate} setDate={setStartDate} />
    </div>
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">End Date</span>
      <DatePicker date={endDate} setDate={setEndDate} />
    </div>
    <Button className="mt-auto" variant="outline" onClick={onUpdate} disabled={isLoading}>
      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Update Report
    </Button>
  </div>
)

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("headcount")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { fetchWithAuth } = useAuth()
  const { toast } = useToast()

  // Date ranges for reports - using a range that has data based on API example
  const [startDate, setStartDate] = useState<Date>(new Date("2025-05-01"))
  const [endDate, setEndDate] = useState<Date>(new Date("2026-05-01"))

  // Report data states
  const [headcountData, setHeadcountData] = useState<any>(null)
  const [attritionData, setAttritionData] = useState<AttritionReport | null>(null)
  const [leaveTrendsData, setLeaveTrendsData] = useState<LeaveTrendItem[]>([])
  const [salaryExpenseData, setSalaryExpenseData] = useState<MonthlySalaryExpense[]>([])

  // Fetch the active tab data
  useEffect(() => {
    if (activeTab) {
      fetchReportData(activeTab)
    }
  }, [activeTab, startDate, endDate])

  const fetchReportData = async (reportType: string) => {
    setIsLoading(true)
    setError(null)

    try {
      switch (reportType) {
        case "headcount":
          await fetchHeadcountData()
          break
        case "attrition":
          await fetchAttritionData()
          break
        case "leave":
          await fetchLeaveTrendsData()
          break
        case "salary":
          await fetchSalaryExpenseData()
          break
      }
    } catch (err) {
      console.error(`Error fetching ${reportType} report:`, err)
      setError(`Failed to load ${reportType} report data. Please try again.`)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchHeadcountData = async () => {
    const response = await fetchWithAuth("/api/v1/reports/headcount/active")
    if (response.ok) {
      const data = await response.json()
      setHeadcountData(data)
    } else {
      throw new Error("Failed to fetch headcount data")
    }
  }

  const fetchAttritionData = async () => {
    const startDateStr = format(startDate, "yyyy-MM-dd")
    const endDateStr = format(endDate, "yyyy-MM-dd")

    const response = await fetchWithAuth(
      `/api/v1/reports/attrition?start_date_str=${startDateStr}&end_date_str=${endDateStr}`,
    )

    if (response.ok) {
      const data = await response.json()
      setAttritionData(data)
    } else {
      throw new Error("Failed to fetch attrition data")
    }
  }

  const fetchLeaveTrendsData = async () => {
    const startDateStr = format(startDate, "yyyy-MM-dd")
    const endDateStr = format(endDate, "yyyy-MM-dd")

    console.log("Fetching leave trends with dates:", startDateStr, "to", endDateStr)

    const response = await fetchWithAuth(
      `/api/v1/reports/leave-trends?start_date_str=${startDateStr}&end_date_str=${endDateStr}`,
    )

    if (response.ok) {
      const data = await response.json()
      console.log("Leave trends data received:", data)
      setLeaveTrendsData(data)
    } else {
      console.error("Failed to fetch leave trends, status:", response.status)
      throw new Error("Failed to fetch leave trends data")
    }
  }

  const fetchSalaryExpenseData = async () => {
    const response = await fetchWithAuth("/api/v1/reports/salary-expense/monthly?limit_months=12")

    if (response.ok) {
      const data = await response.json()
      setSalaryExpenseData(data)
    } else {
      throw new Error("Failed to fetch salary expense data")
    }
  }

  const renderHeadcountReport = () => {
    if (!headcountData) return <div className="text-center py-8">No headcount data available</div>

    const departmentData = headcountData.by_department || []
    const departmentNames = departmentData.map((dept: any) => dept.department_name)
    const departmentCounts = departmentData.map((dept: any) => dept.headcount)

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Active Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{headcountData.total_active_headcount || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Active Departments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {departmentData.filter((dept: any) => dept.headcount > 0).length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Departments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{departmentData.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Department Distribution</CardTitle>
            <CardDescription>Employee count by department</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <Chart
              type="bar"
              options={{
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: "Number of Employees",
                    },
                  },
                  x: {
                    title: {
                      display: true,
                      text: "Department",
                    },
                  },
                },
              }}
              data={{
                labels: departmentNames,
                datasets: [
                  {
                    label: "Employees",
                    data: departmentCounts,
                    backgroundColor: "rgba(75, 192, 192, 0.6)",
                  },
                ],
              }}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderAttritionReport = () => {
    if (!attritionData) return <div className="text-center py-8">No attrition data available</div>

    return (
      <div className="space-y-6">
        {renderDateRangePicker(startDate, setStartDate, endDate, setEndDate, isLoading, () =>
          fetchReportData(activeTab),
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Starting Headcount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{attritionData.starting_headcount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Ending Headcount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{attritionData.ending_headcount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Separations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{attritionData.separations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Attrition Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{attritionData.attrition_rate_percentage.toFixed(2)}%</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attrition Analysis</CardTitle>
            <CardDescription>Employee turnover for selected period</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <Chart
              type="pie"
              options={{
                responsive: true,
                maintainAspectRatio: false,
              }}
              data={{
                labels: ["Retained", "Separated"],
                datasets: [
                  {
                    data: [attritionData.ending_headcount, attritionData.separations],
                    backgroundColor: ["rgba(54, 162, 235, 0.6)", "rgba(255, 99, 132, 0.6)"],
                  },
                ],
              }}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderLeaveTrendsReport = () => {
    if (leaveTrendsData.length === 0) return <div className="text-center py-8">No leave trends data available</div>

    return (
      <div className="space-y-6">
        {renderDateRangePicker(startDate, setStartDate, endDate, setEndDate, isLoading, () =>
          fetchReportData(activeTab),
        )}

        <Card>
          <CardHeader>
            <CardTitle>Leave Distribution by Type</CardTitle>
            <CardDescription>Total days approved by leave type</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <Chart
              type="bar"
              options={{
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: "Days Approved",
                    },
                  },
                  x: {
                    title: {
                      display: true,
                      text: "Leave Type",
                    },
                  },
                },
              }}
              data={{
                labels: leaveTrendsData.map((item) => item.leave_type_name),
                datasets: [
                  {
                    label: "Days Approved",
                    data: leaveTrendsData.map((item) => item.total_days_approved),
                    backgroundColor: "rgba(153, 102, 255, 0.6)",
                  },
                ],
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave Requests Count</CardTitle>
            <CardDescription>Number of requests by leave type</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <Chart
              type="doughnut"
              options={{
                responsive: true,
                maintainAspectRatio: false,
              }}
              data={{
                labels: leaveTrendsData.map((item) => item.leave_type_name),
                datasets: [
                  {
                    data: leaveTrendsData.map((item) => item.number_of_requests),
                    backgroundColor: [
                      "rgba(255, 99, 132, 0.6)",
                      "rgba(54, 162, 235, 0.6)",
                      "rgba(255, 206, 86, 0.6)",
                      "rgba(75, 192, 192, 0.6)",
                      "rgba(153, 102, 255, 0.6)",
                    ],
                  },
                ],
              }}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderSalaryExpenseReport = () => {
    if (salaryExpenseData.length === 0) return <div className="text-center py-8">No salary expense data available</div>

    // Format data for charts
    const months = salaryExpenseData.map((item) => {
      const date = new Date(item.year, item.month - 1)
      return format(date, "MMM yyyy")
    })

    const netSalaries = salaryExpenseData.map((item) => item.total_net_salary_paid)
    const grossSalaries = salaryExpenseData.map((item) => item.total_gross_salary)
    const employeeCounts = salaryExpenseData.map((item) => item.employee_count)

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Salary Expenses</CardTitle>
            <CardDescription>Net vs Gross salary over time</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <Chart
              type="line"
              options={{
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: "Amount (Rs.)",
                    },
                  },
                  x: {
                    title: {
                      display: true,
                      text: "Month",
                    },
                  },
                },
              }}
              data={{
                labels: months,
                datasets: [
                  {
                    label: "Net Salary",
                    data: netSalaries,
                    borderColor: "rgba(75, 192, 192, 1)",
                    backgroundColor: "rgba(75, 192, 192, 0.2)",
                    fill: true,
                  },
                  {
                    label: "Gross Salary",
                    data: grossSalaries,
                    borderColor: "rgba(153, 102, 255, 1)",
                    backgroundColor: "rgba(153, 102, 255, 0.2)",
                    fill: true,
                  },
                ],
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Salary per Employee</CardTitle>
            <CardDescription>Monthly average salary trend</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <Chart
              type="bar"
              options={{
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: "Average Salary (Rs.)",
                    },
                  },
                  x: {
                    title: {
                      display: true,
                      text: "Month",
                    },
                  },
                },
              }}
              data={{
                labels: months,
                datasets: [
                  {
                    label: "Avg Net Salary",
                    data: netSalaries.map((net, i) => (employeeCounts[i] ? Math.round(net / employeeCounts[i]) : 0)),
                    backgroundColor: "rgba(255, 159, 64, 0.6)",
                  },
                  {
                    label: "Avg Gross Salary",
                    data: grossSalaries.map((gross, i) =>
                      employeeCounts[i] ? Math.round(gross / employeeCounts[i]) : 0,
                    ),
                    backgroundColor: "rgba(255, 99, 132, 0.6)",
                  },
                ],
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employee Count Trend</CardTitle>
            <CardDescription>Monthly employee headcount</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <Chart
              type="line"
              options={{
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: "Employee Count",
                    },
                  },
                  x: {
                    title: {
                      display: true,
                      text: "Month",
                    },
                  },
                },
              }}
              data={{
                labels: months,
                datasets: [
                  {
                    label: "Employee Count",
                    data: employeeCounts,
                    borderColor: "rgba(54, 162, 235, 1)",
                    backgroundColor: "rgba(54, 162, 235, 0.2)",
                    fill: true,
                  },
                ],
              }}
            />
          </CardContent>
        </Card>
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
        <h1 className="text-3xl font-bold">HR Reports & Analytics</h1>
        <p className="text-muted-foreground">Comprehensive reports and analytics for HR management</p>
      </div>

      <Tabs defaultValue="headcount" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-4 mb-4">
          <TabsTrigger value="headcount" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Headcount</span>
          </TabsTrigger>
          <TabsTrigger value="attrition" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Attrition</span>
          </TabsTrigger>
          <TabsTrigger value="leave" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Leave Trends</span>
          </TabsTrigger>
          <TabsTrigger value="salary" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Salary Expense</span>
          </TabsTrigger>
        </TabsList>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && (
          <>
            <TabsContent value="headcount">{renderHeadcountReport()}</TabsContent>

            <TabsContent value="attrition">{renderAttritionReport()}</TabsContent>

            <TabsContent value="leave">{renderLeaveTrendsReport()}</TabsContent>

            <TabsContent value="salary">{renderSalaryExpenseReport()}</TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
