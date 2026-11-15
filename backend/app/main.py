from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings
from .database import engine, SessionLocal, Base
from .seed import seed_database
from .routers import (
    health_router,
    dashboard_router,
    platforms_router,
    trains_router,
    allocations_router,
    ml_router,
    railway_api_router,
    traffic_router,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite tables on startup
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield
    # Cleanup actions on shutdown (if any)

app = FastAPI(
    title="RAILMARL API",
    description="Backend API for RAILMARL — Itarsi Junction Platform Management System",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if "*" not in settings.CORS_ORIGINS else ["*"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.vercel\.app$|^https://.*\.onrender\.com$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Error Handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "status_code": exc.status_code,
            "message": exc.detail,
            "path": request.url.path,
        },
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "status_code": 500,
            "message": "Internal server error occurred.",
            "path": request.url.path,
        },
    )

# Include Routers under /api
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(dashboard_router, prefix=settings.API_PREFIX)
app.include_router(platforms_router, prefix=settings.API_PREFIX)
app.include_router(trains_router, prefix=settings.API_PREFIX)
app.include_router(allocations_router, prefix=settings.API_PREFIX)
app.include_router(ml_router, prefix=settings.API_PREFIX)
app.include_router(railway_api_router, prefix=settings.API_PREFIX)
app.include_router(traffic_router, prefix=settings.API_PREFIX)

@app.get("/", tags=["Root"])
def root_endpoint():
    return {
        "service": "RAILMARL API",
        "station": settings.STATION_NAME,
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health",
        "version": "1.0.0",
    }

