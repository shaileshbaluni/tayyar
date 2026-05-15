import json
from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional, Dict, Any
from analysis import salary_negotiator
from pydantic import BaseModel

router = APIRouter(prefix="/salary", tags=["Salary Negotiation"])
negotiator = salary_negotiator.SalaryNegotiator()

class ConfigModel(BaseModel):
    current_ctc: Optional[float] = None
    offered_ctc: float
    target_ctc: float
    company: str
    role: str
    city: str
    difficulty: str
    experience: float = 0

class BreakupRequest(BaseModel):
    ctc: float
    city: str

class SimulationRequest(BaseModel):
    scenario: str
    difficulty: str
    config: Dict[str, Any]
    history: List[Dict[str, str]]

class ScorecardRequest(BaseModel):
    config: Dict[str, Any]
    transcript: List[Dict[str, str]]

@router.get("/market-data")
async def get_market_data(company: str, role: str, exp: float, city: str):
    try:
        return negotiator.get_market_benchmarks(company, role, exp, city)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/calculate-breakup")
async def calculate_breakup(req: BreakupRequest):
    try:
        return negotiator.calculate_breakup(req.ctc, req.city)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simulate")
async def simulate(req: SimulationRequest):
    try:
        return await negotiator.get_hr_response(req.scenario, req.difficulty, req.config, req.history)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/scorecard")
async def get_scorecard(req: ScorecardRequest):
    try:
        return await negotiator.generate_scorecard(req.config, req.transcript)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
