from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.hosted_zones import router as hosted_zones_router
from app.api.v1.endpoints.records import router as records_router

router = APIRouter()
router.include_router(health_router)
router.include_router(auth_router)
router.include_router(hosted_zones_router)
router.include_router(records_router)
