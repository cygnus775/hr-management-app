# hr_software/scripts/generate_dummy_payslip_py.py

import requests
import json
import time
from datetime import datetime

# --- Configuration ---
BASE_URL = "http://localhost:8000/api/v1"  # Your FastAPI backend URL

ADMIN_EMAIL = "admin@hrflow.com"
ADMIN_PASSWORD = "AdminPa$$wOrd!"

EMPLOYEE_EMAIL_TARGET = "dev.one@hrflow.com"
EMPLOYEE_PASSWORD_TARGET = "DevPa$$wOrd!"


# --- Helper for API Calls ---
def api_request(
    method,
    endpoint,
    token=None,
    data=None,
    json_payload=None,
    params=None,
    files=None,
    content_type=None,
):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{BASE_URL}{endpoint}"

    print(f"-----------------------------------------------------")
    print(f"CALL: {method} {url}")
    if data or json_payload:
        print(f"DATA: {data or json_payload}")

    try:
        if method.upper() == "POST":
            if files:  # For multipart/form-data (like document upload)
                response = requests.post(url, headers=headers, data=data, files=files)
            elif content_type == "application/x-www-form-urlencoded":
                headers["Content-Type"] = content_type
                response = requests.post(url, headers=headers, data=data)
            else:  # Default to JSON payload for POST
                headers["Content-Type"] = "application/json"
                response = requests.post(
                    url, headers=headers, json=json_payload or data
                )
        elif method.upper() == "PUT":
            headers["Content-Type"] = "application/json"
            response = requests.put(url, headers=headers, json=json_payload or data)
        elif method.upper() == "GET":
            response = requests.get(url, headers=headers, params=params)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

        response.raise_for_status()  # Raise an exception for HTTP errors (4xx or 5xx)

        print(f"STATUS: {response.status_code}")
        try:
            response_json = response.json()
            print("RESPONSE JSON:")
            print(json.dumps(response_json, indent=2))
            print(f"-----------------------------------------------------")
            return response_json
        except json.JSONDecodeError:
            print("RESPONSE TEXT (not JSON):")
            print(response.text)
            print(f"-----------------------------------------------------")
            if response.status_code == 204:  # No Content
                return None
            return response.text  # Or handle as error if JSON was expected

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
        print(f"Response Text: {response.text}")
        print(f"-----------------------------------------------------")
        try:
            return response.json()  # Try to return error detail if it's JSON
        except json.JSONDecodeError:
            return {
                "error": str(http_err),
                "detail": response.text,
            }  # Fallback error structure
    except requests.exceptions.RequestException as req_err:
        print(f"Request exception occurred: {req_err}")
        print(f"-----------------------------------------------------")
        return {"error": str(req_err)}


