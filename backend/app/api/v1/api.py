from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, employees, leaves, payroll, performance, reports, workflows

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(employees.router, prefix="/employees", tags=["Employees & Departments"])
api_router.include_router(leaves.router, prefix="/leaves", tags=["Leave Management"])
api_router.include_router(payroll.router, prefix="/payroll", tags=["Payroll Management"])
api_router.include_router(performance.router, prefix="/performance", tags=["Performance Management"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports & Analytics"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["Workflows"])