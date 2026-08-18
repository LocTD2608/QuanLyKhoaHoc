import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure the root of backend is in the path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Import routers
from routers.auth import router as auth_router
from routers.stats import router as stats_router
from routers.papers import router as papers_router
from routers.authors import router as authors_router
from routers.venues import router as venues_router
from routers.teams import router as teams_router
from routers.profile import router as profile_router
from routers.journals import router as journals_router
from routers.chat import router as chat_router
from routers.validation import router as validation_router

app = FastAPI(title="Hệ thống Quản lý Khoa học AI API", version="2.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def add_headers(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Scientific Management AI API v2"}

# Register routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(stats_router, prefix="/api/stats", tags=["stats"])
app.include_router(papers_router, prefix="/api/papers", tags=["papers"])
app.include_router(authors_router, prefix="/api/authors", tags=["authors"])
app.include_router(venues_router, prefix="/api/venues", tags=["venues"])
app.include_router(teams_router, prefix="/api/teams", tags=["teams"])
app.include_router(profile_router, prefix="/api/profile", tags=["profile"])
app.include_router(journals_router, prefix="/api/journals", tags=["journals"])
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(validation_router, prefix="/api", tags=["validation"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)
