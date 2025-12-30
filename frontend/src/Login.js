import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";
const MASTER_KEY = "CasadeAjo10";

function stringifyFastApiDetail(detail) {
  if (!detail) return "Ocurrió un error";
  if (typeof detail === "string") return detail;
  try {
    // FastAPI validation errors suelen venir como array de objetos
    return JSON.stringify(detail);
  } catch {
    return "Ocurrió un error";
  }
}

export default function Login({ onLogin }) {
  const [tiendas, setTiendas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [tiendaId, setTiendaId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  // Crear usuario (UI)
  const [showCreate, setShowCreate] = useState(false);
  const [createNombre, setCreateNombre] = useState("");
  const [createRol, setCreateRol] = useState("normal");
  const [createPass, setCreatePass] = useState("");
  const [createPass2, setCreatePass2] = useState("");
  const [createMsg, setCreateMsg] = useState("");

  // Cargar tiendas
  useEffect(() => {
    fetch(`${API}/tiendas`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setTiendas(data.tiendas);
      })
      .catch(() => setError("No se pudieron cargar tiendas"));
  }, []);

  const cargarUsuarios = (tid) => {
    if (!tid) {
      setUsuarios([]);
      setUsuarioId("");
      return;
    }

    fetch(`${API}/usuarios?tienda_id=${tid}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (data.ok) setUsuarios(data.usuarios);
      })
      .catch(() => {
        setUsuarios([]);
        setError("Error cargando usuarios");
      });
  };

  // Cargar usuarios cuando cambia tienda
  useEffect(() => {
    setError("");
    cargarUsuarios(tiendaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendaId]);

  const handleLogin = () => {
    setError("");

    if (!tiendaId) return setError("Selecciona una tienda");
    if (!usuarioId) return setError("Selecciona un usuario");
    if (!password) return setError("Escribe la contraseña");

    fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tienda_id: tiendaId,
        usuario_id: usuarioId,
        password,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.detail || "Credenciales incorrectas");
          return;
        }

        const tienda = tiendas.find(t => t.id === tiendaId);

      const userWithStore = {
        ...data.user,
        tienda_nombre: tienda ? tienda.nombre : "Desconocida"
      };

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(userWithStore));

      onLogin(userWithStore);
      })
      .catch(() => setError("Error de conexión con el servidor"));
  };

  const pedirClaveMaestra = () => {
    setCreateMsg("");
    if (!tiendaId) {
      setError("Selecciona una tienda antes de crear usuario");
      return;
    }

    const key = window.prompt("Ingresa la clave para crear usuarios:");
    if (key === null) return; // canceló
    if (key !== MASTER_KEY) {
      setCreateMsg("Clave incorrecta");
      setShowCreate(false);
      return;
    }

    // Clave correcta
    setShowCreate(true);
    setCreateMsg("");
  };

  const crearUsuario = () => {
    setCreateMsg("");
    setError("");

    if (!tiendaId) return setCreateMsg("Selecciona tienda primero");
    if (!createNombre.trim()) return setCreateMsg("Escribe el nombre");
    if (!createPass) return setCreateMsg("Escribe la contraseña");
    if (createPass !== createPass2) return setCreateMsg("Las contraseñas no coinciden");

    fetch(`${API}/bootstrap/create-user?master_key=${encodeURIComponent(MASTER_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tienda_id: tiendaId,
        nombre: createNombre.trim(),
        rol: createRol,
        password: createPass,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          setCreateMsg(stringifyFastApiDetail(data.detail));
          return;
        }

        setCreateMsg("✅ Usuario creado");
        setCreateNombre("");
        setCreateRol("normal");
        setCreatePass("");
        setCreatePass2("");

        // refrescar dropdown
        cargarUsuarios(tiendaId);
      })
      .catch(() => setCreateMsg("Error de conexión con el servidor"));
  };

  return (
    <div style={{ maxWidth: 520, margin: "80px auto", fontFamily: "Arial" }}>
      <h2 style={{ textAlign: "center" }}>Inicio de sesión</h2>

      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "center" }}>
        <label>Tienda</label>
        <select value={tiendaId} onChange={(e) => setTiendaId(e.target.value)}>
          <option value="">Selecciona tienda</option>
          {tiendas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>

        <label>Usuario</label>
        <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
          <option value="">Selecciona usuario</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} ({u.rol})
            </option>
          ))}
        </select>

        <label>Contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <div />
        <button onClick={handleLogin} style={{ width: 120 }}>
          Entrar
        </button>
      </div>

      {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}

      <hr style={{ margin: "22px 0" }} />

      <button onClick={pedirClaveMaestra} style={{ width: 140 }}>
        Crear usuario
      </button>

      {showCreate && (
        <div style={{ marginTop: 18 }}>
          <h3>Nuevo usuario</h3>

          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, alignItems: "center" }}>
            <label>Nombre</label>
            <input value={createNombre} onChange={(e) => setCreateNombre(e.target.value)} />

            <label>Rol</label>
            <select value={createRol} onChange={(e) => setCreateRol(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="administración">Administración</option>
            </select>

            <label>Contraseña</label>
            <input type="password" value={createPass} onChange={(e) => setCreatePass(e.target.value)} />

            <label>Confirmar</label>
            <input type="password" value={createPass2} onChange={(e) => setCreatePass2(e.target.value)} />

            <div />
            <button onClick={crearUsuario} style={{ width: 140 }}>
              Guardar usuario
            </button>
          </div>

          {createMsg && (
            <p style={{ color: createMsg.startsWith("✅") ? "green" : "red", marginTop: 12 }}>
              {createMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
