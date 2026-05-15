import React, { useMemo, useState } from "react";
import { Icon } from "../components/ui";
import { MOCK_USERS } from "./mockAdminData";

function initials(name) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AdminUsers({ onOpenUser }) {
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const filtered = useMemo(() => {
    let rows = [...MOCK_USERS];
    const qq = q.trim().toLowerCase();
    if (qq) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(qq) ||
          r.email.toLowerCase().includes(qq)
      );
    }
    if (plan !== "all") rows = rows.filter((r) => r.plan === plan);
    if (status !== "all") rows = rows.filter((r) => r.status === status);
    return rows;
  }, [q, plan, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const planChip = (p) =>
    p === "pro" ? "chip-accent" : p === "enterprise" ? "chip" : "";

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <div className="display" style={{ fontSize: 26 }}>
          Users
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Search, filter, and open analytics for any account.
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          className="between"
          style={{
            flexWrap: "wrap",
            gap: 12,
            padding: 16,
            borderBottom: "1px solid var(--line)",
            background: "var(--surface-2)",
          }}
        >
          <div className="row" style={{ gap: 8, flex: 1, minWidth: 200 }}>
            <Icon name="search" size={16} style={{ color: "var(--ink-3)" }} />
            <input
              className="input"
              style={{ flex: 1, maxWidth: 320 }}
              placeholder="Search name or email…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {["all", "free", "pro", "enterprise"].map((p) => (
              <button
                key={p}
                type="button"
                className={`btn btn-sm ${plan === p ? "btn-primary" : "btn-ghost"}`}
                onClick={() => {
                  setPlan(p);
                  setPage(1);
                }}
              >
                {p === "all" ? "All plans" : p}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {["all", "active", "paused", "churned"].map((s) => (
              <button
                key={s}
                type="button"
                className={`btn btn-sm ${status === s ? "btn-accent" : "btn-ghost"}`}
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 920, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>User</th>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>Plan</th>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>Credits used</th>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>Remaining</th>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>Interviews</th>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>Resumes</th>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>Last active</th>
                <th style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((u) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      type="button"
                      className="row"
                      style={{
                        gap: 10,
                        alignItems: "center",
                        background: "none",
                        border: 0,
                        padding: 0,
                        cursor: "pointer",
                        textAlign: "left",
                        color: "inherit",
                      }}
                      onClick={() => onOpenUser(u.id)}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          background: "linear-gradient(135deg, var(--surface-2), var(--line-2))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {initials(u.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {u.email}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span className={`chip ${planChip(u.plan)}`} style={{ fontSize: 11, textTransform: "capitalize" }}>
                      {u.plan}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {u.creditsUsed.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--good)" }}>
                    {u.creditsRemaining.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>{u.mockInterviews}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>{u.resumesGenerated}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }} className="muted">
                    {new Date(u.lastActive).toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span className="row" style={{ gap: 6, alignItems: "center" }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background:
                            u.status === "active"
                              ? "var(--good)"
                              : u.status === "paused"
                                ? "var(--warn)"
                                : "var(--bad)",
                        }}
                      />
                      <span className="chip" style={{ fontSize: 11 }}>
                        {u.status}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="between muted" style={{ padding: "12px 16px", fontSize: 12 }}>
          <span>
            Page {page} / {totalPages} · {filtered.length} users
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