def main():
    # --- Step 1: Log in as Admin ---
    print("Logging in as Admin...")
    admin_login_payload = {"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    # For x-www-form-urlencoded, requests expects data, not json
    admin_login_response = api_request(
        "POST",
        "/auth/token",
        data=admin_login_payload,
        content_type="application/x-www-form-urlencoded",
    )

    if not admin_login_response or "access_token" not in admin_login_response:
        print("Admin login failed. Exiting.")
        return
    admin_token = admin_login_response["access_token"]
    print(f"Admin Token: {admin_token[:20]}...")  # Print partial token

    # --- Step 2: Create/Get Salary Components ---
    print("\nCreating/Getting Salary Components...")
    basic_comp_payload = {
        "name": "Basic Salary (PyScript)",
        "type": "earning_fixed",
        "description": "Monthly basic from PyScript",
        "is_taxable": True,
    }
    basic_comp_response = api_request(
        "POST",
        "/payroll/components/",
        token=admin_token,
        json_payload=basic_comp_payload,
    )

    basic_comp_id = basic_comp_response.get("id") if basic_comp_response else None
    if not basic_comp_id:  # If creation failed (e.g. already exists), try to get it
        print(
            "Basic component creation failed or already exists, attempting to fetch..."
        )
        all_comps = api_request("GET", "/payroll/components/", token=admin_token)
        if all_comps:
            for comp in all_comps:
                if comp.get("name") == basic_comp_payload["name"]:
                    basic_comp_id = comp.get("id")
                    break
    if not basic_comp_id:
        print("Failed to get Basic Salary component ID. Exiting.")
        return
    print(f"Basic Salary Component ID: {basic_comp_id}")

    deduction_comp_payload = {
        "name": "Standard Deduction (PyScript)",
        "type": "deduction_fixed",
        "description": "Fixed deduction from PyScript",
        "is_taxable": False,
    }
    deduction_comp_response = api_request(
        "POST",
        "/payroll/components/",
        token=admin_token,
        json_payload=deduction_comp_payload,
    )
    deduction_comp_id = (
        deduction_comp_response.get("id") if deduction_comp_response else None
    )
    if not deduction_comp_id:
        print(
            "Deduction component creation failed or already exists, attempting to fetch..."
        )
        all_comps = api_request("GET", "/payroll/components/", token=admin_token)
        if all_comps:
            for comp in all_comps:
                if comp.get("name") == deduction_comp_payload["name"]:
                    deduction_comp_id = comp.get("id")
                    break
    if not deduction_comp_id:
        print("Failed to get Standard Deduction component ID. Exiting.")
        return
    print(f"Standard Deduction Component ID: {deduction_comp_id}")

    # --- Get Target Employee's Profile ID ---
    print(f"\nFetching target employee profile for {EMPLOYEE_EMAIL_TARGET}...")
    all_employees_response = api_request(
        "GET", "/employees/", token=admin_token, params={"limit": 100}
    )  # Adjust limit if many employees
    target_employee_profile_id = None
    if all_employees_response and isinstance(all_employees_response, list):
        for emp in all_employees_response:
            if emp.get("user_email") == EMPLOYEE_EMAIL_TARGET:
                target_employee_profile_id = emp.get("id")
                break

    if not target_employee_profile_id:
        print(
            f"Target employee profile ID not found for email {EMPLOYEE_EMAIL_TARGET}. Exiting."
        )
        return
    print(f"Target Employee Profile ID: {target_employee_profile_id}")

    # --- Step 3: Assign Salary Components to Employee ---
    print(
        f"\nAssigning Salary Components to Employee ID: {target_employee_profile_id}..."
    )
    assign_basic_payload = {
        "employee_id": target_employee_profile_id,
        "component_id": basic_comp_id,
        "amount": 70000.00,  # Example amount
        "effective_from": "2024-01-01",  # Ensure this date is before or on the payroll month
    }
    api_request(
        "POST",
        "/payroll/employee-structure/",
        token=admin_token,
        json_payload=assign_basic_payload,
    )

    assign_deduct_payload = {
        "employee_id": target_employee_profile_id,
        "component_id": deduction_comp_id,
        "amount": 2000.00,  # Example amount
        "effective_from": "2024-01-01",
    }
    api_request(
        "POST",
        "/payroll/employee-structure/",
        token=admin_token,
        json_payload=assign_deduct_payload,
    )

    # --- Step 4: Initiate Payroll Run ---
    now = datetime.now()
    payroll_month = 8
    payroll_year = now.year
    # For testing, you might want to set a specific past month/year
    # payroll_month = 5
    # payroll_year = 2024
    print(
        f"\nInitiating Payroll Run for {payroll_month:02d}/{payroll_year} for Employee ID: {target_employee_profile_id}..."
    )
    run_payroll_payload = {
        "month": payroll_month,
        "year": payroll_year,
        "employee_ids": [target_employee_profile_id],
    }
    payroll_run_response = api_request(
        "POST", "/payroll/runs/", token=admin_token, json_payload=run_payroll_payload
    )

    if not payroll_run_response or "id" not in payroll_run_response:
        print("Failed to initiate payroll run. Exiting.")
        return
    payroll_run_id = payroll_run_response["id"]
    payroll_run_status = payroll_run_response.get("status")
    print(f"Payroll Run ID: {payroll_run_id}, Initial Status: {payroll_run_status}")

    # Wait for backend processing if it's async or if status is 'draft'
    if payroll_run_status == "draft":
        print("Payroll run is DRAFT. Waiting 5 seconds for potential processing...")
        time.sleep(5)
        current_run_details = api_request(
            "GET", f"/payroll/runs/{payroll_run_id}", token=admin_token
        )
        payroll_run_status = (
            current_run_details.get("status")
            if current_run_details
            else payroll_run_status
        )
        print(f"Updated Payroll Run Status: {payroll_run_status}")

    # --- Step 5: Approve the Payroll Run ---
    if (
        payroll_run_status == "pending_approval" or payroll_run_status == "draft"
    ):  # Allow approving draft if needed
        print(f"\nApproving Payroll Run ID: {payroll_run_id}...")
        approve_run_payload = {"status": "approved"}
        api_request(
            "PUT",
            f"/payroll/runs/{payroll_run_id}/status",
            token=admin_token,
            json_payload=approve_run_payload,
        )
    else:
        print(
            f"Payroll run is not in a state to be approved (Current: {payroll_run_status}). Skipping direct approval."
        )

    # --- Step 6: (Optional) Mark as Paid ---
    # Check status again before marking as paid
    current_run_details = api_request(
        "GET", f"/payroll/runs/{payroll_run_id}", token=admin_token
    )
    if current_run_details and current_run_details.get("status") == "approved":
        print(f"\nMarking Payroll Run ID: {payroll_run_id} as Paid...")
        paid_run_payload = {"status": "paid"}
        api_request(
            "PUT",
            f"/payroll/runs/{payroll_run_id}/status",
            token=admin_token,
            json_payload=paid_run_payload,
        )

    # --- Step 7: Log in as Employee and Fetch Payslips ---
    print(f"\nLogging in as Employee {EMPLOYEE_EMAIL_TARGET}...")
    employee_login_payload = {
        "username": EMPLOYEE_EMAIL_TARGET,
        "password": EMPLOYEE_PASSWORD_TARGET,
    }
    employee_login_response = api_request(
        "POST",
        "/auth/token",
        data=employee_login_payload,
        content_type="application/x-www-form-urlencoded",
    )

    if not employee_login_response or "access_token" not in employee_login_response:
        print("Employee login failed. Exiting.")
        return
    employee_token = employee_login_response["access_token"]
    print(f"Employee Token obtained.")

    print("\nFetching Employee's Payslips...")
    my_payslips_response = api_request(
        "GET", "/payroll/payslips/me", token=employee_token
    )
    if my_payslips_response and isinstance(my_payslips_response, list):
        print(f"Found {len(my_payslips_response)} payslip(s).")
        # Further actions: download a specific payslip if needed
    else:
        print("No payslips found or error fetching them.")

    print("\nScript finished.")


if __name__ == "__main__":
    main()
