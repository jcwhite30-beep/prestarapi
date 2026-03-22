import React, { useState, useCallback, useRef, useEffect } from "react";

// ... (Mantén aquí todos tus LOGO_SRC, funciones FE, generarIntereses y constantes) ...
// ... (Mantén todos los componentes de Átomos: Badge, Btn, Card, SC, Modal, Inp, Sel, Av, Toast, ImgUp) ...

export default function App() {
  // ... (Toda tu lógica de estados iniciales: user, db, active, toastData, etc.) ...

  // CORRECCIÓN: La lógica de WhatsApp Masivo debe estar dentro de la función App
  // o ser un componente aparte. Aquí la integramos correctamente:

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"#080808",color:"#e0e0e0",fontFamily:"'Inter',sans-serif"}}>
      {/* Sidebar */}
      <div style={{width:210,background:"#0e0e0e",borderRight:"1px solid #1a1a1a",display:"flex",flexDirection:"column",position:"fixed",height:"100vh",zIndex:99,left:sideOpen?0:-210,transition:"left 0.3s ease"}}>
         {/* ... Contenido del sidebar ... */}
      </div>

      {sideOpen && <div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:98}}/>}

      <div id="main" style={{marginLeft:210,flex:1,minHeight:"100vh",display:{"flex"},flexDirection:"column"}}>
        <div style={{position:"sticky",top:0,background:"#0e0e0e",borderBottom:"1px solid #1a1a1a",padding:"9px 16px",display:"flex",alignItems:"center",gap:10,zIndex:90}}>
          <button onClick={()=>setSideOpen(!sideOpen)} style={{background:"none",border:"none",color:"#D4AF37",fontSize:20,cursor:"pointer",padding:"2px 6px"}}>☰</button>
          <div style={{flex:1}}/>
          <div style={{fontSize:10,color:"#333"}}>{new Date().toLocaleDateString("es-PA")}</div>
          <Av i={user.avatar} size={26} color={RC[user.rol]}/>
          <button onClick={()=>{setUser(null);try{sessionStorage.removeItem("pr_user");}catch(e){}}} style={{background:"none",border:"1px solid #1e1e1e",color:"#444",fontSize:11,padding:"4px 10px",borderRadius:6,cursor:"pointer"}}>Salir</button>
        </div>
        
        <div style={{padding:"1.2rem 1.3rem",maxWidth:1280,width:"100%",margin:"0 auto",flex:1}}>
          {modules[active] || modules.dashboard}
        </div>
      </div>

      <Toast d={toastData}/>

      {/* CORRECCIÓN: Renderizado condicional de WhatsApp Masivo corregido */}
      {mWaMasivo && (() => {
        const clientesWA = lista.filter(c => {
          const psC = db.prestamos.filter(p => p.cliente_id === c.id && p.estado === "activo");
          return psC.length > 0;
        });

        return (
          <Modal title="WhatsApp Masivo" onClose={() => setMWaMasivo(false)} width={600}>
            <div style={{display: "flex", flexDirection: "column", gap: 12}}>
              <p style={{fontSize: 12, color: "#888"}}>Se enviará mensaje a {clientesWA.length} clientes con préstamos activos.</p>
              {/* Contenido del modal de WhatsApp */}
              <Btn onClick={() => setMWaMasivo(false)}>Cerrar</Btn>
            </div>
          </Modal>
        );
      })()} 
    </div>
  );
}