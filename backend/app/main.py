from fastapi import FastAPI
from app.api.v1.api import api_router
from app.core.db import create_db_and_tables, engine # Import engine
from app.core.config import settings # For app title, version etc. (optional)
# from sqlmodel import SQLModel # Only if you were creating tables here

# Create database tables on startup
# In a production app, you'd use Alembic for migrations.
from fastapi.middleware.cors import CORSMiddleware

origins = [
    "*",
    "http://localhost",         # Common for local dev
    "http://localhost:3000",    # Common for React dev server
    "http://localhost:5173",    # Common for Vite dev server (like yours)
    "http://127.0.0.1",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://157.180.95.128:3000",  # Your server's frontend
    "http://157.180.95.128:8000",  # Your server's backend
    # Add your deployed frontend URL here when you have one
    # "https://your-deployed-frontend.com",
]

# If you truly want to allow ALL origins (use with caution):
# origins = ["*"]



async def lifespan(app: FastAPI):
    print("Application startup: Creating database and tables...")
    create_db_and_tables() # Call the function here
    yield
    print("Application shutdown.")

app = FastAPI(
    title="HR Management Software API",
    openapi_url=f"/api/v1/openapi.json",
    lifespan=lifespan # Use the new lifespan context manager
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allows specific origins or ["*"] for all
    allow_credentials=True, # Allows cookies to be included in requests (if your auth needs it)
    allow_methods=["*"],    # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],    # Allows all headers
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to the HR Management Software API"}

# To run (from the root hr_software/ directory):
# uvicorn app.main:app --reload