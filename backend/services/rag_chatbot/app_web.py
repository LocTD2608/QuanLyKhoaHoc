import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import os
from pathlib import Path

# Import chatbot engine
from chatbot_engine import RAGChatbot

# Get the absolute path of the current directory
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Scientific Management AI Assistant")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Chatbot
chatbot = RAGChatbot()

# Ensure static directory exists
os.makedirs(STATIC_DIR, exist_ok=True)

# Mount static files directory using absolute path
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    answer: str
    citations: List[Dict[str, Any]]

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        logger.info(f"Received message: {request.message}")
        result = chatbot.get_answer(request.message)
        return ChatResponse(
            answer=result["answer"],
            citations=result["citations"]
        )
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Serve frontend index.html using absolute path
@app.get("/")
async def read_index():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        logger.error(f"Index file not found at: {index_path}")
        return {"error": "Frontend files missing"}
    return FileResponse(str(index_path))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10002)
