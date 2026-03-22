import React, { useState, useCallback, useRef, useEffect } from "react";

// --- CONSTANTES Y UTILIDADES ---
const LOGO_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAADYCAYAAADFw7V5... (resto del base64)";

const fmt = (n, m = "USD") => new Intl.NumberFormat("es-PA", { style: "currency", currency: m }).format(n || 0);
const fmtP = (n) => ((n * 100).toFixed(1) + "%");
const fmtF = (f) => f ? new Date(f + "T12:00:00").toLocaleDateString("es-PA") : "—";

const RC = { superadmin: "#f59e0b", admin: "#D4AF37", gerente: "#60a5fa", promotor: "#4ade80" };

// --- COMPONENTES ÁTOMOS ---
const Badge = ({ e }) => {
  const M = { activo: { bg: "#1a3a1a", c: "#4ade80", b: "#22543d" }, en_mora: { bg: "#3a0a0a", c: "#f87171", b: "#7f1d1d" } };
  const s = M[e] || M.activo;
  return <span style={{ background: s.bg, color: s.c, border: "1px solid " + s.b, padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{e.toUpperCase()}</span>;
};

const Btn = ({ children, onClick, v = "primary", sm, dis, style = {} }) => {
  const V = {
    primary: { background: "linear-gradient(135deg,#D4AF37,#B8960C)", color: "#1A1A1A" },
    ghost: { background: "transparent", color: "#D4AF37", border: "1px solid #D4AF3770" }
  };
  return <button onClick={dis ? undefined : onClick} style={{ padding: sm ? "5px 11px" : "9px 17px", borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 600, ...V[v], ...style }}>{children}</button>;
};

const Modal = ({ title, onClose, children, width = 520 }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: "#1A1A1A", border: "1px solid #D4AF37", borderRadius: 16, width: "100%", maxWidth: width, padding: "1.3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15 }}>
        <h3 style={{ margin: 0, color: "#D4AF37" }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const Av = ({ i, size = 34, color = "#D4AF37" }) => <div style={{ width: size, height: size, borderRadius: "50%", background: "#1a1808", border: "2px solid " + color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color }}>{i}</div>;
const Toast = ({ d }) => d ? <div style={{ position: "fixed", top: 20, right: 20, background: "#14532d", color: "#fff", padding: "10px 16px", borderRadius: 10, zIndex: 3000 }}>{d.msg}</div> : null;

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem("pr_user")) || null);
  const [db, setDb] = useState({ clientes: [], prestamos: [], pagos: [], agencias: [], usuarios: [] });
  const [active, setActive] = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(true);
  const [toastData, setToastData] = useState(null);
  const [mWaMasivo, setMWaMasivo] = useState(false);

  // Simulación de carga de módulos
  const modules = {
    dashboard: <div>Contenido Dashboard</div>,
    clientes: <div>Contenido Clientes</div>
  };

  if (!user) return <div style={{ color: "white", padding: 20 }}>Por favor inicia sesión (Componente Login aquí)</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080808", color: "#e0e0e0", fontFamily: "sans-serif" }}>
      
      {/* Sidebar */}
      <div style={{ width: 210, background: "#0e0e0e", borderRight: "1px solid #1a1a1a", position: "fixed", height: "100vh", left: sideOpen ? 0 : -210, transition: "0.3s" }}>
        <div style={{ padding: 20, textAlign: "center" }}>
          <img src={LOGO_SRC} alt="Logo" style={{ width: 140 }} />
        </div>
        <nav style={{ padding: "0 10px" }}>
          {["dashboard", "clientes", "prestamos"].map(m => (
            <div key={m} onClick={() => setActive(m)} style={{ padding: "10px", cursor: "pointer", color: active === m ? "#D4AF37" : "#888" }}>
              {m.toUpperCase()}
            </div>
          ))}
          <div onClick={() => setMWaMasivo(true)} style={{ padding: "10px", cursor: "pointer", color: "#4ade80" }}>WHATSAPP MASIVO</div>
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ marginLeft: sideOpen ? 210 : 0, flex: 1, display: "flex", flexDirection: "column", transition: "0.3s" }}>
        <header style={{ height: 60, background: "#0e0e0e", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", padding: "0 20px" }}>
          <button onClick={() => setSideOpen(!sideOpen)} style={{ background: "none", border: "none", color: "#D4AF37", fontSize: 24, cursor: "pointer" }}>☰</button>
          <div style={{ flex: 1 }} />
          <Av i={user.avatar} color={RC[user.rol]} />
          <button onClick={() => { setUser(null); sessionStorage.removeItem("pr_user"); }} style={{ marginLeft: 15, background: "none", border: "1px solid #333", color: "#888", padding: "5px 10px", borderRadius: 5, cursor: "pointer" }}>Salir</button>
        </header>

        <main style={{ padding: 20 }}>
          {modules[active] || modules.dashboard}
        </main>
      </div>

      {/* Notificaciones */}
      <Toast d={toastData} />

      {/* MODAL WHATSAPP MASIVO (Corregido y dentro del árbol JSX) */}
      {mWaMasivo && (
        <Modal title="WhatsApp Masivo" onClose={() => setMWaMasivo(false)} width={600}>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <p style={{ fontSize: 13, color: "#aaa" }}>
              Esta función permite enviar recordatorios a todos los clientes con préstamos activos.
            </p>
            {/* Aquí iría el listado de clientes filtrados */}
            <div style={{ maxHeight: 300, overflowY: "auto", background: "#000", padding: 10, borderRadius: 8 }}>
               {db.clientes.length === 0 ? "No hay clientes activos para procesar." : "Lista de clientes cargada..."}
            </div>
            <div style={{ display: