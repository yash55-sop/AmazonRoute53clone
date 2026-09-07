import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints.health import router as health_router
from app.api.v1.router import router
from app.core.config import settings
from app.db.session import init_database

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    yield


app = FastAPI(title="Route 53 Clone API", version="0.2.0", lifespan=lifespan)
frontend_origin = str(settings.frontend_origin).rstrip("/")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(
        dict.fromkeys(
            [frontend_origin, "http://localhost:3000", "http://127.0.0.1:3000"]
        )
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.include_router(router, prefix="/api/v1")
app.include_router(health_router, include_in_schema=False)
