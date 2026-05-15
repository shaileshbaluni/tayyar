import React, { useState } from "react";
import { Icon, Logo, Avatar } from "../components/ui";
import { AdminUsers } from "./AdminUsers";
import { AdminUserDetail } from "./AdminUserDetail";
import { AdminPromptStudio } from "./AdminPromptStudio";
import { AdminPersonas } from "./AdminPersonas";

const ADMIN_NAV = [
  { k: "users", label: "Users", ico: "users" },
  { k: "personas", label: "AI Interviewers", ico: "mic" },
  { k: "prompts", label: "Prompt Studio", ico: "file" },
];

/**
 * Admin shell — same app chrome as the student experience (sidebar, main, topbar).
 */
export function AdminApp({ onLogout }) {
  const [page, setPage] = useState({ type: "users" });

  const goNav = (k) => {
    if (k === "users") setPage({ type: "users" });
    if (k === "personas") setPage({ type: "personas" });
    if (k === "prompts") setPage({ type: "prompts" });
  };

  const navActive = (k) => {
    if (k === "users") return page.type === "users" || page.type === "user";
    if (k === "personas") return page.type === "personas";
    if (k === "prompts") return page.type === "prompts";
    return false;
  };

  return (
    <div className="app">
      <div className="app-body">
        <aside className="sidebar">
          <div style={{ padding: "6px 8px 10px" }}>
            <Logo size={26} />
          </div>
          <div className="nav-section">ADMIN</div>
          {ADMIN_NAV.map((n) => (
            <div
              key={n.k}
              className={"nav-item " + (navActive(n.k) ? "active" : "")}
              onClick={() => goNav(n.k)}
            >
              <span className="nav-ico">
                <Icon name={n.ico} size={17} />
              </span>
              {n.label}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ margin: "8px 8px 0", width: "calc(100% - 16px)", justifyContent: "center" }}
            onClick={() => onLogout()}
          >
            Switch account
          </button>
          <div className="center" style={{ gap: 8, padding: "10px 8px 0" }}>
            <Avatar name="Admin" color="var(--ink)" size={28} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Admin</div>
              <div className="muted" style={{ fontSize: 10.5 }}>Tayyar console</div>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <button className="btn btn-quiet btn-sm" style={{ display: "none" }}>
              <Icon name="menu" size={16} />
            </button>
            <Logo size={22} />
            <div className="center" style={{ flex: 1, maxWidth: 420, background: "var(--surface)", padding: "7px 12px", borderRadius: 10, gap: 8, border: "1px solid var(--line)", marginLeft: 14 }}>
              <Icon name="search" size={14} style={{ color: "var(--ink-3)" }} />
              <input
                style={{ background: "transparent", border: 0, outline: 0, flex: 1, fontSize: 13 }}
                placeholder="Search users, prompts, personas…"
              />
              <span className="mono muted" style={{ fontSize: 11 }}>⌘K</span>
            </div>
            <span style={{ flex: 1 }} />
            <span className="chip" style={{ fontSize: 11 }}>Admin</span>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => onLogout()} title="Sign out">
              <Icon name="x" size={15} />
            </button>
          </div>

          <div className="content">
            {page.type === "users" && <AdminUsers onOpenUser={(id) => setPage({ type: "user", id })} />}
            {page.type === "user" && <AdminUserDetail userId={page.id} onBack={() => setPage({ type: "users" })} />}
            {page.type === "personas" && <AdminPersonas />}
            {page.type === "prompts" && <AdminPromptStudio />}
          </div>
        </main>
      </div>
    </div>
  );
}
