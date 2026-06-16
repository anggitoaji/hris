"""Modul Login & Hak Akses (mandiri dalam satu file).

Tanpa library tambahan - memakai pustaka bawaan Python:
- Hash password: PBKDF2-SHA256 (hashlib).
- Token login: token bertanda-tangan HMAC-SHA256 (mirip JWT HS256).

Berisi: tabel `users`, util token & password, skema, dependency
otentikasi/role (get_current_user, require_roles), router (login, me,
ganti password, kelola user), dan pembuatan akun Super Admin awal.

Catatan keamanan: SECRET_KEY untuk menandatangani token diambil dari
settings (environment). WAJIB diganti sebelum naik ke cloud.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.config import settings
from app.core.database import Base, SessionLocal, get_db
from app.models.employee import Employee


ROLES = ["Super Admin", "Direksi", "HR", "Manager", "Supervisor", "Finance", "NOC", "Karyawan"]


# ===================== Model =====================
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(16), default="Karyawan")
    employee_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("employees.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ===================== Util: password =====================
def hash_password(pw: str) -> str:
    salt = secrets.token_bytes(16)
    iters = 200_000
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, iters)
    return f"pbkdf2_sha256${iters}${salt.hex()}${dk.hex()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        algo, iters_s, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt_hex), int(iters_s))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


# ===================== Util: token (HMAC, mirip JWT HS256) =====================
def _b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(body: str) -> str:
    return _b64e(hmac.new(settings.SECRET_KEY.encode(), body.encode(), hashlib.sha256).digest())


def create_token(user_id: int, role: str, hours: int | None = None) -> str:
    hours = hours if hours is not None else settings.TOKEN_HOURS
    payload = {"uid": user_id, "role": role, "exp": int(time.time()) + hours * 3600}
    body = _b64e(json.dumps(payload, separators=(",", ":")).encode())
    return f"{body}.{_sign(body)}"


def verify_token(token: str) -> dict | None:
    try:
        body, sig = token.split(".")
        if not hmac.compare_digest(sig, _sign(body)):
            return None
        payload = json.loads(_b64d(body))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


# ===================== Dependency: otentikasi & role =====================
def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Belum login (token tidak ada).")
    payload = verify_token(authorization.split(" ", 1)[1].strip())
    if not payload:
        raise HTTPException(status_code=401, detail="Sesi tidak valid atau sudah kedaluwarsa. Silakan login ulang.")
    user = db.get(User, int(payload["uid"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Akun tidak ditemukan atau non-aktif.")
    return user


def get_current_user_from_token(token: str, db: Session = Depends(get_db)) -> User:
    """Verifikasi token string langsung (untuk query param)."""
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token tidak valid.")
    user = db.get(User, int(payload["uid"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Akun tidak ditemukan.")
    return user


def require_roles(*roles: str):
    """Dependency: izinkan hanya role tertentu (Super Admin selalu boleh)."""
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role != "Super Admin" and user.role not in roles:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke fitur ini.")
        return user
    return dep


# ===================== Skema =====================
class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    role: str
    employee_id: int | None = None
    employee_nama: str | None = None
    is_active: bool = True


class TokenOut(BaseModel):
    token: str
    user: UserOut


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = "Karyawan"
    employee_id: int | None = None


class UserUpdate(BaseModel):
    role: str | None = None
    employee_id: int | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)  # reset password


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6, max_length=128)


def _nama(db: Session, employee_id: int | None) -> str | None:
    if not employee_id:
        return None
    e = db.get(Employee, employee_id)
    return e.nama if e else None


def _user_out(db: Session, u: User) -> UserOut:
    o = UserOut.model_validate(u)
    o.employee_nama = _nama(db, u.employee_id)
    return o


def _validate_role(r: str) -> str:
    if r not in ROLES:
        raise HTTPException(status_code=422, detail=f"Role tidak valid. Pilihan: {', '.join(ROLES)}.")
    return r


# ===================== Router =====================
router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/roles", response_model=list[str])
def list_roles():
    return ROLES


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Username atau password salah.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Akun ini non-aktif. Hubungi admin.")
    token = create_token(user.id, user.role)
    return TokenOut(token=token, user=_user_out(db, user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_out(db, user)


@router.post("/change-password")
def change_password(payload: ChangePasswordIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Password lama salah.")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}


# ---- Kelola user (khusus Super Admin) ----
@router.get("/users", response_model=list[UserOut])
def list_users(_: User = Depends(require_roles()), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id).all()
    return [_user_out(db, u) for u in users]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, _: User = Depends(require_roles()), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == payload.username.strip()).first():
        raise HTTPException(status_code=409, detail="Username sudah dipakai.")
    u = User(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
        role=_validate_role(payload.role),
        employee_id=payload.employee_id,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return _user_out(db, u)


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, actor: User = Depends(require_roles()), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")
    data = payload.model_dump(exclude_unset=True)
    if "role" in data and data["role"] is not None:
        # Cegah Super Admin terakhir menurunkan dirinya sendiri tanpa sengaja.
        if u.id == actor.id and u.role == "Super Admin" and data["role"] != "Super Admin":
            others = db.query(User).filter(User.role == "Super Admin", User.id != u.id, User.is_active.is_(True)).count()
            if others == 0:
                raise HTTPException(status_code=400, detail="Tidak bisa menurunkan satu-satunya Super Admin.")
        u.role = _validate_role(data["role"])
    if "employee_id" in data:
        u.employee_id = data["employee_id"]
    if "is_active" in data and data["is_active"] is not None:
        if u.id == actor.id and data["is_active"] is False:
            raise HTTPException(status_code=400, detail="Tidak bisa menonaktifkan akun sendiri.")
        u.is_active = bool(data["is_active"])
    if data.get("password"):
        u.password_hash = hash_password(data["password"])
    db.commit()
    db.refresh(u)
    return _user_out(db, u)


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(user_id: int, actor: User = Depends(require_roles()), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")
    if u.id == actor.id:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun sendiri.")
    db.delete(u)
    db.commit()
    return {"ok": True, "id": user_id}


# ===================== Seed akun admin awal =====================
def ensure_default_admin() -> None:
    """Buat Super Admin awal jika tabel users masih kosong."""
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add(User(
                username="admin",
                password_hash=hash_password("admin123"),
                role="Super Admin",
                is_active=True,
            ))
            db.commit()
            print(">> Akun awal dibuat: username 'admin' / password 'admin123' (GANTI segera!)")
    finally:
        db.close()
