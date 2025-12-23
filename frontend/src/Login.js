import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

export default function Login({ onLogin }) {
  const [tiendas, setTiendas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [tiendaId, setTiendaId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  // Cargar tiendas
  useEffect(() => {
    fetch(`${API}/tiendas`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) setTiendas(data.tiendas);
      })
      .catch(() => setError("No se pudieron cargar tiendas"));
  }, []);

  // Cargar usuarios cuando cambia tienda
  useEffect(() => {
    if (!tiendaId) {
      setUsuarios([]);
      setUsuarioId("");
      return;
    }

    fetch(`${API}/usuarios?tienda_id=${tiendaId}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        if (data.ok) setUsuarios(data.usuarios);
      })
      .catch(() => {
        setUsuarios([]);
        setError("Error cargando usuarios");
      });
  }, [tiendaId]);

  const handleLogin = () => {
    setError("");

    fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tienda_id: tiendaId,
        usuario_id: usuarioId,
        password,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.ok) {
          setError(data.detail || "Credenciales incorrectas");
          return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        onLogin(data.user);
      })
      .catch(() => setError("Error de conexión con el servidor"));
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto" }}>
      <h2>Inicio de sesión</h2>

      <label>Tienda</label>
      <select value={tiendaId} onChange={e => setTiendaId(e.target.value)}>
        <option value="">Selecciona tienda</option>
        {tiendas.map(t => (
          <option key={t.id} value={t.id}>{t.nombre}</option>
        ))}
      </select>

      <br /><br />

      <label>Usuario</label>
      <select value={usuarioId} onChange={e => setUsuarioId(e.target.value)}>
        <option value="">Selecciona usuario</option>
        {usuarios.map(u => (
          <option key={u.id} value={u.id}>
            {u.nombre} ({u.rol})
          </option>
        ))}
      </select>

      <br /><br />

      <label>Contraseña</label>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <br /><br />

      <button onClick={handleLogin}>Entrar</button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
