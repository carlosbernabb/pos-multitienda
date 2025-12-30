import { useState } from "react";
import Login from "./Login";

function App() {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user"))
  );

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
  };

  // =========================
  // LOGIN
  // =========================
  if (!user) {
    return <Login onLogin={setUser} />;
  }

  // =========================
  // POS PRINCIPAL
  // =========================
  return (
    <div style={{ padding: "20px" }}>
      <h1>POS MultiTienda</h1>

      <p>
        Usuario: <b>{user.nombre}</b> | Rol:{" "}
        <b>{user.rol}</b> | Tienda:{" "}
        <b>{user.tienda_nombre}</b>
      </p>

      <button onClick={handleLogout}>Cerrar sesión</button>

      <hr />

      <h2>Pantalla POS (siguiente paso)</h2>
    </div>
  );
}

export default App;
