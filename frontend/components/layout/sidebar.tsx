"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePathname } from "next/navigation"
import {
  Users,
  Building2,
  Calendar,
  FileText,
  BarChart3,
  Home,
  DollarSign,
  Target,
  Workflow,
  User,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()

  // Define navigation items based on user role
  const adminNavItems = [
    {
      title: "Dashboard",
      href: "/admin/dashboard",
      icon: <Home className="h-5 w-5" />,
    },
    {
      title: "Employees",
      href: "/admin/employees",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Departments",
      href: "/admin/departments",
      icon: <Building2 className="h-5 w-5" />,
    },
    {
      title: "Leave Management",
      href: "/admin/leaves",
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      title: "Leave Balances",
      href: "/admin/leave-balances",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: "Payroll",
      href: "/admin/payroll",
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: "Performance",
      href: "/admin/performance",
      icon: <Target className="h-5 w-5" />,
    },
    {
      title: "Workflows",
      href: "/admin/workflows",
      icon: <Workflow className="h-5 w-5" />,
    },
    {
      title: "Reports",
      href: "/admin/reports",
      icon: <BarChart3 className="h-5 w-5" />,
    },
  ]

  const managerNavItems = [
    {
      title: "Dashboard",
      href: "/manager/dashboard",
      icon: <Home className="h-5 w-5" />,
    },
    {
      title: "Leave Requests",
      href: "/manager/leaves",
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      title: "Performance",
      href: "/manager/performance",
      icon: <Target className="h-5 w-5" />,
    },
    {
      title: "Payslips",
      href: "/manager/payslips",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: "Profile",
      href: "/manager/profile",
      icon: <User className="h-5 w-5" />,
    },
  ]

  const employeeNavItems = [
    {
      title: "Dashboard",
      href: "/employee/dashboard",
      icon: <Home className="h-5 w-5" />,
    },
    {
      title: "Leave",
      href: "/employee/leaves",
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      title: "Payslips",
      href: "/employee/payslips",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: "Performance",
      href: "/employee/performance",
      icon: <Target className="h-5 w-5" />,
    },
    {
      title: "Profile",
      href: "/employee/profile",
      icon: <User className="h-5 w-5" />,
    },
  ]

  // Select navigation items based on user role
  let navItems = []
  if (user?.role === "admin") {
    navItems = adminNavItems
  } else if (user?.role === "manager") {
    navItems = managerNavItems
  } else {
    navItems = employeeNavItems
  }

  return (
    <div className={cn("pb-12 border-r h-full", className)}>
      <div className="space-y-4 py-4">
        <div className="px-4 py-2">
          <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight">HR Management</h2>
          <div className="space-y-1">
            <ScrollArea className="h-[calc(100vh-10rem)]">
              <div className="space-y-1 p-2">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent hover:text-accent-foreground",
                      pathname === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.icon}
                    {item.title}
                  </a>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}
