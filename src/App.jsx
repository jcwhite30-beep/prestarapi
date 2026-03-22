import React, { useState, useCallback, useRef, useEffect } from "react";

// --- CONSTANTES ---
const LOGO_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAADYCAYAAADFw7V5..."; // Tu base64 aquí

const RC = { superadmin: "#f59e0b", admin: "#D4AF37", gerente: "#60a5fa", promotor: "#4ade80" };

// --- COMPONENTES AUXILIARES ---
const Av = ({ i, size = 34, color = "#D4AF37" }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: "#1a1808", border: "2px solid " + color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color }}>{i}</div>
);

const Toast = ({ d }) => d ? (
  <div style={{ position: "fixed", top: 20, right: 20, background: "#14532d", color: "#fff", padding: "10px 16px", borderRadius: 10, zIndex: 3000 }}>{d.msg}</div>
) : null;

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem("pr_user")) || null);
  const [db, setDb] = useState({ clientes: [], prestamos: [], pagos: [] });
  const [active, setActive] = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(true);
  const [toastData, setToastData] = useState(null);
  const [mWaMasivo, setMWaMasivo] = useState(false);

  // Módulos de navegación
  const modules = {
    dashboard: <div style={{padding:20}}><h2>Dashboard</h2><p>Bienvenido al sistema v10.</p></div>,
    clientes: <div style={{padding:20}}><h2>Clientes</h2></div>,
    prestamos: <div style={{padding:20}}><h2>Préstamos</h2></div>
  };

  // Si no hay usuario, no renderiza la app (evita errores de undefined)
  if (!user) return <div style={{color:"white", padding:40, textAlign:"center"}}>Cargando...</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080808", color: "#e0e0e0", fontFamily: "sans-serif" }}>
      
      {/* Sidebar */}
      <div style={{ width: 210, background: "#0e0e0e", borderRight: "1px solid #1a1a1a", position: "fixed", height: "100vh", left: sideOpen ? 0 : -210, transition: "0.3s", zIndex: 99 }}>
        <div style={{ padding: 20, textAlign: "center" }}>
          <img src={LOGO_SRC} alt="Logo" style={{ width: 140 }} />
        </div>
        <nav style={{ padding: "0 10px" }}>
          <div onClick={() => setActive("dashboard")} style={{ padding: 12, cursor: "pointer", color: active === "dashboard" ? "#D4AF37" : "#888" }}>DASHBOARD</div>
          <div onClick={() => setActive("clientes")} style={{ padding: 12, cursor: "pointer", color: active === "clientes" ? "#D4AF37" : "#888" }}>CLIENTES</div>
          <div onClick={() => setMWaMasivo(true)} style={{ padding: 12, cursor: "pointer", color: "#4ade80", borderTop: "1px solid #222", marginTop: 10 }}>📲 WHATSAPP MASIVO</div>
        </nav>
      </div>

      {/* Contenido Principal */}
      <div style={{ marginLeft: sideOpen ? 210 : 0, flex: 1, display: "flex", flexDirection: "column", transition: "0.3s" }}>
        <header style={{ height: 60, background: "#0e0e0e", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", padding: "0 20px", position: "sticky", top: 0, zIndex: 90 }}>
          <button onClick={() => setSideOpen(!sideOpen)} style={{ background: "none", border: "none", color: "#D4AF37", fontSize: 24, cursor: "pointer" }}>☰</button>
          <div style={{ flex: 1 }} />
          <Av i={user.avatar} color={RC[user.rol]} />
          <button onClick={() => { setUser(null); sessionStorage.removeItem("pr_user"); }} style={{ marginLeft: 15, background: "none", border: "1px solid #333", color: "#888", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>Salir</button>
        </header>

        <main style={{ padding: 20 }}>
          {modules[active] || modules.dashboard}
        </main>
      </div>

      {/* Notificaciones */}
      <Toast d={toastData} />

      {/* MODAL WHATSAPP MASIVO - CORREGIDO: Ahora está DENTRO del return principal */}
      {mWaMasivo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #D4AF37", borderRadius: 12, padding: 25, maxWidth: 500, width: "90%" }}>
            <h3 style={{ color: "#D4AF37", marginTop: 0 }}>WhatsApp Masivo</h3>
            <p style={{ color: "#aaa", fontSize: 13 }}>Se enviará un recordatorio a los clientes con préstamos activos.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => setMWaMasivo(false)} style={{ background: "none", border: "1px solid #333", color: "#888", padding: "8px 15px", borderRadius: 6, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => { alert("Enviando..."); setMWaMasivo(false); }} style={{ background: "#D4AF37", color: "#000", border: "none", padding: "8px 15px", borderRadius: 6, fontWeight: "bold", cursor: "pointer" }}>Iniciar</button>
            </div>
          </div>
        </div>
      )}

      {sideOpen && <div onClick={() => setSideOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 98 }} />}

    </div>
  ); // Cierre del return
} // CIERRE FINAL DE LA FUNCIÓN APP - NO ESCRIBAS NADA DEBAJO DE ESTA LÍNEA