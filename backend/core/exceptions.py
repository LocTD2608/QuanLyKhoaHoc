"""
core/exceptions.py — Custom Exceptions & Error Handlers
"""

from fastapi import HTTPException, status

class NotFoundException(HTTPException):
    def __init__(self, detail: str = "Tài nguyên không tìm thấy"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

class UnauthorizedException(HTTPException):
    def __init__(self, detail: str = "Không có quyền truy cập hoặc token không hợp lệ"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

class BadRequestException(HTTPException):
    def __init__(self, detail: str = "Yêu cầu không hợp lệ"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
