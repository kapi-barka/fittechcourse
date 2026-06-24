from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from typing import Dict
from app.models.user import User
from app.core.dependencies import get_current_active_user
from app.services.image_upload import upload_image, upload_raw_file

router = APIRouter()

@router.post("/file", response_model=Dict[str, str])
async def upload_file(
    file: UploadFile = File(...),
    folder: str | None = Form(None),
    current_user: User = Depends(get_current_active_user)
):

    if file.content_type and (file.content_type.startswith("image/") or file.content_type.startswith("video/")):

        url = await upload_image(file, folder=folder)
    elif file.content_type and (file.content_type == "text/html" or file.filename and file.filename.endswith('.html')):

        url = await upload_raw_file(file, folder=folder)
    else:

        url = await upload_raw_file(file, folder=folder)

    return {"url": url}
