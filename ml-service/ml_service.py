from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline
from typing import Dict, List
import torch
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LegalLink AI Legal Analyzer")

# Enable CORS for your Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# LEGAL CATEGORIES FOR PAKISTAN
# ============================================
LEGAL_CATEGORIES = [
    "domestic violence against women",
    "husband beating wife",
    "property dispute and land issues",
    "divorce and khula proceedings",
    "child custody and visitation rights",
    "criminal case and police matter",
    "fraud and financial cheating",
    "harassment at workplace",
    "civil dispute and contract issues",
    "inheritance and will distribution",
    "service and employment matter",
    "rent agreement and eviction"
]

# Category-specific recommendations
CATEGORY_RECOMMENDATIONS = {
    "domestic violence against women": {
        "severity": "High",
        "summary": "This is a serious domestic violence case requiring immediate legal protection.",
        "recommendations": [
            "Emergency protection order",
            "Legal counseling and support",
            "Police complaint (FIR)",
            "Court proceedings",
            "Safe shelter if needed"
        ],
        "ngoMessage": "I strongly recommend our NGO partners who specialize in women's rights and can provide free legal aid and shelter if needed.",
        "lawyerSpecialization": "Human Rights / Family Law",
        "requiresUrgent": True
    },
    "husband beating wife": {
        "severity": "High",
        "summary": "This is a case of marital abuse requiring immediate legal protection.",
        "recommendations": [
            "Protection order under domestic violence law",
            "Legal counseling",
            "Police complaint",
            "Medical examination"
        ],
        "ngoMessage": "Women's rights NGOs can provide free legal aid, counseling, and shelter.",
        "lawyerSpecialization": "Family Law / Human Rights",
        "requiresUrgent": True
    },
    "property dispute and land issues": {
        "severity": "Medium",
        "summary": "This appears to be a property dispute case requiring legal documentation.",
        "recommendations": [
            "Document verification",
            "Legal notice to opposite party",
            "Title suit filing",
            "Alternative dispute resolution"
        ],
        "ngoMessage": "Legal aid NGOs can help with documentation and legal advice for property disputes.",
        "lawyerSpecialization": "Property Law",
        "requiresUrgent": False
    },
    "divorce and khula proceedings": {
        "severity": "Medium",
        "summary": "This is a family law matter involving divorce or separation.",
        "recommendations": [
            "Legal consultation",
            "Mediation services",
            "Court filing if needed",
            "Maintenance/alimony claim"
        ],
        "ngoMessage": "Family law NGOs can provide counseling and legal aid for divorce cases.",
        "lawyerSpecialization": "Family Law",
        "requiresUrgent": False
    },
    "child custody and visitation rights": {
        "severity": "High",
        "summary": "This involves child custody which requires careful legal handling.",
        "recommendations": [
            "Legal consultation",
            "Guardianship filing",
            "Visitation rights agreement",
            "Child welfare assessment"
        ],
        "ngoMessage": "Child protection NGOs can assist with custody matters.",
        "lawyerSpecialization": "Family Law",
        "requiresUrgent": False
    },
    "criminal case and police matter": {
        "severity": "High",
        "summary": "This is a criminal matter requiring immediate legal representation.",
        "recommendations": [
            "Legal representation",
            "Bail application",
            "Case documentation",
            "Court appearance"
        ],
        "ngoMessage": "Legal aid NGOs can assist with pro-bono criminal defense lawyers.",
        "lawyerSpecialization": "Criminal Law",
        "requiresUrgent": True
    }
}

# Default recommendations
DEFAULT_RECOMMENDATIONS = {
    "severity": "Low",
    "summary": "Thank you for sharing your concern. A legal expert can better assist you.",
    "recommendations": [
        "Consult with a lawyer",
        "Gather all relevant documents",
        "Visit your local legal aid center"
    ],
    "ngoMessage": "You can browse our verified lawyers or contact legal aid NGOs.",
    "lawyerSpecialization": "General Legal",
    "requiresUrgent": False
}

# ============================================
# LOAD AI MODEL (loads once at startup)
# ============================================
logger.info("Loading AI model... This may take 30-60 seconds on first run")
try:
    classifier = pipeline(
        "zero-shot-classification",
        model="facebook/bart-large-mnli",
        device=-1  # Use -1 for CPU, 0 for GPU if available
    )
    logger.info("✅ AI Model loaded successfully!")
except Exception as e:
    logger.error(f"❌ Failed to load model: {e}")
    classifier = None

# ============================================
# API MODELS
# ============================================
class AnalyzeRequest(BaseModel):
    text: str

class AnalyzeResponse(BaseModel):
    category: str
    confidence: float
    severity: str
    summary: str
    recommendations: List[str]
    ngoMessage: str
    lawyerSpecialization: str
    requiresUrgent: bool
    all_scores: Dict[str, float] = None

# ============================================
# API ENDPOINTS
# ============================================
@app.get("/")
def root():
    return {"message": "LegalLink AI Legal Analyzer API", "status": "running"}

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": classifier is not None}

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_legal_issue(request: AnalyzeRequest):
    if not classifier:
        raise HTTPException(status_code=503, detail="AI model not loaded")
    
    if not request.text or len(request.text.strip()) < 5:
        raise HTTPException(status_code=400, detail="Text too short. Please provide more details.")
    
    logger.info(f"Analyzing: {request.text[:100]}...")
    
    # Run classification
    result = classifier(request.text, LEGAL_CATEGORIES)
    
    # Get top category
    top_category = result['labels'][0]
    confidence = result['scores'][0]
    
    # Get recommendations for this category
    recommendations_data = CATEGORY_RECOMMENDATIONS.get(top_category, DEFAULT_RECOMMENDATIONS)
    
    response = AnalyzeResponse(
        category=top_category,
        confidence=round(confidence, 3),
        severity=recommendations_data["severity"],
        summary=recommendations_data["summary"],
        recommendations=recommendations_data["recommendations"],
        ngoMessage=recommendations_data["ngoMessage"],
        lawyerSpecialization=recommendations_data["lawyerSpecialization"],
        requiresUrgent=recommendations_data["requiresUrgent"],
        all_scores={k: round(v, 3) for k, v in zip(result['labels'], result['scores'])}
    )
    
    logger.info(f"✅ Categorized as: {top_category} (confidence: {confidence})")
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)