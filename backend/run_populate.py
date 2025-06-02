import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))

# Load environment variables from root .env file
root_dir = backend_dir.parent
env_path = root_dir / '.env'
load_dotenv(env_path)

# Now we can import from app
from scripts.populate_initial_data import main as populate_main
from scripts.generate_dummy import main as generate_main
import asyncio

async def run_all():
    print("Running initial data population...")
    await populate_main()
    print("\nRunning dummy data generation...")
    # generate_main is not async, so we don't await it
    generate_main()

if __name__ == "__main__":
    asyncio.run(run_all()) 