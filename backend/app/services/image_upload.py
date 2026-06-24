import cloudinary
import cloudinary.uploader
from fastapi import UploadFile, HTTPException
from app.core.config import settings

cloudinary.config(
  cloud_name = settings.CLOUDINARY_CLOUD_NAME,
  api_key = settings.CLOUDINARY_API_KEY,
  api_secret = settings.CLOUDINARY_API_SECRET
)

async def upload_image(file: UploadFile, folder: str = None) -> str:
    if not settings.CLOUDINARY_CLOUD_NAME or not settings.CLOUDINARY_API_KEY or not settings.CLOUDINARY_API_SECRET:
        raise HTTPException(status_code=500, detail="Cloudinary is not configured")

    try:

        options = {"folder": folder, "resource_type": "auto"} if folder else {"resource_type": "auto"}
        result = cloudinary.uploader.upload(file.file, **options)
        return result.get("secure_url")
    except Exception as e:
        print(f"Error uploading to Cloudinary: {e}")
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

async def upload_raw_file(file: UploadFile, folder: str = None) -> str:
    if not settings.CLOUDINARY_CLOUD_NAME or not settings.CLOUDINARY_API_KEY or not settings.CLOUDINARY_API_SECRET:
        raise HTTPException(status_code=500, detail="Cloudinary is not configured")

    try:

        options = {"folder": folder, "resource_type": "raw"} if folder else {"resource_type": "raw"}
        result = cloudinary.uploader.upload(file.file, **options)
        return result.get("secure_url")
    except Exception as e:
        print(f"Error uploading raw file to Cloudinary: {e}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")
