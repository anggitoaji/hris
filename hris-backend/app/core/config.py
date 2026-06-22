from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Konfigurasi aplikasi, dibaca dari environment / file .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Solusi Group HRIS API"
    APP_VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"

    # Default: SQLite (langsung jalan di laptop, tanpa install PostgreSQL).
    # Untuk produksi, ganti jadi:
    # postgresql+psycopg://user:password@localhost:5432/hris
    DATABASE_URL: str = "sqlite:///./hris.db"

    # Kunci rahasia untuk menandatangani token login.
    # WAJIB diganti di produksi/cloud lewat environment variable SECRET_KEY
    # (mis. string acak panjang). Jangan pakai default ini di internet.
    SECRET_KEY: str = "dev-secret-CHANGE-ME-before-cloud"
    # Masa berlaku token login (jam).
    TOKEN_HOURS: int = 12

    # Origin frontend yang diizinkan (pisah dengan koma untuk banyak origin).
    # 3000 = Next.js, 5173 = Vite/React (dashboard). 127.0.0.1 ikut diizinkan
    # karena sebagian browser memakai itu, bukan localhost.
    # URL Ollama lokal. Ganti di .env saat produksi jika Ollama di server lain.
    # Contoh produksi: OLLAMA_BASE_URL=http://192.168.1.100:11434
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    CORS_ORIGINS: str = (
        "http://localhost:3000,"
        "http://localhost:5173,"
        "http://127.0.0.1:5173"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
