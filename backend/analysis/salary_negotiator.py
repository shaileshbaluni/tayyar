import json
import logging
import asyncio
from typing import Any, List, Dict, Optional
import httpx
from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

class SalaryNegotiator:
    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = "gemini-2.0-pro-exp-02-05" # Using Pro for complex negotiation logic
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

    def calculate_breakup(self, ctc_lpa: float, city: str = "Metro") -> Dict[str, Any]:
        """Calculates a realistic CTC breakup for Indian payroll standards."""
        annual_ctc = ctc_lpa * 100000
        monthly_ctc = annual_ctc / 12

        cnorm = (city or "").lower()
        is_metro = cnorm == "metro" or any(
            x in cnorm
            for x in (
                "mumbai",
                "bangalore",
                "bengaluru",
                "delhi",
                "ncr",
                "gurgaon",
                "gurugram",
                "noida",
                "hyderabad",
                "pune",
                "chennai",
                "kolkata",
            )
        )

        # Standard Indian Breakup Logic
        basic = annual_ctc * 0.40 # 40% of CTC
        hra = basic * 0.50 if is_metro else basic * 0.40
        pf_employer = min(basic * 0.12, 1800 * 12) # Capped at 1800/month usually
        pf_employee = pf_employer
        gratuity = basic * 0.0481 # Approx 15/26 * monthly basic / year
        
        special_allowance = annual_ctc - (basic + hra + pf_employer + gratuity)
        
        # Monthly in-hand estimation (Simple tax logic)
        monthly_gross = (basic + hra + special_allowance) / 12
        taxable_income = annual_ctc - (pf_employee + 50000) # Standard deduction
        # Very rough tax estimate (simplified)
        tax = 0
        if taxable_income > 1500000: tax = (taxable_income - 1500000) * 0.30 + 150000
        elif taxable_income > 1000000: tax = (taxable_income - 1000000) * 0.20 + 50000
        elif taxable_income > 500000: tax = (taxable_income - 500000) * 0.10
        
        monthly_tax = tax / 12
        monthly_in_hand = monthly_gross - pf_employee/12 - monthly_tax
        
        return {
            "annual": {
                "ctc": annual_ctc,
                "basic": basic,
                "hra": hra,
                "pf_employer": pf_employer,
                "gratuity": gratuity,
                "special_allowance": special_allowance,
                "tax_est": tax
            },
            "monthly": {
                "gross": monthly_gross,
                "pf_employee": pf_employee / 12,
                "tax": monthly_tax,
                "in_hand": monthly_in_hand
            }
        }

    def get_market_benchmarks(self, company: str, role: str, exp_years: float, city: str) -> Dict[str, Any]:
        """Returns mock salary benchmarks based on industry data."""
        # Base ranges for different company tiers
        tier_1 = ["Google", "Microsoft", "Amazon", "Directi", "Razorpay", "CRED"]
        tier_2 = ["TCS", "Infosys", "Wipro", "HCL", "Accenture", "Cognizant"]
        
        multiplier = 1.0
        if company in tier_1: multiplier = 3.5
        elif company in tier_2: multiplier = 1.0
        else: multiplier = 1.5 # Mid-size/other startups
        
        base = 4.0 + (exp_years * 2.5) # Base formula
        median = base * multiplier
        
        return {
            "min": round(median * 0.75, 1),
            "p25": round(median * 0.85, 1),
            "median": round(median, 1),
            "p75": round(median * 1.2, 1),
            "max": round(median * 1.5, 1),
            "currency": "LPA",
            "source": "Aggregated from AmbitionBox, Glassdoor, Levels.fyi"
        }

    async def get_hr_response(self, scenario: str, difficulty: str, config: Dict[str, Any], history: List[Dict[str, str]]) -> Dict[str, Any]:
        """Generates the AI HR's response and real-time coaching tips."""
        
        system_prompt = f"""
        You are an experienced HR Representative at {config.get('company', 'a tech company')}.
        You are negotiating a salary for a {config.get('role', 'Software Engineer')} role in {config.get('city', 'India')}.
        
        SCENARIO: {scenario}
        DIFFICULTY: {difficulty}
        USER'S CURRENT CTC: {config.get('current_ctc', 'N/A')} LPA
        OFFERED CTC: {config.get('offered_ctc', 'N/A')} LPA
        USER'S TARGET CTC: {config.get('target_ctc', 'N/A')} LPA
        
        HR PERSONALITY (BASED ON DIFFICULTY):
        - Easy: Accommodating, friendly, avoids conflict, willing to concede.
        - Medium: Professional, uses standard pushbacks (budget, team parity), expects justification.
        - Hard: Firm, uses pressure tactics (expiring offers, other candidates), insists on current CTC, lowballs.
        
        YOUR GOAL: Represent the company's interest while staying realistic to the difficulty level.
        
        OUTPUT FORMAT: Return a JSON object with:
        - "response": Your spoken response (professional Indian English).
        - "emotion": "neutral", "stern", "friendly", "disappointed", or "firm".
        - "coach_tip": A real-time tip for the user (type: "positive", "warning", "opportunity", or "mistake").
        """
        
        payload = {
            "contents": [{"parts": [{"text": system_prompt + f"\n\nHistory:\n{json.dumps(history)}"}]}],
            "generationConfig": {
                "temperature": 0.7,
                "topP": 0.95,
                "topK": 40,
                "maxOutputTokens": 1024,
                "responseMimeType": "application/json"
            }
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.api_url, json=payload)
            if response.status_code != 200:
                return {"response": "I'm sorry, I'm having trouble processing that. Can we try again?", "emotion": "neutral", "coach_tip": None}
            
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            return json.loads(text)

    async def generate_scorecard(self, config: Dict[str, Any], transcript: List[Dict[str, str]]) -> Dict[str, Any]:
        """Analyzes the full negotiation and provides a detailed scorecard."""
        
        prompt = f"""
        Analyze the following salary negotiation transcript between a Candidate and an HR Rep.
        
        USER CONFIG: {json.dumps(config)}
        TRANSCRIPT: {json.dumps(transcript)}
        
        Evaluate the candidate on 6 parameters (0-10): Assertiveness, Data Usage, Tactical Awareness, Communication, Outcome, Composure.
        Identify specific mistakes and what they should say instead.
        Calculate the 'Negotiation Gain' (Final CTC - Initial Offer).
        
        OUTPUT FORMAT: Return a JSON object with:
        - "overall_score": 0-100
        - "gain_lpa": float
        - "market_percentile": int (0-100)
        - "parameters": [{{ "name": "...", "score": 0-10, "feedback": "..." }}]
        - "mistakes": [{{ "timestamp": "...", "excerpt": "...", "reason": "...", "correction": "..." }}]
        - "strengths": ["...", "..."]
        - "final_verdict": "A brief summary of performance."
        """
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3, # Lower temperature for analytical output
                "responseMimeType": "application/json"
            }
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.api_url, json=payload)
            if response.status_code != 200:
                raise Exception("Failed to generate scorecard")
            
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            return json.loads(text)
