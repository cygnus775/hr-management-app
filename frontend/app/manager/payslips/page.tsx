"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { Download, FileText, Calendar, DollarSign, AlertCircle } from "lucide-react"
import { jsPDF } from "jspdf"
import "jspdf-autotable"

// Types
interface Payslip {
  id: number
  employeeId: number
  payPeriod: string
  payDate: string
  basicSalary: number
  allowances: {
    name: string
    amount: number
  }[]
  deductions: {
    name: string
    amount: number
  }[]
  netPay: number
  grossPay: number
  currency: string
  status: "processed" | "pending" | "failed"
  leaveInfo?: {
    paidLeavesTaken: number
    paidLeavesRemaining: number
    unpaidLeavesTaken: number
  }
}

export default function ManagerPayslipsPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, fetchWithAuth } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchPayslips = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetchWithAuth(`/api/v1/payroll/payslips/me`)
        if (response.ok) {
          const data = await response.json()
          setPayslips(data)
        } else {
          throw new Error("Failed to fetch payslips")
        }
      } catch (error) {
        console.error("Error fetching payslips:", error)
        setError("Failed to load payslips. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    if (user?.id) {
      fetchPayslips()
    }
  }, [user?.id, selectedYear, fetchWithAuth])

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount)
  }

  const calculateYTDEarnings = () => {
    if (!payslips || payslips.length === 0) return 0
    return payslips.reduce((total, payslip) => total + payslip.netPay, 0)
  }

  const generatePayslipPDF = (payslip: Payslip) => {
    try {
      const doc = new jsPDF()
      const companyName = "HR Management System"
      const employeeName = `${user?.firstName} ${user?.lastName}`

      // Header
      doc.setFontSize(20)
      doc.text(companyName, 105, 20, { align: "center" })
      doc.setFontSize(16)
      doc.text("PAYSLIP", 105, 30, { align: "center" })
      doc.setFontSize(12)
      doc.text(`Pay Period: ${payslip.payPeriod}`, 105, 40, { align: "center" })
      doc.text(`Payment Date: ${new Date(payslip.payDate).toLocaleDateString()}`, 105, 45, { align: "center" })

      // Employee Details
      doc.setFontSize(12)
      doc.text("Employee Details", 20, 60)
      doc.setFontSize(10)
      doc.text(`Name: ${employeeName}`, 20, 70)
      doc.text(`Employee ID: ${payslip.employeeId}`, 20, 75)
      doc.text(`Position: ${user?.position || ""}`, 20, 80)
      doc.text(`Department: ${user?.department || ""}`, 20, 85)

      // Earnings
      doc.setFontSize(12)
      doc.text("Earnings", 20, 100)

      const earningsData = [
        ["Basic Salary", formatCurrency(payslip.basicSalary, payslip.currency)],
        ...payslip.allowances.map((allowance) => [allowance.name, formatCurrency(allowance.amount, payslip.currency)]),
      ]

      // @ts-ignore
      doc.autoTable({
        startY: 105,
        head: [["Description", "Amount"]],
        body: earningsData,
        theme: "grid",
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 20, right: 20 },
        tableWidth: 80,
      })

      // Deductions
      const deductionsStartY = doc.lastAutoTable?.finalY || 130
      doc.setFontSize(12)
      doc.text("Deductions", 20, deductionsStartY + 10)

      const deductionsData = payslip.deductions.map((deduction) => [
        deduction.name,
        formatCurrency(deduction.amount, payslip.currency),
      ])

      // @ts-ignore
      doc.autoTable({
        startY: deductionsStartY + 15,
        head: [["Description", "Amount"]],
        body: deductionsData,
        theme: "grid",
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 20, right: 20 },
        tableWidth: 80,
      })

      // Leave Information
      if (payslip.leaveInfo) {
        const leaveStartY = doc.lastAutoTable?.finalY || 180
        doc.setFontSize(12)
        doc.text("Leave Information", 20, leaveStartY + 10)

        const leaveData = [
          ["Paid Leaves Taken", payslip.leaveInfo.paidLeavesTaken.toString()],
          ["Paid Leaves Remaining", payslip.leaveInfo.paidLeavesRemaining.toString()],
          ["Unpaid Leaves Taken", payslip.leaveInfo.unpaidLeavesTaken.toString()],
        ]

        // @ts-ignore
        doc.autoTable({
          startY: leaveStartY + 15,
          head: [["Description", "Count"]],
          body: leaveData,
          theme: "grid",
          headStyles: { fillColor: [71, 85, 105] },
          margin: { left: 20, right: 20 },
          tableWidth: 80,
        })
      }

      // Summary
      const summaryStartY = doc.lastAutoTable?.finalY || 210
      doc.setFontSize(12)
      doc.text("Summary", 20, summaryStartY + 10)

      const summaryData = [
        ["Gross Pay", formatCurrency(payslip.grossPay, payslip.currency)],
        [
          "Total Deductions",
          formatCurrency(
            payslip.deductions.reduce((total, deduction) => total + deduction.amount, 0),
            payslip.currency,
          ),
        ],
        ["Net Pay", formatCurrency(payslip.netPay, payslip.currency)],
      ]

      // @ts-ignore
      doc.autoTable({
        startY: summaryStartY + 15,
        body: summaryData,
        theme: "grid",
        bodyStyles: {
          fontSize: 12,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { fontStyle: "bold" },
          1: { halign: "right" },
        },
        margin: { left: 20, right: 20 },
        tableWidth: 80,
      })

      // Footer
      const footerStartY = doc.lastAutoTable?.finalY || 240
      doc.setFontSize(8)
      doc.text("This is a computer-generated document. No signature is required.", 105, footerStartY + 20, {
        align: "center",
      })
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        105,
        footerStartY + 25,
        { align: "center" },
      )

      // Save the PDF
      doc.save(`Payslip-${payslip.payPeriod}.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({
        title: "Error",
        description: "Failed to generate payslip PDF. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getPayslipsByMonth = () => {
    const payslipsByMonth: Record<string, Payslip[]> = {}

    if (!payslips) return payslipsByMonth

    payslips.forEach((payslip) => {
      const date = new Date(payslip.payDate)
      const monthName = months[date.getMonth()]

      if (!payslipsByMonth[monthName]) {
        payslipsByMonth[monthName] = []
      }

      payslipsByMonth[monthName].push(payslip)
    })

    return payslipsByMonth
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <AlertCircle className="h-10 w-10 text-destructive mb-4" />
          <p className="text-lg font-medium mb-2">Error Loading Payslips</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </CardContent>
      </Card>
    )
  }

  const payslipsByMonth = getPayslipsByMonth()
  const ytdEarnings = calculateYTDEarnings()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Payslips</h1>
          <p className="text-muted-foreground">View and download your payslips</p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">YTD Earnings</CardTitle>
            <CardDescription>Total earnings for {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(ytdEarnings, payslips?.[0]?.currency || "USD")}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Payslips</CardTitle>
            <CardDescription>Total payslips for {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{payslips?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Latest Payslip</CardTitle>
            <CardDescription>Most recent payment</CardDescription>
          </CardHeader>
          <CardContent>
            {payslips && payslips.length > 0 ? (
              <div className="text-3xl font-bold">{formatCurrency(payslips[0].netPay, payslips[0].currency)}</div>
            ) : (
              <div className="text-muted-foreground">No payslips available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="monthly">Monthly View</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {!payslips || payslips.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No payslips found</p>
                <p className="text-sm text-muted-foreground">No payslips are available for the selected year</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="rounded-md border">
                  <div className="grid grid-cols-12 bg-muted/50 p-3 text-sm font-medium">
                    <div className="col-span-3">Pay Period</div>
                    <div className="col-span-2">Pay Date</div>
                    <div className="col-span-2">Gross Pay</div>
                    <div className="col-span-2">Net Pay</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>
                  {payslips.map((payslip, index) => (
                    <div
                      key={payslip.id}
                      className={`grid grid-cols-12 items-center p-3 text-sm ${
                        index !== payslips.length - 1 ? "border-b" : ""
                      }`}
                    >
                      <div className="col-span-3 font-medium">{payslip.payPeriod}</div>
                      <div className="col-span-2">{new Date(payslip.payDate).toLocaleDateString()}</div>
                      <div className="col-span-2">{formatCurrency(payslip.grossPay, payslip.currency)}</div>
                      <div className="col-span-2">{formatCurrency(payslip.netPay, payslip.currency)}</div>
                      <div className="col-span-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            payslip.status === "processed"
                              ? "bg-green-50 text-green-700"
                              : payslip.status === "pending"
                                ? "bg-yellow-50 text-yellow-700"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {payslip.status}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => generatePayslipPDF(payslip)}>
                          <Download className="h-4 w-4" />
                          <span className="sr-only">Download</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          {Object.keys(payslipsByMonth).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Calendar className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No payslips found</p>
                <p className="text-sm text-muted-foreground">No payslips are available for the selected year</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(payslipsByMonth)
              .sort((a, b) => months.indexOf(b[0]) - months.indexOf(a[0]))
              .map(([month, monthPayslips]) => (
                <Card key={month}>
                  <CardHeader>
                    <CardTitle>
                      {month} {selectedYear}
                    </CardTitle>
                    <CardDescription>
                      {monthPayslips.length} payslip{monthPayslips.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {monthPayslips.map((payslip) => (
                        <div key={payslip.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div className="flex items-center space-x-3">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{payslip.payPeriod}</p>
                              <p className="text-xs text-muted-foreground">
                                Paid on {new Date(payslip.payDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(payslip.netPay, payslip.currency)}</p>
                              <p className="text-xs text-muted-foreground">Net Pay</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => generatePayslipPDF(payslip)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
