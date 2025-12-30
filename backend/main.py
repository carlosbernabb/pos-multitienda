from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text

from database import engine
from security import hash_password, verify_password, create_access_token

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
# UTILIDADES SQL
# =========================
def qident(colname: str) -> str:
    import re
    if re.match(r"^[a-z_][a-z0-9_]*$", colname):
        return colname
    colname = colname.replace('"', '""')
    return f'"{colname}"'

def detect_usuario_pk_column(conn) -> str:
    r = conn.execute(
        text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name='usuarios'
        """)
    ).fetchall()

    cols = [x[0] for x in r]
    for c in ["id", "identificación", "identificacion", "identificador"]:
        if c in cols:
            return c

    r2 = conn.execute(
        text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema='public'
              AND table_name='usuarios'
              AND data_type='uuid'
            LIMIT 1
        """)
    ).fetchone()

    if not r2:
        raise RuntimeError("No se pudo detectar PK de usuarios")
    return r2[0]

def column_exists(conn, table: str, col: str) -> bool:
    r = conn.execute(
        text("""
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema='public'
              AND table_name=:t
              AND column_name=:c
            LIMIT 1
        """),
        {"t": table, "c": col},
    ).fetchone()
    return r is not None

def pick_first_existing_column(conn, table: str, candidates: list[str]) -> str | None:
    for c in candidates:
        if column_exists(conn, table, c):
            return c
    return None

# =========================
# MODELOS
# =========================
class LoginBody(BaseModel):
    tienda_id: str
    usuario_id: str
    password: str

class CreateUserBody(BaseModel):
    nombre: str
    rol: str
    password: str

# =========================
# ENDPOINTS
# =========================
@app.get("/health")
def health():
    return {"ok": True}

@app.get("/tiendas")
def get_tiendas():
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, nombre FROM tiendas ORDER BY nombre")
        ).mappings().all()
    return {"ok": True, "tiendas": rows}

@app.get("/usuarios")
def get_usuarios(tienda_id: str = Query(...)):
    with engine.connect() as conn:
        pk = detect_usuario_pk_column(conn)
        pk_sql = qident(pk)

        rows = conn.execute(
            text(f"""
                SELECT {pk_sql}::text AS id, nombre, rol
                FROM usuarios
                WHERE activo = true
                ORDER BY nombre
            """)
        ).mappings().all()

    return {"ok": True, "usuarios": rows}

@app.post("/auth/login")
def login(body: LoginBody):
    with engine.connect() as conn:
        pk = detect_usuario_pk_column(conn)
        pk_sql = qident(pk)

        hash_col = pick_first_existing_column(
            conn,
            "usuarios",
            ["password_hash", "hash_contrasena", "hash_de_contrasena"]
        )
        if not hash_col:
            raise HTTPException(status_code=500, detail="No existe password_hash")

        hash_sql = qident(hash_col)

        user = conn.execute(
            text(f"""
                SELECT {pk_sql}::text AS id, nombre, rol, {hash_sql} AS password_hash
                FROM usuarios
                WHERE {pk_sql}::text = :uid
                  AND activo = true
                LIMIT 1
            """),
            {"uid": body.usuario_id},
        ).mappings().first()

        if not user:
            return {"ok": False, "detail": "Usuario no encontrado"}

        if not verify_password(body.password, user["password_hash"]):
            return {"ok": False, "detail": "Contraseña incorrecta"}

        token = create_access_token({
            "sub": user["id"],
            "rol": user["rol"],
            "tienda_id": body.tienda_id
        })

        return {
            "ok": True,
            "token": token,
            "user": {
                "id": user["id"],
                "nombre": user["nombre"],
                "rol": user["rol"],
                "tienda_id": body.tienda_id
            }
        }

# =========================
# CREAR USUARIO (SIN TIENDA)
# =========================
MASTER_KEY = "CasadeAjo10"

@app.post("/bootstrap/create-user")
def bootstrap_create_user(body: CreateUserBody, master_key: str = Query(...)):
    if master_key != MASTER_KEY:
        raise HTTPException(status_code=401, detail="Clave incorrecta")

    if len(body.password) < 4:
        raise HTTPException(status_code=422, detail="Contraseña muy corta")

    rol_norm = body.rol.strip().lower()
    if rol_norm not in {"normal", "admin", "administración", "administracion"}:
        raise HTTPException(status_code=422, detail="Rol inválido")

    rol_final = "admin" if rol_norm.startswith("admin") else "normal"
    hashed = hash_password(body.password)

    with engine.begin() as conn:
        hash_col = pick_first_existing_column(
            conn,
            "usuarios",
            ["password_hash", "hash_contrasena", "hash_de_contrasena"]
        )
        if not hash_col:
            raise HTTPException(status_code=500, detail="No existe password_hash")

        hash_sql = qident(hash_col)

        # 🔒 Email técnico automático (cumple NOT NULL)
        email_value = f"{body.nombre.lower().replace(' ', '')}@local.pos"

        user = conn.execute(
            text(f"""
                INSERT INTO usuarios (nombre, rol, activo, {hash_sql}, email)
                VALUES (:nombre, :rol, true, :hash, :email)
                RETURNING id::text AS id, nombre, rol
            """),
            {
                "nombre": body.nombre.strip(),
                "rol": rol_final,
                "hash": hashed,
                "email": email_value,
            }
        ).mappings().first()

    return {"ok": True, "user": user}
