import { useState, useMemo, useEffect } from "react";
import api from "../api/axios";

const fmt = (n) => `$${Number(n).toLocaleString("es-AR")}`;

export default function PanelPadres({
  alumnos,
  setAlumnos,
  transacciones,
  recargarTx,
  sesion,
}) {
  const [aid, setAid] = useState(alumnos[0]?.id || null);
  const [monto, setMonto] = useState("");
  const [nuevoLimite, setNuevoLimite] = useState("");
  const [msg, setMsg] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [subTab, setSubTab] = useState("inicio");

  const [gastoSemanal, setGastoSemanal] = useState([0, 0, 0, 0, 0, 0, 0]);

  useEffect(() => {
    if (!aid) return;
    api
      .get(`/alumnos/${aid}/gasto-semanal`)
      .then((res) => setGastoSemanal(res.data))
      .catch((err) => console.error(err));
  }, [aid]);

  const alumno = alumnos.find((a) => a.id === aid);
  const historial = transacciones.filter((t) => t.alumno_id === aid);
  const filtrado =
    filtro === "todos" ? historial : historial.filter((t) => t.tipo === filtro);
  const totalGastado = historial
    .filter((t) => t.tipo === "compra")
    .reduce((s, t) => s + parseFloat(t.monto), 0);
  const totalRecargado = historial
    .filter((t) => t.tipo === "recarga")
    .reduce((s, t) => s + parseFloat(t.monto), 0);

  const showMsg = (tipo, texto) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 3000);
  };

  const gastosPorLugar = useMemo(() => {
    const m = {};
    historial
      .filter((t) => t.tipo === "compra")
      .forEach((t) => (m[t.lugar] = (m[t.lugar] || 0) + parseFloat(t.monto)));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [historial]);

  const recargar = async () => {
    const n = parseInt(monto);
    if (!n || n <= 0) return;
    try {
      const res = await api.post(`/alumnos/${aid}/recargar`, {
        monto: n,
        empleado_id: sesion.id,
        descripcion: "Recarga app padres",
      });
      setAlumnos((prev) => prev.map((a) => (a.id === aid ? res.data : a)));
      recargarTx();
      showMsg("ok", `Se cargaron ${fmt(n)} correctamente`);
      setMonto("");
    } catch (err) {
      showMsg("error", err.response?.data?.error || "Error al recargar");
    }
  };

  const guardarLimite = async () => {
    const n = parseInt(nuevoLimite);
    if (!n || n <= 0) return;
    try {
      const res = await api.put(`/alumnos/${aid}`, {
        ...alumno,
        limite_diario: n,
      });
      setAlumnos((prev) => prev.map((a) => (a.id === aid ? res.data : a)));
      showMsg("ok", `Límite actualizado a ${fmt(n)}/día`);
      setNuevoLimite("");
    } catch (err) {
      showMsg("error", "Error al actualizar límite");
    }
  };

  const toggleBloqueo = async () => {
    try {
      const res = await api.patch(`/alumnos/${aid}/toggle`);
      setAlumnos((prev) => prev.map((a) => (a.id === aid ? res.data : a)));
      showMsg(
        "warn",
        `Tarjeta ${alumno.activo ? "bloqueada" : "desbloqueada"}`,
      );
    } catch (err) {
      showMsg("error", "Error al cambiar estado");
    }
  };

  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  if (!alumno)
    return <p style={{ color: "#666", fontSize: 13 }}>Sin alumnos cargados</p>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* selector de alumno */}
      <div
        style={{
          background: "white",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {alumnos.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setAid(a.id);
                setMsg(null);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                border: `1px solid ${aid === a.id ? "#185FA5" : "#ddd"}`,
                borderRadius: 20,
                cursor: "pointer",
                background: aid === a.id ? "#E6F1FB" : "#f5f5f5",
                color: aid === a.id ? "#185FA5" : "#666",
                fontSize: 12,
              }}
            >
              {a.nombre.split(" ")[0]}
              {!a.activo && (
                <span
                  style={{
                    background: "#FCEBEB",
                    color: "#A32D2D",
                    fontSize: 9,
                    padding: "1px 5px",
                    borderRadius: 6,
                  }}
                >
                  Bloqueada
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* subtabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {["inicio", "recargar", "historial", "control"].map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            style={{
              padding: "5px 11px",
              border: `1px solid ${subTab === t ? "#185FA5" : "#ddd"}`,
              borderRadius: 7,
              cursor: "pointer",
              fontSize: 12,
              background: subTab === t ? "#E6F1FB" : "#f5f5f5",
              color: subTab === t ? "#185FA5" : "#666",
              fontWeight: subTab === t ? 500 : 400,
              textTransform: "capitalize",
            }}
          >
            {t}
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

      {subTab === "inicio" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            {[
              {
                label: "Saldo disponible",
                value: fmt(alumno.saldo),
                color: parseFloat(alumno.saldo) > 200 ? "#3B6D11" : "#A32D2D",
              },
              {
                label: "Gastado hoy",
                value: fmt(alumno.gasto_hoy),
                sub: `Límite: ${fmt(alumno.limite_diario)}`,
              },
              {
                label: "Total gastado",
                value: fmt(totalGastado),
                sub: `Recargado: ${fmt(totalRecargado)}`,
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

          {/* gráfico semanal simulado */}
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
              Gasto semanal
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 6,
                height: 80,
              }}
            >
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((dia, i) => {
  const vals = gastoSemanal
  const max = Math.max(...vals, 1)
                  return (
                    <div
                      key={dia}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          background: vals[i] > 0 ? "#185FA5" : "#f0f0f0",
                          borderRadius: "3px 3px 0 0",
                          height: `${(vals[i] / max) * 60}px`,
                          minHeight: vals[i] > 0 ? 4 : 0,
                        }}
                      />
                      <span style={{ fontSize: 9, color: "#aaa" }}>{dia}</span>
                    </div>
                  );
                },
              )}
            </div>
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
              Gasto por lugar
            </p>
            {gastosPorLugar.length === 0 ? (
              <p style={{ fontSize: 13, color: "#aaa" }}>Sin compras</p>
            ) : (
              gastosPorLugar.map(([lugar, m]) => (
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
                    <span style={{ fontWeight: 500 }}>{fmt(m)}</span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: "#f0f0f0",
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct(m, totalGastado)}%`,
                        background: "#185FA5",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {subTab === "recargar" && (
        <div
          style={{
            background: "white",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: "1rem",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "#666" }}>
            Saldo actual: <b style={{ color: "#111" }}>{fmt(alumno.saldo)}</b>
          </p>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[200, 500, 1000, 2000].map((n) => (
              <button
                key={n}
                onClick={() => setMonto(String(n))}
                style={{
                  flex: 1,
                  padding: "7px 4px",
                  border: `1px solid ${monto == n ? "#185FA5" : "#ddd"}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  background: monto == n ? "#E6F1FB" : "#f5f5f5",
                  color: monto == n ? "#185FA5" : "#666",
                }}
              >
                {fmt(n)}
              </button>
            ))}
          </div>
          <input
            type="number"
            placeholder="Otro monto"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            style={{
              width: "100%",
              marginBottom: 10,
              boxSizing: "border-box",
              padding: "7px 10px",
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          />
          <button
            onClick={recargar}
            style={{
              width: "100%",
              padding: "9px",
              border: "none",
              borderRadius: 8,
              background: "#185FA5",
              color: "white",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Recargar
          </button>
        </div>
      )}

      {subTab === "historial" && (
        <div
          style={{
            background: "white",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: "1rem",
          }}
        >
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {["todos", "compra", "recarga"].map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                style={{
                  padding: "4px 10px",
                  border: `1px solid ${filtro === f ? "#185FA5" : "#ddd"}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  background: filtro === f ? "#E6F1FB" : "transparent",
                  color: filtro === f ? "#185FA5" : "#666",
                  textTransform: "capitalize",
                }}
              >
                {f}
              </button>
            ))}
          </div>
          {filtrado.length === 0 ? (
            <p style={{ fontSize: 13, color: "#aaa" }}>Sin movimientos</p>
          ) : (
            filtrado.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "7px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 13 }}>{t.descripcion}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>
                    {new Date(t.fecha).toLocaleString("es-AR")} · {t.lugar}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: t.tipo === "recarga" ? "#3B6D11" : "#A32D2D",
                    }}
                  >
                    {t.tipo === "recarga" ? "+" : "-"}
                    {fmt(t.monto)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === "control" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500 }}>
              Límite de gasto diario
            </p>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#666" }}>
              Actual: <b>{fmt(alumno.limite_diario)}/día</b> · usado:{" "}
              {fmt(alumno.gasto_hoy)}
            </p>
            <div
              style={{
                height: 4,
                background: "#f0f0f0",
                borderRadius: 2,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(pct(alumno.gasto_hoy, alumno.limite_diario), 100)}%`,
                  background: "#E24B4A",
                  borderRadius: 2,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                placeholder="Nuevo límite"
                value={nuevoLimite}
                onChange={(e) => setNuevoLimite(e.target.value)}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                }}
              />
              <button
                onClick={guardarLimite}
                style={{
                  padding: "0 14px",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: "#f5f5f5",
                  fontSize: 13,
                }}
              >
                Guardar
              </button>
            </div>
          </div>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500 }}>
              Estado de la tarjeta
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 13 }}>{alumno.nombre}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>
                  {alumno.qr}
                </p>
              </div>
              <span
                style={{
                  background: alumno.activo ? "#EAF3DE" : "#FCEBEB",
                  color: alumno.activo ? "#3B6D11" : "#A32D2D",
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 6,
                }}
              >
                {alumno.activo ? "Activa" : "Bloqueada"}
              </span>
            </div>
            <button
              onClick={toggleBloqueo}
              style={{
                marginTop: 10,
                padding: "7px 14px",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                background: alumno.activo ? "#FCEBEB" : "#EAF3DE",
                color: alumno.activo ? "#A32D2D" : "#3B6D11",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {alumno.activo ? "Bloquear tarjeta" : "Desbloquear tarjeta"}
            </button>
          </div>
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: "1rem",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 500 }}>
              Datos del alumno
            </p>
            {[
              ["Nombre", alumno.nombre],
              ["Curso", alumno.curso],
              ["Alergias", alumno.alergias],
              ["Tutor", alumno.tutor],
              ["Teléfono", alumno.tutor_tel],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                  borderBottom: "1px solid #f0f0f0",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#666" }}>{k}</span>
                <span
                  style={{
                    fontWeight: 500,
                    color:
                      k === "Alergias" && v !== "Ninguna" ? "#854F0B" : "#111",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
