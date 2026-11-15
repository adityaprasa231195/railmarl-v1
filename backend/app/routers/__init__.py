from .health import router as health_router
from .dashboard import router as dashboard_router
from .platforms import router as platforms_router
from .trains import router as trains_router
from .allocations import router as allocations_router
from .ml import router as ml_router
from .railway_api import router as railway_api_router
from .traffic import router as traffic_router

__all__ = [
    "health_router",
    "dashboard_router",
    "platforms_router",
    "trains_router",
    "allocations_router",
    "ml_router",
    "railway_api_router",
    "traffic_router",
]
