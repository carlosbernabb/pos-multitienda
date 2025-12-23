import { useState } from "react";
import Login from "./Login";

function App() {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user"))
  );

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div style={{ padding: 30 }}>
      <h1>POS MultiTienda</h1>

      <p>
        Usuario: <b>{user.nombre}</b> | Rol: <b>{user.rol}</b>
      </p>

      <button onClick={() => {
        localStorage.clear();
        setUser(null);
      }}>
        Cerrar sesión
      </button>

      <hr />

      <h2>Pantalla POS (siguiente paso)</h2>
    </div>
  );
}

export default App;
