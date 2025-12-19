from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from typing import Dict
from app.models.user import User
from app.core.dependencies import get_current_active_user
from app.services.image_upload import upload_image

router = APIRouter()

@router.post("/file", response_model=Dict[str, str])
async def upload_file(
    file: UploadFile = File(...),
    folder: str | None = Form(None),
    current_user: User = Depends(get_current_active_user)
):
    """
    Upload a file (image or video) to Cloudinary. Returns the URL.
    Only authenticated users can upload.
    """
    if not (file.content_type.startswith("image/") or file.content_type.startswith("video/")):
        raise HTTPException(status_code=400, detail="File must be an image or video")
        
    url = await upload_image(file, folder=folder)
    return {"url": url}

