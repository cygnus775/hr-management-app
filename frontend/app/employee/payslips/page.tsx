"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { DollarSign, Download, Eye, FileText, TrendingUp, TrendingDown, Filter, Search } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { format } from "date-fns"
import { toast } from "sonner"
import jsPDF from "jspdf"

interface Payslip {
  id: number
  employee_id: number
  payroll_run_id: number
  gross_earnings: number
  total_deductions: number
  net_salary: number
  salary_details: Record<string, any>
  total_working_days_in_month: number
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

export default function EmployeePayslipsPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [yearFilter, setYearFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"date" | "amount">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPayslips()
  }, [])

  const fetchPayslips = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get("/api/v1/payroll/payslips/me")
      if (response && response.data) {
        setPayslips(response.data)
      } else {
        setPayslips([])
        setError("No payslip data available")
      }
    } catch (error) {
      console.error("Error fetching payslips:", error)
      setPayslips([])
      setError("Failed to fetch payslips")
      toast.error("Failed to fetch payslips")
    } finally {
      setLoading(false)
    }
  }

  const downloadPayslipPDF = (payslip: Payslip) => {
    try {
      const doc = new jsPDF()

      // Header
      doc.setFontSize(20)
      doc.text("PAYSLIP", 105, 20, { align: "center" })

      // Company info (placeholder)
      doc.setFontSize(12)
      doc.text("Company Name", 20, 40)
      doc.text("Company Address", 20, 50)

      // Employee info
      doc.text(`Employee: ${payslip.employee_first_name} ${payslip.employee_last_name}`, 20, 70)
      doc.text(`Email: ${payslip.employee_email}`, 20, 80)
      doc.text(`Employee ID: ${payslip.employee_id}`, 20, 90)

      // Pay period
      doc.text(`Pay Period: ${format(new Date(payslip.year, payslip.month - 1), "MMMM yyyy")}`, 120, 70)
      doc.text(`Generated: ${format(new Date(payslip.generated_at), "dd/MM/yyyy")}`, 120, 80)

      // Leave information
      doc.text("LEAVE INFORMATION", 20, 110)
      doc.text(`Paid Leave: ${payslip.paid_leave_days} days`, 20, 125)
      doc.text(`Unpaid Leave: ${payslip.unpaid_leave_days} days`, 20, 135)

      // Salary breakdown
      doc.text("SALARY BREAKDOWN", 20, 155)
      let yPos = 170

      if (payslip.salary_details) {
        Object.entries(payslip.salary_details).forEach(([component, amount]) => {
          doc.text(`${component}: ₹${Number(amount).toLocaleString()}`, 20, yPos)
          yPos += 10
        })
      }

      // Summary
      yPos += 10
      doc.text(`Gross Earnings: ₹${payslip.gross_earnings.toLocaleString()}`, 20, yPos)
      doc.text(`Total Deductions: ₹${payslip.total_deductions.toLocaleString()}`, 20, yPos + 10)
      doc.setFontSize(14)
      doc.text(`NET SALARY: ₹${payslip.net_salary.toLocaleString()}`, 20, yPos + 25)

      doc.save(`payslip-${format(new Date(payslip.year, payslip.month - 1), "MMM-yyyy")}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast.error("Failed to generate PDF")
    }
  }

  // Safe filtering function that handles empty arrays
  const getFilteredPayslips = () => {
    if (!payslips || payslips.length === 0) return []

    return payslips
      .filter((payslip) => {
        const matchesSearch = format(new Date(payslip.year, payslip.month - 1), "MMMM yyyy")
          .toLowerCase()
          .includes(searchTerm.toLowerCase())

        const matchesYear = yearFilter === "all" || payslip.year.toString() === yearFilter

        return matchesSearch && matchesYear
      })
      .sort((a, b) => {
        let comparison = 0

        switch (sortBy) {
          case "date":
            comparison = new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
            break
          case "amount":
            comparison = a.net_salary - b.net_salary
            break
        }

        return sortOrder === "asc" ? comparison : -comparison
      })
  }

  const filteredPayslips = getFilteredPayslips()
  const currentYear = new Date().getFullYear()

  // Safe function to get available years
  const getAvailableYears = () => {
    if (!payslips || payslips.length === 0) return []
    return Array.from(new Set(payslips.map((p) => p.year))).sort((a, b) => b - a)
  }

  const availableYears = getAvailableYears()

  const calculateYTDEarnings = () => {
    if (!payslips || payslips.length === 0) return 0
    const currentYearPayslips = payslips.filter((p) => p.year === currentYear)
    return currentYearPayslips.reduce((total, payslip) => total + payslip.net_salary, 0)
  }

  const getAverageSalary = () => {
    if (!payslips || payslips.length === 0) return 0
    return payslips.reduce((total, payslip) => total + payslip.net_salary, 0) / payslips.length
  }

  const getLastPayslip = () => {
    if (!payslips || payslips.length === 0) return null
    return [...payslips].sort(
      (a, b) => new Date(b.year, b.month - 1).getTime() - new Date(a.year, a.month - 1).getTime(),
    )[0]
  }

  const getSecondLastPayslip = () => {
    if (!payslips || payslips.length <= 1) return null
    return [...payslips].sort(
      (a, b) => new Date(b.year, b.month - 1).getTime() - new Date(a.year, a.month - 1).getTime(),
    )[1]
  }

  const lastPayslip = getLastPayslip()
  const secondLastPayslip = getSecondLastPayslip()

  const salaryTrend = lastPayslip && secondLastPayslip ? lastPayslip.net_salary - secondLastPayslip.net_salary : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Payslips</h1>
            <p className="text-muted-foreground">View and download your salary statements</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No Payslips Available</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchPayslips}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Payslips</h1>
          <p className="text-muted-foreground">View and download your salary statements</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payslips</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payslips.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">YTD Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{calculateYTDEarnings().toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Current year total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Salary</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{getAverageSalary().toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salary Trend</CardTitle>
            {salaryTrend >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${salaryTrend >= 0 ? "text-green-600" : "text-red-600"}`}>
              {salaryTrend >= 0 ? "+" : ""}₹{salaryTrend.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">vs last month</p>
          </CardContent>
        </Card>
      </div>

      {payslips.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Payslips Available</CardTitle>
            <CardDescription>You don't have any payslips yet</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Your payslips will appear here once they are generated by the payroll department.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payslip History</CardTitle>
            <CardDescription>View and download your salary statements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by month/year..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
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
                      <TableHead>Pay Period</TableHead>
                      <TableHead>Gross Earnings</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Salary</TableHead>
                      <TableHead>Generated Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayslips.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6">
                          No payslips match your search criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPayslips.map((payslip) => (
                        <TableRow key={payslip.id}>
                          <TableCell className="font-medium">
                            {format(new Date(payslip.year, payslip.month - 1), "MMMM yyyy")}
                          </TableCell>
                          <TableCell>₹{payslip.gross_earnings.toLocaleString()}</TableCell>
                          <TableCell>₹{payslip.total_deductions.toLocaleString()}</TableCell>
                          <TableCell className="font-medium">₹{payslip.net_salary.toLocaleString()}</TableCell>
                          <TableCell>{format(new Date(payslip.generated_at), "dd MMM yyyy")}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" onClick={() => setSelectedPayslip(payslip)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>
                                      Payslip - {format(new Date(payslip.year, payslip.month - 1), "MMMM yyyy")}
                                    </DialogTitle>
                                    <DialogDescription>
                                      Detailed salary statement for the selected period
                                    </DialogDescription>
                                  </DialogHeader>

                                  {selectedPayslip && (
                                    <div className="space-y-6">
                                      <div className="grid grid-cols-2 gap-6">
                                        <div>
                                          <h3 className="font-medium text-lg mb-3">Pay Period Information</h3>
                                          <div className="space-y-2">
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Period:</span>
                                              <span>
                                                {format(
                                                  new Date(selectedPayslip.year, selectedPayslip.month - 1),
                                                  "MMMM yyyy",
                                                )}
                                              </span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Generated:</span>
                                              <span>{format(new Date(selectedPayslip.generated_at), "PPP")}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Payslip ID:</span>
                                              <span>{selectedPayslip.id}</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div>
                                          <h3 className="font-medium text-lg mb-3">Leave Information</h3>
                                          <div className="space-y-2">
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Paid Leave:</span>
                                              <span>{selectedPayslip.paid_leave_days}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Unpaid Leave:</span>
                                              <span>{selectedPayslip.unpaid_leave_days}</span>
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

                                      <div>
                                        <h3 className="font-medium text-lg mb-3">Detailed Salary Breakdown</h3>
                                        <div className="border rounded-lg overflow-hidden">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Component</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {selectedPayslip.salary_details &&
                                                Object.entries(selectedPayslip.salary_details).map(
                                                  ([component, amount]) => (
                                                    <TableRow key={component}>
                                                      <TableCell className="font-medium">{component}</TableCell>
                                                      <TableCell className="text-right">
                                                        ₹{Number(amount).toLocaleString()}
                                                      </TableCell>
                                                    </TableRow>
                                                  ),
                                                )}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>

                                      <div className="flex justify-end">
                                        <Button onClick={() => downloadPayslipPDF(selectedPayslip)}>
                                          <Download className="h-4 w-4 mr-2" />
                                          Download PDF
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>

                              <Button variant="outline" size="sm" onClick={() => downloadPayslipPDF(payslip)}>
                                <Download className="h-4 w-4 mr-2" />
                                PDF
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
