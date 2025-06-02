"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth-provider"
import { Plus, Edit, Trash2, CheckCircle, Clock, AlertCircle, Users, FileText, RefreshCw } from "lucide-react"

interface WorkflowTemplateRead {
  id: number
  name: string
  description?: string
  workflow_type: "onboarding" | "offboarding" | "other"
  is_active: boolean
  auto_assign_on_status?: "active" | "resigned" | "terminated" | "on_notice" | "onboarding"
  steps: WorkflowStepTemplateRead[]
  created_at: string
  updated_at: string
}

interface WorkflowStepTemplateRead {
  id: number
  workflow_template_id: number
  name: string
  description?: string
  order: number
  is_mandatory: boolean
}

interface EmployeeWorkflowRead {
  id: number
  employee_id: number
  workflow_template_id: number
  workflow_template_name: string
  workflow_type: "onboarding" | "offboarding" | "other"
  assigned_on: string
  due_date?: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  steps: EmployeeWorkflowStepRead[]
}

interface EmployeeWorkflowStepRead {
  id: number
  step_template_id: number
  step_name: string
  step_description?: string
  step_order: number
  status: "pending" | "completed" | "skipped"
  completed_on?: string
  completed_by_user_email?: string
  notes?: string
  is_mandatory: boolean
}

interface EmployeeProfileReadWithUser {
  id: number
  user_first_name: string
  user_last_name: string
  user_email: string
  job_title?: string
  employment_status: string
  department?: {
    id: number
    name: string
  }
}

interface WorkflowStepTemplateCreate {
  name: string
  description?: string
  order: number
  is_mandatory: boolean
}

