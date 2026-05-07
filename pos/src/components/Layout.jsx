import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCaja } from "../context/CajaContext";

const NAV = [
  {
    path: "/venta",
    label: "Venta",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M7 15h2M13 15h4" />
      </svg>
    ),
  },
  {
    path: "/productos",
    label: "Productos",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    path: "/caja",
    label: "Caja",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      </svg>
    ),
  },
  {
    path: "/historial",
    label: "Historial",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
];

export default function Layout({ children }) {
  const { sesion, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { caja } = useCaja();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F8F9FA" }}>
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 40,
          }}
        />
      )}

      <aside
        style={{
          width: collapsed ? 64 : 220,
          flexShrink: 0,
          background: "white",
          borderRight: "1px solid #F0F0F0",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          bottom: 0,
          zIndex: 50,
          transition: "width .2s",
        }}
      >
        <div
          style={{
            padding: collapsed ? "20px 0" : "20px 16px",
            borderBottom: "1px solid #F0F0F0",
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: collapsed ? "center" : "space-between",
          }}
        >
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "#111",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              </div>
              <span style={{ fontWeight: 600, fontSize: 15 }}>EduWallet</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: "none",
              border: "none",
              color: "#999",
              padding: 4,
              borderRadius: 6,
              display: "flex",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
        {!collapsed && caja && (
          <div
            style={{
              padding: "8px 16px",
              background: "#F0FDF4",
              borderBottom: "1px solid #F0F0F0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#16A34A",
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 500, color: "#166534" }}>
                Caja abierta — {caja.local}
              </span>
            </div>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 12,
                fontWeight: 600,
                color: "#166534",
              }}
            >
              ${Number(caja.ventas || 0).toLocaleString("es-AR")}
            </p>
          </div>
        )}
        {!collapsed && !caja && (
          <div
            style={{
              padding: "8px 16px",
              background: "#FEF2F2",
              borderBottom: "1px solid #F0F0F0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#DC2626",
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 500, color: "#DC2626" }}>
                Sin caja abierta
              </span>
            </div>
          </div>
        )}
        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: collapsed ? "10px 0" : "9px 12px",
                borderRadius: 8,
                textDecoration: "none",
                marginBottom: 2,
                justifyContent: collapsed ? "center" : "flex-start",
                background: isActive ? "#F3F4F6" : "transparent",
                color: isActive ? "#111" : "#666",
                fontWeight: isActive ? 500 : 400,
                fontSize: 13,
              })}
            >
              {item.icon}
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        <div
          style={{
            padding: collapsed ? "12px 0" : "12px 16px",
            borderTop: "1px solid #F0F0F0",
          }}
        >
          {!collapsed && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500 }}>
                {sesion?.nombre}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#999" }}>
                {sesion?.rol}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: collapsed ? "8px 0" : "7px 12px",
              border: "1px solid #F0F0F0",
              borderRadius: 8,
              background: "white",
              color: "#666",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && "Salir"}
          </button>
        </div>
      </aside>

      <div
        style={{
          flex: 1,
          marginLeft: collapsed ? 64 : 220,
          transition: "margin .2s",
          minWidth: 0,
        }}
      >
        <main style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
