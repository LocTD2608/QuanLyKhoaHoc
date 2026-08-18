from fastapi import APIRouter
from core.schemas import LoginRequest
from core.exceptions import UnauthorizedException
from repositories import user_repo, author_repo

router = APIRouter()

@router.post("/login")
def login(req: LoginRequest):
    user = user_repo.verify_credentials(req.username, req.password)
    if not user:
        raise UnauthorizedException("Sai tên đăng nhập hoặc mật khẩu")
    author = author_repo.get_by_id(user.get("author_id")) if user.get("author_id") else None
    return {
        "token": user["username"],
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "author": author
        }
    }
