import { useState, useMemo, useEffect} from "react";
import api from "../api/axios";
const fmt = (n) => `$${Number(n).toLocaleString("es-AR")}`;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function Auditoria() {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    api.get('/auditoria')
      .then(res => setLogs(res.data))
      .catch(err => console.error(err))
  }, [])

  return (
    <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '1rem' }}>
      <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500 }}>Registro de auditoría</p>
      {logs.length === 0 ? <p style={{ fontSize: 13, color: '#aaa' }}>Sin registros</p> : (
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          {logs.map(l => (
            <div key={l.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E6F1FB', color: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
                {l.empleado_nombre?.split(' ').slice(0, 2).map(n => n[0]).join('') || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13 }}><b style={{ fontWeight: 500 }}>{l.accion}</b>{l.detalle ? ` — ${l.detalle}` : ''}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{l.empleado_nombre} · {new Date(l.fecha).toLocaleString('es-AR')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Administracion({
  alumnos,
  setAlumnos,
  productos,
  setProductos,
  transacciones,
  empleados,
  setEmpleados,
  recargarTodo,
  sesion,
}) {
  const [subTab, setSubTab] = useState("dashboard");
  const [msg, setMsg] = useState(null);
  const [busqA, setBusqA] = useState("");
  const [filtroCurso, setFiltroCurso] = useState("Todos");
  const [localProd, setLocalProd] = useState("Kiosco");
  const [formA, setFormA] = useState({
    nombre: "",
    curso: "",
    saldo: "0",
    limite_diario: "500",
    tutor: "",
    tutor_tel: "",
    alergias: "Ninguna",
  });
  const [formE, setFormE] = useState({
    nombre: "",
    usuario: "",
    pin: "",
    rol: "cajero",
  });
  const [formP, setFormP] = useState({
    nombre: "",
    precio: "0",
    stock: "10",
    categoria: "comida",
  });
  const [recargaForm, setRecargaForm] = useState({
    curso: "Todos",
    monto: "0",
  });

  const showMsg = (tipo, texto) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 3000);
  };

  const totalSaldo = alumnos.reduce((s, a) => s + parseFloat(a.saldo), 0);
  const totalComp = transacciones
    .filter((t) => t.tipo === "compra")
    .reduce((s, t) => s + parseFloat(t.monto), 0);
  const totalRec = transacciones
    .filter((t) => t.tipo === "recarga")
    .reduce((s, t) => s + parseFloat(t.monto), 0);
  const hoy = new Date().toISOString().slice(0, 10);
  const txHoy = transacciones.filter((t) => t.fecha?.slice(0, 10) === hoy);
  const totalHoy = txHoy
    .filter((t) => t.tipo === "compra")
    .reduce((s, t) => s + parseFloat(t.monto), 0);
  const bajaSaldo = alumnos.filter(
    (a) => parseFloat(a.saldo) < 200 && a.activo,
  );
  const cursos = ["Todos", ...new Set(alumnos.map((a) => a.curso))];

  const alumnosFilt = alumnos.filter(
    (a) =>
      (a.nombre.toLowerCase().includes(busqA.toLowerCase()) ||
        a.id.toString().includes(busqA)) &&
      (filtroCurso === "Todos" || a.curso === filtroCurso),
  );

  const ventasPorLocal = useMemo(() => {
    const m = {};
    transacciones
      .filter((t) => t.tipo === "compra")
      .forEach((t) => (m[t.lugar] = (m[t.lugar] || 0) + parseFloat(t.monto)));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [transacciones]);

  const rankProds = useMemo(() => {
    const m = {};
    transacciones
      .filter((t) => t.tipo === "compra")
      .forEach((t) =>
        t.descripcion?.split(", ").forEach((d) => {
          const n = d.replace(/ ×\d+/, "");
          m[n] = (m[n] || 0) + 1;
        }),
      );
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [transacciones]);

  const agregarAlumno = async () => {
    if (!formA.nombre || !formA.curso) return;
    try {
      const res = await api.post("/alumnos", formA);
      setAlumnos((prev) => [...prev, res.data]);
      showMsg("ok", `Alumno registrado: ${formA.nombre}`);
      setFormA({
        nombre: "",
        curso: "",
        saldo: "0",
        limite_diario: "500",
        tutor: "",
        tutor_tel: "",
        alergias: "Ninguna",
      });
    } catch (err) {
      showMsg("error", "Error al registrar alumno");
    }
  };

  const eliminarAlumno = async (id) => {
    try {
      await api.delete(`/alumnos/${id}`);
      setAlumnos((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      showMsg("error", "Error al eliminar alumno");
    }
  };

  const agregarEmpleado = async () => {
    if (!formE.nombre || !formE.usuario || !formE.pin) return;
    try {
      const res = await api.post("/empleados", formE);
      setEmpleados((prev) => [...prev, res.data]);
      showMsg("ok", `Empleado registrado: ${formE.nombre}`);
      setFormE({ nombre: "", usuario: "", pin: "", rol: "cajero" });
    } catch (err) {
      showMsg("error", "Error al registrar empleado");
    }
  };

  const toggleEmpleado = async (id) => {
    try {
      const res = await api.patch(`/empleados/${id}/toggle`);
      setEmpleados((prev) =>
        prev.map((e) => (e.id === id ? { ...e, activo: res.data.activo } : e)),
      );
    } catch (err) {
      showMsg("error", "Error al cambiar estado");
    }
  };

  const agregarProducto = async () => {
    if (!formP.nombre) return;
    try {
      const res = await api.post("/productos", { ...formP, local: localProd });
      setProductos((prev) => [...prev, res.data]);
      showMsg("ok", `Producto agregado en ${localProd}`);
      setFormP({ nombre: "", precio: "0", stock: "10", categoria: "comida" });
    } catch (err) {
      showMsg("error", "Error al agregar producto");
    }
  };

  const eliminarProducto = async (id) => {
    try {
      await api.delete(`/productos/${id}`);
      setProductos((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      showMsg("error", "Error al eliminar producto");
    }
  };

  const editarStock = async (id, delta) => {
    try {
      const res = await api.patch(`/productos/${id}/stock`, { delta });
      setProductos((prev) => prev.map((p) => (p.id === id ? res.data : p)));
    } catch (err) {
      showMsg("error", "Error al actualizar stock");
    }
  };

  const recargaMasiva = async () => {
  const m = parseInt(recargaForm.monto)
  if (!m || m <= 0) return
  const targets = recargaForm.curso === 'Todos' ? alumnos : alumnos.filter(a => a.curso === recargaForm.curso)
  try {
    for (const a of targets) {
      await api.post(`/alumnos/${a.id}/recargar`, {
        monto: m,
        empleado_id: sesion.id,
        descripcion: `Recarga masiva (${recargaForm.curso})`
      })
    }
    const res = await api.get('/alumnos')
    setAlumnos(res.data)
    recargarTodo()
    showMsg('ok', `Recarga de ${fmt(m)} aplicada a ${targets.length} alumnos`)
  } catch (err) {
    console.error(err)
    showMsg('error', err.response?.data?.error || 'Error en recarga masiva')
  }
}

  const exportCSV = () => {
    const rows = [
      ["ID", "Alumno", "Monto", "Lugar", "Descripción", "Fecha", "Tipo"],
      ...transacciones.map((t) => [
        t.id,
        t.alumno_nombre || t.alumno_id,
        t.monto,
        t.lugar,
        t.descripcion,
        new Date(t.fecha).toLocaleString("es-AR"),
        t.tipo,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "eduwallet_txs.csv";
    a.click();
  };

  const resetPin = async (id) => {
  const nuevo = prompt('Ingresá el nuevo PIN para este empleado:')
  if (!nuevo) return
  try {
    await api.patch(`/empleados/${id}/resetear-pin`, { pin_nuevo: nuevo })
    showMsg('ok', 'PIN reseteado correctamente')
  } catch (err) {
    showMsg('error', err.response?.data?.error || 'Error al resetear PIN')
  }
}

  const SUBTABS = [
    "dashboard",
    "alumnos",
    "empleados",
    "productos",
    "recargar",
    "alertas",
    "auditoría",
  ];

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {SUBTABS.map((s) => (
          <button
            key={s}
            onClick={() => setSubTab(s)}
            style={{
              padding: "5px 10px",
              border: `1px solid ${subTab === s ? "#185FA5" : "#ddd"}`,
              borderRadius: 7,
              cursor: "pointer",
              fontSize: 11,
              whiteSpace: "nowrap",
              background: subTab === s ? "#E6F1FB" : "#f5f5f5",
              color: subTab === s ? "#185FA5" : "#666",
              fontWeight: subTab === s ? 500 : 400,
              textTransform: "capitalize",
            }}
          >
            {s}
            {s === "alertas" && bajaSaldo.length > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  background: "#E24B4A",
                  color: "white",
                  fontSize: 9,
                  padding: "1px 5px",
                  borderRadius: 8,
                }}
              >
                {bajaSaldo.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {msg && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            background:
              msg.tipo === "ok"
                ? "#EAF3DE"
                : msg.tipo === "warn"
                  ? "#FAEEDA"
                  : "#FCEBEB",
            color:
              msg.tipo === "ok"
                ? "#3B6D11"
                : msg.tipo === "warn"
                  ? "#854F0B"
                  : "#A32D2D",
          }}
        >
          {msg.texto}
        </div>
      )}

      {subTab === "dashboard" && (
        <>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            {[
              { label: "Saldo total en sistema", value: fmt(totalSaldo) },
              {
                label: "Ventas hoy",
                value: fmt(totalHoy),
                sub: `${txHoy.filter((t) => t.tipo === "compra").length} transacciones`,
              },
              {
                label: "Total recargado",
                value: fmt(totalRec),
                color: "#3B6D11",
              },
              {
                label: "Total en compras",
                value: fmt(totalComp),
                color: "#A32D2D",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#f5f5f5",
                  borderRadius: 10,
                  padding: "10px 12px",
                  border: "1px solid #eee",
                }}
              >
                <p style={{ margin: "0 0 2px", fontSize: 11, color: "#666" }}>
                  {s.label}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 500,
                    color: s.color || "#111",
                  }}
                >
                  {s.value}
                </p>
                {s.sub && (
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#aaa" }}>
                    {s.sub}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 500,
                color: "#666",
                textTransform: "uppercase",
              }}
            >
              Ventas por local
            </p>
            {ventasPorLocal.map(([lugar, m]) => (
              <div key={lugar} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginBottom: 2,
                  }}
                >
                  <span>{lugar}</span>
                  <span style={{ fontWeight: 500 }}>
                    {fmt(m)} ({pct(m, totalComp)}%)
                  </span>
                </div>
                <div
                  style={{ height: 4, background: "#f0f0f0", borderRadius: 2 }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct(m, totalComp)}%`,
                      background: "#185FA5",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 500,
                color: "#666",
                textTransform: "uppercase",
              }}
            >
              Productos más vendidos
            </p>
            {rankProds.map(([nombre, cnt], i) => (
              <div
                key={nombre}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                  borderBottom: "1px solid #f0f0f0",
                  fontSize: 13,
                }}
              >
                <span>
                  <b style={{ color: "#aaa", fontSize: 11 }}>#{i + 1}</b>{" "}
                  {nombre}
                </span>
                <span
                  style={{
                    background: "#E6F1FB",
                    color: "#185FA5",
                    fontSize: 10,
                    padding: "2px 7px",
                    borderRadius: 6,
                  }}
                >
                  {cnt} ventas
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={exportCSV}
            style={{
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: 8,
              cursor: "pointer",
              background: "#f5f5f5",
              fontSize: 13,
              color: "#666",
            }}
          >
            Exportar transacciones CSV
          </button>
        </>
      )}

      {subTab === "alumnos" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <input
                placeholder="Buscar alumno..."
                value={busqA}
                onChange={(e) => setBusqA(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: "6px 10px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <select
                value={filtroCurso}
                onChange={(e) => setFiltroCurso(e.target.value)}
                style={{
                  fontSize: 12,
                  padding: "6px 8px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  background: "#f5f5f5",
                }}
              >
                {cursos.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            {alumnosFilt.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "#E6F1FB",
                    color: "#185FA5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  {a.nombre
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                    {a.nombre}{" "}
                    <span
                      style={{
                        background: a.activo ? "#EAF3DE" : "#FCEBEB",
                        color: a.activo ? "#3B6D11" : "#A32D2D",
                        fontSize: 9,
                        padding: "1px 6px",
                        borderRadius: 5,
                      }}
                    >
                      {a.activo ? "Activa" : "Bloqueada"}
                    </span>
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>
                    {a.curso} · ID: {a.id}
                    {a.alergias !== "Ninguna" && (
                      <span style={{ color: "#854F0B" }}>
                        {" "}
                        · ⚠ {a.alergias}
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 500,
                      color: parseFloat(a.saldo) > 200 ? "#3B6D11" : "#A32D2D",
                    }}
                  >
                    {fmt(a.saldo)}
                  </p>
                </div>
                <button
                  onClick={() => eliminarAlumno(a.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                    color: "#A32D2D",
                    padding: "0 4px",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
              maxWidth: 400,
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500 }}>
              Nuevo alumno
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                ["Nombre completo", "nombre", "text"],
                ["Curso (ej: 4to A)", "curso", "text"],
                ["Saldo inicial", "saldo", "number"],
                ["Límite diario", "limite_diario", "number"],
                ["Tutor", "tutor", "text"],
                ["Teléfono", "tutor_tel", "text"],
                ["Alergias", "alergias", "text"],
              ].map(([ph, k, t]) => (
                <input
                  key={k}
                  type={t}
                  placeholder={ph}
                  value={formA[k]}
                  onChange={(e) =>
                    setFormA((p) => ({ ...p, [k]: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "7px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
              ))}
              <button
                onClick={agregarAlumno}
                style={{
                  padding: "8px",
                  border: "none",
                  borderRadius: 8,
                  background: "#185FA5",
                  color: "white",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Registrar alumno
              </button>
            </div>
          </div>
        </div>
      )}

      {subTab === "empleados" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500 }}>
              Empleados registrados
            </p>
            {empleados.map((e) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "#EEEDFE",
                    color: "#534AB7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  {e.nombre
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                    {e.nombre}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>
                    {e.usuario} ·{" "}
                    <span
                      style={{
                        background: e.rol === "admin" ? "#EEEDFE" : "#E6F1FB",
                        color: e.rol === "admin" ? "#534AB7" : "#185FA5",
                        padding: "1px 6px",
                        borderRadius: 5,
                        fontSize: 10,
                      }}
                    >
                      {e.rol}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => toggleEmpleado(e.id)}
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: e.activo ? "#FCEBEB" : "#EAF3DE",
                    color: e.activo ? "#A32D2D" : "#3B6D11",
                  }}
                >
                  {e.activo ? "Deshabilitar" : "Habilitar"}
                </button>
                <div style={{ display: 'flex', gap: 6 }}>
  <button onClick={() => toggleEmpleado(e.id)} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: e.activo ? '#FCEBEB' : '#EAF3DE', color: e.activo ? '#A32D2D' : '#3B6D11' }}>
    {e.activo ? 'Deshabilitar' : 'Habilitar'}
  </button>
  <button onClick={() => resetPin(e.id)} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#FAEEDA', color: '#854F0B' }}>
    Reset PIN
  </button>
</div>
              </div>
              
            ))}
          </div>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
              maxWidth: 360,
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500 }}>
              Nuevo empleado
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                ["Nombre completo", "nombre", "text"],
                ["Usuario", "usuario", "text"],
                ["PIN", "pin", "password"],
              ].map(([ph, k, t]) => (
                <input
                  key={k}
                  type={t}
                  placeholder={ph}
                  value={formE[k]}
                  onChange={(e) =>
                    setFormE((p) => ({ ...p, [k]: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "7px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
              ))}
              <select
                value={formE.rol}
                onChange={(e) =>
                  setFormE((p) => ({ ...p, rol: e.target.value }))
                }
                style={{
                  padding: "7px 10px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  fontSize: 13,
                  background: "#f5f5f5",
                }}
              >
                <option value="cajero">Cajero</option>
                <option value="admin">Administrador</option>
              </select>
              <button
                onClick={agregarEmpleado}
                style={{
                  padding: "8px",
                  border: "none",
                  borderRadius: 8,
                  background: "#185FA5",
                  color: "white",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Agregar empleado
              </button>
            </div>
          </div>
        </div>
      )}

      {subTab === "productos" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["Kiosco", "Librería"].map((l) => (
              <button
                key={l}
                onClick={() => setLocalProd(l)}
                style={{
                  padding: "5px 14px",
                  border: `1px solid ${localProd === l ? "#185FA5" : "#ddd"}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  background: localProd === l ? "#E6F1FB" : "#f5f5f5",
                  color: localProd === l ? "#185FA5" : "#666",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
            }}
          >
            {productos
              .filter((p) => p.local === localProd)
              .map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                      {p.nombre}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>
                      {fmt(p.precio)} · {p.categoria}
                    </p>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <button
                      onClick={() => editarStock(p.id, -1)}
                      style={{
                        width: 22,
                        height: 22,
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        cursor: "pointer",
                        background: "#f5f5f5",
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      −
                    </button>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        minWidth: 28,
                        textAlign: "center",
                        color: p.stock <= 3 ? "#A32D2D" : "#111",
                      }}
                    >
                      {p.stock}
                    </span>
                    <button
                      onClick={() => editarStock(p.id, 1)}
                      style={{
                        width: 22,
                        height: 22,
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        cursor: "pointer",
                        background: "#f5f5f5",
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      +
                    </button>
                    {p.stock <= 3 && (
                      <span
                        style={{
                          background: "#FCEBEB",
                          color: "#A32D2D",
                          fontSize: 9,
                          padding: "1px 6px",
                          borderRadius: 5,
                        }}
                      >
                        Bajo
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => eliminarProducto(p.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 15,
                      color: "#A32D2D",
                      padding: "0 4px",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
              maxWidth: 360,
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500 }}>
              Agregar producto en {localProd}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <input
                placeholder="Nombre"
                value={formP.nombre}
                onChange={(e) =>
                  setFormP((p) => ({ ...p, nombre: e.target.value }))
                }
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "7px 10px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <input
                type="number"
                placeholder="Precio"
                value={formP.precio}
                onChange={(e) =>
                  setFormP((p) => ({ ...p, precio: e.target.value }))
                }
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "7px 10px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <input
                type="number"
                placeholder="Stock inicial"
                value={formP.stock}
                onChange={(e) =>
                  setFormP((p) => ({ ...p, stock: e.target.value }))
                }
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "7px 10px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <button
                onClick={agregarProducto}
                style={{
                  padding: "8px",
                  border: "none",
                  borderRadius: 8,
                  background: "#185FA5",
                  color: "white",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Agregar producto
              </button>
            </div>
          </div>
        </div>
      )}

      {subTab === "recargar" && (
        <div
          style={{
            background: "white",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: "1rem",
            maxWidth: 380,
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500 }}>
            Recarga masiva por curso
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#666" }}>
            Cargá saldo a todos los alumnos de un curso o a toda la escuela.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            <select
              value={recargaForm.curso}
              onChange={(e) =>
                setRecargaForm((p) => ({ ...p, curso: e.target.value }))
              }
              style={{
                padding: "7px 10px",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontSize: 13,
                background: "#f5f5f5",
              }}
            >
              {cursos.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Monto por alumno"
              value={recargaForm.monto}
              onChange={(e) =>
                setRecargaForm((p) => ({ ...p, monto: e.target.value }))
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "7px 10px",
                border: "1px solid #ddd",
                borderRadius: 8,
                fontSize: 13,
              }}
            />
            <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
              Afecta a{" "}
              {recargaForm.curso === "Todos"
                ? alumnos.length
                : alumnos.filter((a) => a.curso === recargaForm.curso)
                    .length}{" "}
              alumnos · Total:{" "}
              {fmt(
                (parseInt(recargaForm.monto) || 0) *
                  (recargaForm.curso === "Todos"
                    ? alumnos.length
                    : alumnos.filter((a) => a.curso === recargaForm.curso)
                        .length),
              )}
            </p>
            <button
              onClick={recargaMasiva}
              style={{
                padding: "8px",
                border: "none",
                borderRadius: 8,
                background: "#185FA5",
                color: "white",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Aplicar recarga masiva
            </button>
          </div>
        </div>
      )}

      {subTab === "alertas" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500 }}>
              Alumnos con saldo bajo
            </p>
            {bajaSaldo.length === 0 ? (
              <p style={{ fontSize: 13, color: "#aaa" }}>Sin alertas</p>
            ) : (
              bajaSaldo.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
                      {a.nombre}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>
                      {a.tutor} · {a.tutor_tel}
                    </p>
                  </div>
                  <span
                    style={{ fontSize: 13, fontWeight: 500, color: "#A32D2D" }}
                  >
                    {fmt(a.saldo)}
                  </span>
                </div>
              ))
            )}
          </div>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500 }}>
              Productos con stock bajo
            </p>
            {productos.filter((p) => p.stock <= 3).length === 0 ? (
              <p style={{ fontSize: 13, color: "#aaa" }}>
                Sin alertas de stock
              </p>
            ) : (
              productos
                .filter((p) => p.stock <= 3)
                .map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: "1px solid #f0f0f0",
                      fontSize: 13,
                    }}
                  >
                    <span>
                      {p.nombre}{" "}
                      <span
                        style={{
                          background: "#f0f0f0",
                          color: "#666",
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 5,
                        }}
                      >
                        {p.local}
                      </span>
                    </span>
                    <span style={{ fontWeight: 500, color: "#A32D2D" }}>
                      Stock: {p.stock}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
      {subTab === "auditoría" && <Auditoria />}
    </div>
  );
}
