import { useState } from "react";
import api from '../api/axios'
import {
  useAlumnos,
  useProductos,
  useTransacciones,
  useEmpleados,
} from "../hooks/useData";
import PuntoVenta from "./PuntoVenta";
import PanelPadres from "./PanelPadres";
import Administracion from "./Administracion";

const TABS = ["Punto de Venta", "Panel de Padres", "Administración"];

export default function Dashboard({ sesion, onLogout }) {
  const [tab, setTab] = useState(sesion.rol === "admin" ? 0 : 0);
  const { alumnos, setAlumnos, recargarAlumnos } = useAlumnos();
  const {
    productos,
    setProductos,
    recargar: recargarProductos,
  } = useProductos();
  const { transacciones, recargar: recargarTx } = useTransacciones();
  const { empleados, setEmpleados } = useEmpleados();
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const recargarTodo = () => {
    recargarProductos();
    recargarTx();
  };

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: 740,
        margin: "0 auto",
        padding: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "#185FA5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20M7 15h2M13 15h4" />
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
              EduWallet
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: "#666" }}>
              Hola, {sesion.nombre} ·{" "}
              <span
                style={{
                  background: sesion.rol === "admin" ? "#EEEDFE" : "#E6F1FB",
                  color: sesion.rol === "admin" ? "#534AB7" : "#185FA5",
                  padding: "1px 7px",
                  borderRadius: 6,
                  fontSize: 10,
                }}
              >
                {sesion.rol}
              </span>
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setMostrarPerfil(true)}
            style={{
              fontSize: 12,
              padding: "5px 12px",
              border: "1px solid #ddd",
              borderRadius: 7,
              cursor: "pointer",
              background: "#f5f5f5",
            }}
          >
            Mi PIN
          </button>
          <button
            onClick={onLogout}
            style={{
              fontSize: 12,
              padding: "5px 12px",
              border: "1px solid #ddd",
              borderRadius: 7,
              cursor: "pointer",
              background: "#f5f5f5",
            }}
          >
            Salir
          </button>
        </div>
        <button
          onClick={onLogout}
          style={{
            fontSize: 12,
            padding: "5px 12px",
            border: "1px solid #ddd",
            borderRadius: 7,
            cursor: "pointer",
            background: "#f5f5f5",
          }}
        >
          Salir
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 14,
          background: "#f5f5f5",
          padding: 4,
          borderRadius: 10,
        }}
      >
        {TABS.map((t, i) => {
          const disabled = sesion.rol === "cajero" && i === 2;
          return (
            <button
              key={t}
              onClick={() => !disabled && setTab(i)}
              style={{
                flex: 1,
                padding: "7px 4px",
                border: "none",
                borderRadius: 7,
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: tab === i ? 500 : 400,
                background: tab === i ? "white" : "transparent",
                color: disabled ? "#ccc" : tab === i ? "#111" : "#666",
                boxShadow: tab === i ? "0 0 0 0.5px #ddd" : "none",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {tab === 0 && (
        <PuntoVenta
          alumnos={alumnos}
          setAlumnos={setAlumnos}
          productos={productos}
          setProductos={setProductos}
          sesion={sesion}
          onCobro={recargarTodo}
        />
      )}
      {tab === 1 && (
        <PanelPadres
          alumnos={alumnos}
          setAlumnos={setAlumnos}
          transacciones={transacciones}
          recargarTx={recargarTx}
          sesion={sesion}
        />
      )}
      {tab === 2 && sesion.rol === "admin" && (
        <Administracion
          alumnos={alumnos}
          setAlumnos={setAlumnos}
          productos={productos}
          setProductos={setProductos}
          transacciones={transacciones}
          empleados={empleados}
          setEmpleados={setEmpleados}
          recargarTodo={recargarTodo}
          sesion={sesion}
        />
      )}
      {mostrarPerfil && <ModalCambiarPin sesion={sesion} onCerrar={() => setMostrarPerfil(false)} />}
    </div>
  );
}

function ModalCambiarPin({ sesion, onCerrar }) {
  const [pinActual, setPinActual] = useState('')
  const [pinNuevo, setPinNuevo] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [msg, setMsg] = useState(null)

  const cambiar = async () => {
    if (pinNuevo !== pinConfirm) {
      setMsg({ tipo: 'error', texto: 'Los PINs nuevos no coinciden' }); return
    }
    if (pinNuevo.length < 4) {
      setMsg({ tipo: 'error', texto: 'El PIN debe tener al menos 4 caracteres' }); return
    }
    try {
      await api.patch(`/empleados/${sesion.id}/cambiar-pin`, {
        pin_actual: pinActual,
        pin_nuevo: pinNuevo
      })
      setMsg({ tipo: 'ok', texto: 'PIN actualizado correctamente' })
      setTimeout(onCerrar, 2000)
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.response?.data?.error || 'Error al cambiar PIN' })
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 14, padding: '1.5rem', width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Cambiar mi PIN</p>
          <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#999' }}>×</button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>PIN actual</p>
            <input type="password" value={pinActual} onChange={e => setPinActual(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8 }} />
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>PIN nuevo</p>
            <input type="password" value={pinNuevo} onChange={e => setPinNuevo(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8 }} />
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#666' }}>Confirmar PIN nuevo</p>
            <input type="password" value={pinConfirm} onChange={e => setPinConfirm(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #ddd', borderRadius: 8 }} />
          </div>
          {msg && <div style={{ padding: '7px 10px', borderRadius: 8, fontSize: 13, background: msg.tipo === 'ok' ? '#EAF3DE' : '#FCEBEB', color: msg.tipo === 'ok' ? '#3B6D11' : '#A32D2D' }}>{msg.texto}</div>}
          <button onClick={cambiar} style={{ padding: '9px', border: 'none', borderRadius: 8, background: '#185FA5', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Actualizar PIN</button>
        </div>
      </div>
    </div>
  )
}