from typing import Optional, Dict, Any
from uuid import UUID

from fastapi import FastAPI, Query, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text

from database import engine
from security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
)

# =========================
# APP
# =========================
app = FastAPI(title="POS MultiTienda")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# MODELS
# =========================
class LoginRequest(BaseModel):
    tienda_id: UUID
    usuario_id: UUID
    password: Optional[str] = None


class CreateUserRequest(BaseModel):
    tienda_id: UUID
    nombre: str
    email: Optional[str] = None
    rol: str = "normal"


class AdminSetPasswordRequest(BaseModel):
    usuario_id: UUID
    new_password: str


# =========================
# HELPERS
# =========================
def require_user(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")

    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido")

    return payload


def require_admin(authorization: Optional[str]) -> Dict[str, Any]:
    payload = require_user(authorization)
    if payload.get("rol") != "admin":
        raise HTTPException(status_code=403, detail="Solo admin")
    return payload


# =========================
# HEALTH
# =========================
@app.get("/health")
def health():
    return {"ok": True}


# =========================
# TIENDAS
# =========================
@app.get("/tiendas")
def get_tiendas():
    q = text("""
        SELECT id, nombre
        FROM tiendas
        WHERE activa = true
        ORDER BY nombre
    """)
    with engine.connect() as conn:
        rows = conn.execute(q).mappings().all()
    return {"ok": True, "tiendas": rows}


# =========================
# USUARIOS POR TIENDA
# =========================
@app.get("/usuarios")
def get_usuarios(tienda_id: UUID = Query(...)):
    q = text("""
        SELECT id, nombre, rol
        FROM usuarios
        WHERE tienda_id = :tienda_id
          AND activo = true
        ORDER BY nombre
    """)
    with engine.connect() as conn:
        rows = conn.execute(q, {"tienda_id": str(tienda_id)}).mappings().all()

    return {"ok": True, "usuarios": rows}


# =========================
# LOGIN
# =========================
@app.post("/auth/login")
def login(body: LoginRequest):
    q = text("""
        SELECT
            id,
            nombre,
            rol,
            tienda_id,
            password_hash,
            activo
        FROM usuarios
        WHERE id = :usuario_id
          AND tienda_id = :tienda_id
        LIMIT 1
    """)

    with engine.connect() as conn:
        user = conn.execute(
            q,
            {
                "usuario_id": str(body.usuario_id),
                "tienda_id": str(body.tienda_id),
            }
        ).mappings().first()

    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    if not user["activo"]:
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    if not user["password_hash"]:
        raise HTTPException(
            status_code=403,
            detail="Usuario sin contraseña. Contacta al administrador."
        )

    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    # 🔥 AQUÍ ESTÁ LA CLAVE: UUID → str
    token = create_access_token({
        "user_id": str(user["id"]),
        "nombre": user["nombre"],
        "rol": user["rol"],
        "tienda_id": str(user["tienda_id"]),
    })

    return {
        "ok": True,
        "token": token,
        "user": {
            "id": str(user["id"]),
            "nombre": user["nombre"],
            "rol": user["rol"],
            "tienda_id": str(user["tienda_id"]),
        }
    }



# =========================
# ADMIN: CREAR USUARIO
# =========================
@app.post("/admin/create-user")
def create_user(body: CreateUserRequest, authorization: Optional[str] = Header(None)):
    require_admin(authorization)

    q = text("""
        INSERT INTO usuarios (id, tienda_id, nombre, email, rol, activo)
        VALUES (gen_random_uuid(), :tienda_id, :nombre, :email, :rol, true)
        RETURNING id
    """)

    with engine.begin() as conn:
        row = conn.execute(q, body.dict()).mappings().first()

    return {"ok": True, "usuario_id": row["id"]}


# =========================
# ADMIN: ASIGNAR PASSWORD
# =========================
@app.post("/admin/set-password")
def admin_set_password(body: AdminSetPasswordRequest, authorization: Optional[str] = Header(None)):
    require_admin(authorization)

    password_hash = hash_password(body.new_password)

    q = text("""
        UPDATE usuarios
        SET password_hash = :ph
        WHERE id = :id
    """)

    with engine.begin() as conn:
        conn.execute(q, {"ph": password_hash, "id": str(body.usuario_id)})

    return {"ok": True}
