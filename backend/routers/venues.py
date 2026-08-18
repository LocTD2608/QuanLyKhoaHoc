from fastapi import APIRouter, Depends
from core.dependencies import get_current_user
from core.schemas import VenueCreate
from core.exceptions import NotFoundException
from repositories import venue_repo

router = APIRouter()

@router.get("")
def list_venues(user=Depends(get_current_user)):
    return venue_repo.get_all()

@router.post("", status_code=201)
def create_venue(req: VenueCreate, user=Depends(get_current_user)):
    return venue_repo.create(req.dict())

@router.put("/{venue_id}")
def update_venue(venue_id: int, req: VenueCreate, user=Depends(get_current_user)):
    updated = venue_repo.update(venue_id, req.dict())
    if not updated:
        raise NotFoundException("Không tìm thấy venue")
    return updated

@router.delete("/{venue_id}", status_code=204)
def delete_venue(venue_id: int, user=Depends(get_current_user)):
    if not venue_repo.delete(venue_id):
        raise NotFoundException("Không tìm thấy venue để xóa")