export default function WorkflowsPage() {
  const { fetchWithAuth, user } = useAuth()
  const { toast } = useToast()

  // State management
  const [templates, setTemplates] = useState<WorkflowTemplateRead[]>([])
  const [allEmployeeWorkflows, setAllEmployeeWorkflows] = useState<EmployeeWorkflowRead[]>([])
  const [employees, setEmployees] = useState<EmployeeProfileReadWithUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null)

  // Dialog states
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)

  // Form states
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    workflow_type: "onboarding" as const,
    is_active: true,
    auto_assign_on_status: "none",
    steps: [{ name: "", description: "", order: 1, is_mandatory: true }],
  })
  const [assignForm, setAssignForm] = useState({
    employee_id: "",
    template_id: "",
  })

  // Fetch workflows for a specific employee
  const fetchEmployeeWorkflows = async (employeeId: number) => {
    try {
      console.log(`Fetching workflows for employee ${employeeId}...`)
      const response = await fetchWithAuth(`/api/v1/workflows/employee/${employeeId}/workflows/`)

      if (response.ok) {
        const workflows = await response.json()
        console.log(`Workflows for employee ${employeeId}:`, workflows)
        return Array.isArray(workflows) ? workflows : []
      } else {
        console.warn(`Failed to fetch workflows for employee ${employeeId}: ${response.status}`)
        return []
      }
    } catch (error) {
      console.error(`Error fetching workflows for employee ${employeeId}:`, error)
      return []
    }
  }

  // Fetch data with improved error handling
  const fetchData = async () => {
    if (!user) {
      setError("User not authenticated")
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      console.log("Starting data fetch for admin workflows...")

      // Step 1: Fetch templates
      console.log("Fetching templates...")
      try {
        const templatesResponse = await fetchWithAuth("/api/v1/workflows/templates/")
        if (templatesResponse.ok) {
          const templatesData = await templatesResponse.json()
          setTemplates(Array.isArray(templatesData) ? templatesData : [])
          console.log("Templates loaded successfully:", templatesData?.length || 0)
        } else {
          console.error("Failed to fetch templates:", templatesResponse.status)
          setTemplates([])
        }
      } catch (error) {
        console.error("Error fetching templates:", error)
        setTemplates([])
      }

      // Step 2: Fetch employees
      console.log("Fetching employees...")
      try {
        const employeesResponse = await fetchWithAuth("/api/v1/employees/")
        if (employeesResponse.ok) {
          const employeesData = await employeesResponse.json()
          const employeesList = Array.isArray(employeesData) ? employeesData : []
          setEmployees(employeesList)
          console.log("Employees loaded successfully:", employeesList.length)
        } else {
          console.error("Failed to fetch employees:", employeesResponse.status)
          setEmployees([])
        }
      } catch (error) {
        console.error("Error fetching employees:", error)
        setEmployees([])
      }

      // Step 3: Initialize workflows as empty (will be loaded when employee is selected)
      setAllEmployeeWorkflows([])
    } catch (error) {
      console.error("Error in fetchData:", error)
      setError(error instanceof Error ? error.message : "Failed to load data")

      toast({
        title: "Error",
        description: "Failed to load workflow data. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load workflows for selected employee
  const loadEmployeeWorkflows = async (employeeId: number) => {
    try {
      setIsLoading(true)
      const workflows = await fetchEmployeeWorkflows(employeeId)

      // Add employee info to workflows
      const employee = employees.find((emp) => emp.id === employeeId)
      const workflowsWithEmployeeInfo = workflows.map((workflow) => ({
        ...workflow,
        employee_name: employee ? `${employee.user_first_name} ${employee.user_last_name}` : `Employee ${employeeId}`,
        employee_email: employee?.user_email || "",
      }))

      setAllEmployeeWorkflows(workflowsWithEmployeeInfo)
    } catch (error) {
      console.error("Error loading employee workflows:", error)
      setAllEmployeeWorkflows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [user])

  // Create workflow template
  const createTemplate = async () => {
    try {
      const steps = templateForm.steps.map((step, index) => ({
        name: step.name,
        description: step.description || "",
        order: index + 1,
        is_mandatory: step.is_mandatory,
      }))

      const payload = {
        name: templateForm.name,
        description: templateForm.description || "",
        workflow_type: templateForm.workflow_type,
        is_active: templateForm.is_active,
        auto_assign_on_status:
          templateForm.auto_assign_on_status === "none" ? null : templateForm.auto_assign_on_status,
        steps: steps,
      }

      console.log("Creating template with payload:", payload)

      const response = await fetchWithAuth("/api/v1/workflows/templates/", {
        method: "POST",
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Workflow template created successfully",
        })
        setIsTemplateDialogOpen(false)
        setTemplateForm({
          name: "",
          description: "",
          workflow_type: "onboarding",
          is_active: true,
          auto_assign_on_status: "none",
          steps: [{ name: "", description: "", order: 1, is_mandatory: true }],
        })
        fetchData()
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Template creation failed:", errorData)
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }
    } catch (error) {
      console.error("Error creating template:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create template",
        variant: "destructive",
      })
    }
  }

  // Assign workflow to employee
  const assignWorkflow = async () => {
    try {
      if (!assignForm.employee_id || !assignForm.template_id) {
        toast({
          title: "Error",
          description: "Please select both employee and template",
          variant: "destructive",
        })
        return
      }

      console.log("Assigning workflow:", assignForm)

      const response = await fetchWithAuth(
        `/api/v1/workflows/employee/${assignForm.employee_id}/assign-workflow/${assignForm.template_id}`,
        {
          method: "POST",
        },
      )

      if (response.ok) {
        toast({
          title: "Success",
          description: "Workflow assigned successfully",
        })
        setIsAssignDialogOpen(false)
        setAssignForm({ employee_id: "", template_id: "" })

        // Refresh workflows if the assigned employee is currently selected
        if (selectedEmployeeId && selectedEmployeeId.toString() === assignForm.employee_id) {
          loadEmployeeWorkflows(selectedEmployeeId)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Workflow assignment failed:", errorData)
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }
    } catch (error) {
      console.error("Error assigning workflow:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign workflow",
        variant: "destructive",
      })
    }
  }

  // Update workflow progress
  const updateWorkflowProgress = async (empStepId: number, status: string, notes?: string) => {
    try {
      console.log("Updating workflow step:", { empStepId, status, notes })

      const response = await fetchWithAuth(`/api/v1/workflows/employee-step/${empStepId}/update`, {
        method: "PUT",
        body: JSON.stringify({ status, notes }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Workflow progress updated",
        })

        // Refresh current employee's workflows
        if (selectedEmployeeId) {
          loadEmployeeWorkflows(selectedEmployeeId)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Step update failed:", errorData)
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }
    } catch (error) {
      console.error("Error updating workflow:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update workflow",
        variant: "destructive",
      })
    }
  }

  // Add step to template form
  const addStep = () => {
    setTemplateForm((prev) => ({
      ...prev,
      steps: [...prev.steps, { name: "", description: "", order: prev.steps.length + 1, is_mandatory: true }],
    }))
  }

  // Remove step from template form
  const removeStep = (index: number) => {
    setTemplateForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }))
  }

  // Update step in template form
  const updateStep = (index: number, field: string, value: any) => {
    setTemplateForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => (i === index ? { ...step, [field]: value } : step)),
    }))
  }

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        )
      case "in_progress":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            In Progress
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      case "cancelled":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Calculate workflow progress
  const getWorkflowProgress = (workflow: EmployeeWorkflowRead) => {
    if (!workflow.steps || workflow.steps.length === 0) return 0
    const completedSteps = workflow.steps.filter((step) => step.status === "completed").length
    return Math.round((completedSteps / workflow.steps.length) * 100)
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading workflows...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state with retry option
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Workflow Management</h1>
          <p className="text-muted-foreground">Manage workflow templates and track employee progress</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Workflow Template</DialogTitle>
                <DialogDescription>Create a new workflow template with multiple steps</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Employee Onboarding"
                    />
                  </div>
                  <div>
                    <Label htmlFor="workflow-type">Workflow Type</Label>
                    <Select
                      value={templateForm.workflow_type}
                      onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, workflow_type: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                        <SelectItem value="offboarding">Offboarding</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="template-description">Description</Label>
                  <Textarea
                    id="template-description"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the workflow purpose..."
                  />
                </div>
                <div>
                  <Label htmlFor="auto-assign">Auto Assign on Status</Label>
                  <Select
                    value={templateForm.auto_assign_on_status}
                    onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, auto_assign_on_status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_notice">On Notice</SelectItem>
                      <SelectItem value="resigned">Resigned</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Workflow Steps</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addStep}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Step
                    </Button>
                  </div>
                  {templateForm.steps.map((step, index) => (
                    <Card key={index} className="p-4 mb-2">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium">Step {index + 1}</h4>
                          {templateForm.steps.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeStep(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Step Name</Label>
                            <Input
                              value={step.name}
                              onChange={(e) => updateStep(index, "name", e.target.value)}
                              placeholder="e.g., Complete paperwork"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`mandatory-${index}`}
                              checked={step.is_mandatory}
                              onChange={(e) => updateStep(index, "is_mandatory", e.target.checked)}
                            />
                            <Label htmlFor={`mandatory-${index}`}>Mandatory</Label>
                          </div>
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea
                            value={step.description}
                            onChange={(e) => updateStep(index, "description", e.target.value)}
                            placeholder="Describe what needs to be done..."
                            rows={2}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createTemplate}>Create Template</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Assign Workflow
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Workflow</DialogTitle>
                <DialogDescription>Assign a workflow template to an employee</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Employee</Label>
                  <Select
                    value={assignForm.employee_id}
                    onValueChange={(value) => setAssignForm((prev) => ({ ...prev, employee_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees && employees.length > 0 ? (
                        employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id.toString()}>
                            {employee.user_first_name} {employee.user_last_name} - {employee.user_email}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-employees" disabled>
                          No employees available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Workflow Template</Label>
                  <Select
                    value={assignForm.template_id}
                    onValueChange={(value) => setAssignForm((prev) => ({ ...prev, template_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates && templates.length > 0 ? (
                        templates
                          .filter((template) => template.is_active)
                          .map((template) => (
                            <SelectItem key={template.id} value={template.id.toString()}>
                              {template.name} ({template.workflow_type})
                            </SelectItem>
                          ))
                      ) : (
                        <SelectItem value="no-templates" disabled>
                          No templates available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={assignWorkflow}
                    disabled={
                      !assignForm.employee_id ||
                      !assignForm.template_id ||
                      assignForm.employee_id === "no-employees" ||
                      assignForm.template_id === "no-templates"
                    }
                  >
                    Assign Workflow
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Workflows</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Active Workflows
              </CardTitle>
              <CardDescription>Track ongoing employee workflows and their progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Select Employee to View Workflows</Label>
                <Select
                  value={selectedEmployeeId?.toString() || ""}
                  onValueChange={(value) => {
                    if (value && value !== "no-employees") {
                      const empId = Number.parseInt(value)
                      setSelectedEmployeeId(empId)
                      loadEmployeeWorkflows(empId)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees && employees.length > 0 ? (
                      employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id.toString()}>
                          {employee.user_first_name} {employee.user_last_name} - {employee.user_email}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-employees" disabled>
                        No employees available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedEmployeeId && allEmployeeWorkflows && allEmployeeWorkflows.length > 0 ? (
                <div className="space-y-4">
                  {allEmployeeWorkflows
                    .filter((workflow) => workflow.status === "pending" || workflow.status === "in_progress")
                    .map((workflow) => (
                      <Card key={workflow.id} className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold">
                              {workflow.employee_name || `Employee ${workflow.employee_id}`}
                            </h3>
                            <p className="text-sm text-muted-foreground">{workflow.workflow_template_name}</p>
                            <p className="text-xs text-muted-foreground">{workflow.workflow_type}</p>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(workflow.status)}
                            <p className="text-sm text-muted-foreground mt-1">
                              Assigned: {new Date(workflow.assigned_on).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{getWorkflowProgress(workflow)}%</span>
                          </div>
                          <Progress value={getWorkflowProgress(workflow)} className="h-2" />
                        </div>
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Steps</h4>
                          <div className="space-y-2">
                            {workflow.steps &&
                              workflow.steps
                                .sort((a, b) => a.step_order - b.step_order)
                                .map((step) => (
                                  <div key={step.id} className="flex items-center justify-between p-2 border rounded">
                                    <div className="flex items-center gap-2">
                                      {step.status === "completed" ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />
                                      )}
                                      <div>
                                        <span className="text-sm font-medium">{step.step_name}</span>
                                        {step.step_description && (
                                          <p className="text-xs text-muted-foreground">{step.step_description}</p>
                                        )}
                                        {step.completed_on && (
                                          <p className="text-xs text-muted-foreground">
                                            Completed: {new Date(step.completed_on).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      {getStatusBadge(step.status)}
                                      {step.status === "pending" && (
                                        <Button size="sm" onClick={() => updateWorkflowProgress(step.id, "completed")}>
                                          Complete
                                        </Button>
                                      )}
                                      {!step.is_mandatory && step.status === "pending" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => updateWorkflowProgress(step.id, "skipped")}
                                        >
                                          Skip
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  {allEmployeeWorkflows.filter(
                    (workflow) => workflow.status === "pending" || workflow.status === "in_progress",
                  ).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No active workflows found for this employee</p>
                    </div>
                  )}
                </div>
              ) : selectedEmployeeId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No workflows found for this employee</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select an employee to view their workflows</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Workflow Templates ({templates.length})
              </CardTitle>
              <CardDescription>Manage reusable workflow templates</CardDescription>
            </CardHeader>
            <CardContent>
              {templates && templates.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template) => (
                    <Card key={template.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{template.name}</h3>
                          <Badge variant="outline" className="mt-1">
                            {template.workflow_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {!template.is_active && <Badge variant="secondary">Inactive</Badge>}
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{template.description || "No description"}</p>
                      <div className="space-y-1">
                        <p className="text-xs font-medium">Steps ({template.steps?.length || 0}):</p>
                        {template.steps &&
                          template.steps
                            .sort((a, b) => a.order - b.order)
                            .slice(0, 3)
                            .map((step, index) => (
                              <p key={index} className="text-xs text-muted-foreground">
                                {step.order}. {step.name}
                                {step.is_mandatory && <span className="text-red-500">*</span>}
                              </p>
                            ))}
                        {template.steps && template.steps.length > 3 && (
                          <p className="text-xs text-muted-foreground">+{template.steps.length - 3} more steps</p>
                        )}
                      </div>
                      {template.auto_assign_on_status && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">
                            Auto-assign on {template.auto_assign_on_status}
                          </Badge>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No templates found</p>
                  <p className="text-sm">Create your first workflow template to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Completed Workflows
              </CardTitle>
              <CardDescription>View completed employee workflows</CardDescription>
            </CardHeader>
            <CardContent>
              {allEmployeeWorkflows && allEmployeeWorkflows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allEmployeeWorkflows
                      .filter((workflow) => workflow.status === "completed")
                      .map((workflow) => (
                        <TableRow key={workflow.id}>
                          <TableCell>{workflow.employee_name || `Employee ${workflow.employee_id}`}</TableCell>
                          <TableCell>{workflow.workflow_template_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{workflow.workflow_type}</Badge>
                          </TableCell>
                          <TableCell>{new Date(workflow.assigned_on).toLocaleDateString()}</TableCell>
                          <TableCell>{getStatusBadge(workflow.status)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed workflows found</p>
                  <p className="text-sm">Select an employee to view their completed workflows</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
