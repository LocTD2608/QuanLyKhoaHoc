from fastapi import APIRouter, Depends, HTTPException
from core.schemas import ChatRequest, ChatResponse
from core.dependencies import get_current_user, get_chatbot

router = APIRouter()

@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest, user=Depends(get_current_user)):
    try:
        # Convert Pydantic history items to plain dicts for chatbot engine
        history = [{"role": h.role, "content": h.content} for h in req.history]
        
        # Load user profile data to personalize chat answers
        profile_data = None
        try:
            from routers.profile import get_profile
            profile_data = get_profile(user)
        except Exception:
            pass
        
        result = get_chatbot().get_answer(req.message, history=history, user_profile=profile_data)
        return ChatResponse(
            answer=result.get("answer", ""),
            citations=result.get("citations", []),
        )
    except Exception as e:
        return ChatResponse(
            answer=f"Xin lỗi, trợ lý AI gặp sự cố khi xử lý yêu cầu: {str(e)}",
            citations=[],
        )


@router.get("/health")
async def chat_health():
    return {
        "status": "ok",
        "service": "rag_chatbot",
        "route": "/api/chat",
        "backend_port": 10000,
    }
