import os
from typing import List
from dotenv import load_dotenv

# Load local environment variables from .env
load_dotenv()

def _normalize_database_url() -> str:
    raw = os.getenv("DATABASE_URL", "").strip()
    # Strip surrounding single or double quotes entered in deployment dashboards
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        raw = raw[1:-1].strip()
    if not raw:
        return "sqlite:///./railmarl.db"
    # Normalize legacy postgres:// to postgresql:// if attached on Render
    if raw.startswith("postgres://"):
        return raw.replace("postgres://", "postgresql://", 1)
    return raw

class Settings:
    DATABASE_URL: str = _normalize_database_url()
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
    STATION_NAME: str = os.getenv("STATION_NAME", "Itarsi Junction (ET)")
    STATION_CODE: str = os.getenv("STATION_CODE", "ET")
    API_PREFIX: str = "/api"
    
    # External Railway API Integration (Stage 7 & 9)
    # Supported providers: railradar, rapidapi_irctc, mock_offline
    RAILWAY_API_PROVIDER: str = os.getenv("RAILWAY_API_PROVIDER", "railradar")
    RAILWAY_API_KEY: str = os.getenv("RAILWAY_API_KEY", "")
    RAILWAY_API_HOST: str = os.getenv("RAILWAY_API_HOST", "indian-railway-irctc.p.rapidapi.com")
    RAILWAY_API_BASE_URL: str = os.getenv("RAILWAY_API_BASE_URL", "https://indian-railway-irctc.p.rapidapi.com")
    RAILRADAR_API_KEY: str = os.getenv("RAILRADAR_API_KEY", "")
    RAILRADAR_BASE_URL: str = os.getenv("RAILRADAR_BASE_URL", "https://api.railradar.in/v1")
    RAILWAY_API_TIMEOUT: int = int(os.getenv("RAILWAY_API_TIMEOUT", "10"))
    RAILWAY_API_CACHE_TTL_MINUTES: int = int(os.getenv("RAILWAY_API_CACHE_TTL_MINUTES", "60"))
    RAILWAY_API_ENABLE_OFFLINE_MOCK: bool = os.getenv("RAILWAY_API_ENABLE_OFFLINE_MOCK", "True").lower() in ("true", "1", "yes")

    # Comma-separated or list of allowed CORS origins
    _cors_raw: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://localhost:3000"
    )
    
    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [origin.strip() for origin in self._cors_raw.split(",") if origin.strip()]

settings = Settings()
