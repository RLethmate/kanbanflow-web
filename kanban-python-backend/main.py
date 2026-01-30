# kanban-python-backend/main.py

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import kanban_engine # <--- IMPORT YOUR ENGINE HERE

# Initialize FastAPI app
app = FastAPI(
    title="Kanban Flow Simulation API",
    description="Backend for a Kanban board simulation, managing cards, parameters, and dashboard data.",
    version="0.1.0",
)


# --- CORS Configuration ---
# IMPORTANT: Replace these with the actual URL(s) of your TYPO3 frontend when deployed.
# For local development, http://localhost:3000 (React's default dev server) is needed.
origins = [
    "http://localhost:3000",
    "http://localhost",
    "https://www.it-agile.de", # <--- IMPORTANT: Update with your actual TYPO3 domain!
    "http://127.0.0.1:3000",
    "https://f1dcfea1a82a.ngrok-free.app"#<--- ADD YOUR NGROK URL HERE (copy exact URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models for Request/Response ---
class CardModel(BaseModel):
    id: str
    birth_id: int
    col: int # Represents lane ID (0-7)
    x: int
    y: int
    target_col: int | None = None
    target_x: int | None = None
    moving: bool
    days_on_board: int
    start_day: int
    finish_day: int | None = None
    cycle_time: int | None = None
    is_red: bool
    processing_time: int
    BZ: int
    WZ: int

class LaneModel(BaseModel):
    id: str
    title: str
    cards: list[CardModel]
    wip_limit: int # Current WIP limit for the group/lane
    max_wip_in_round: int = 0 # Max WIP reached in this column/lane in the current round

class BoardStateModel(BaseModel):
    lanes: list[LaneModel]

class SimulationConfig(BaseModel):
    complexity: dict[str, int] # <-- Frontend sends string keys (e.g., {"1": 2})
    wip_limit: int
    speed: float

class DashboardEntry(BaseModel):
    round: int
    wip_limit: int
    red_card_cycle_time: str
    flow_efficiency: str
    in_progress: int
    done: int
    throughput: str


# --- Global FastAPI State Variables ---
simulation_task = None # To hold the asyncio task for the simulation loop

# --- Internal Simulation Loop (Calls your engine's step function) ---
async def run_simulation_loop():
    global simulation_task
    try:
        while kanban_engine.is_simulation_active():
            kanban_engine.advance_simulation_step()
            # The engine itself sets the _red_card_reached_end flag and handles stopping.
            # We just break this FastAPI loop if the engine says it's stopped.
            if not kanban_engine.is_simulation_active(): # Check if engine itself deactivated simulation
                 break
            await asyncio.sleep(kanban_engine.get_simulation_speed())
    except asyncio.CancelledError:
        print("FastAPI: Simulation loop task was cancelled.")
    finally:
        print("FastAPI: Simulation loop finished.")
        simulation_task = None # Ensure task is cleared if loop ends

# --- API Endpoints ---
@app.get("/")
async def read_root():
    return {"message": "Hello from your Python FastAPI backend!"}

@app.post("/simulation/config")
async def set_simulation_config_endpoint(config: SimulationConfig):
    # Change: kanban_engine.set_simulation_parameters_api
    kanban_engine.set_simulation_parameters_api(
        complexity=config.complexity,
        wip_limit=config.wip_limit,
        speed=config.speed
    )
    return {"status": "success", "message": "Simulation parameters updated", "parameters": config.model_dump()}

@app.post("/simulation/start")
async def start_simulation_endpoint():
    global simulation_task
    # Change: kanban_engine.is_simulation_active_api
    if kanban_engine.is_simulation_active_api():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Simulation is already running.")

    # Change: kanban_engine.start_simulation_api
    kanban_engine.start_simulation_api()

    simulation_task = asyncio.create_task(run_simulation_loop())
    print("FastAPI: Simulation background task started.")
    return {"status": "success", "message": "Simulation started."}

@app.post("/simulation/stop")
async def stop_simulation_endpoint():
    global simulation_task
    # Change: kanban_engine.is_simulation_active_api
    if not kanban_engine.is_simulation_active_api():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Simulation is not running.")

    # Change: kanban_engine.stop_simulation_api
    kanban_engine.stop_simulation_api()

    if simulation_task:
        simulation_task.cancel()
        try:
            await simulation_task
        except asyncio.CancelledError:
            print("FastAPI: Simulation task cancelled successfully.")
        finally:
            simulation_task = None

    print("FastAPI: Simulation stopped.")
    return {"status": "success", "message": "Simulation stopped."}

@app.get("/simulation/status", response_model=BoardStateModel)
async def get_simulation_status():
    # Change: kanban_engine.get_current_board_state_api
    board_state_data = kanban_engine.get_current_board_state_api()
    return board_state_data

@app.get("/dashboard/data")
async def get_dashboard_data_endpoint():
    # Change: kanban_engine.get_dashboard_metrics_api
    return {"dashboard_entries": kanban_engine.get_dashboard_metrics_api()}

@app.post("/dashboard/clear")
async def clear_dashboard_endpoint():
    # Change: kanban_engine.clear_dashboard_data_api
    kanban_engine.clear_dashboard_data_api()
    return {"status": "success", "message": "Dashboard cleared."}

# --- Internal Simulation Loop (Calls your engine's step function) ---
async def run_simulation_loop():
    global simulation_task
    try:
        # Change: kanban_engine.is_simulation_active_api
        while kanban_engine.is_simulation_active_api():
            # Change: kanban_engine.advance_simulation_step_api
            kanban_engine.advance_simulation_step_api()
            # Change: kanban_engine.is_simulation_active_api
            if not kanban_engine.is_simulation_active_api():
                 break
            # Change: kanban_engine.get_simulation_speed_api
            await asyncio.sleep(kanban_engine.get_simulation_speed_api())
    except asyncio.CancelledError:
        print("FastAPI: Simulation loop task was cancelled.")
    finally:
        print("FastAPI: Simulation loop finished.")
        simulation_task = None


@app.on_event("startup")
async def startup_event():
    # This one was already correct
    kanban_engine.initialize_engine_api()
    print("FastAPI app startup: Kanban Engine initialized.")






if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)