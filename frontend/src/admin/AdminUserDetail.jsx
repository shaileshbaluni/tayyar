import React from "react";
import { Icon } from "../components/ui";
import { getUserDetail } from "./mockAdminData";

function BarList({ rows, labelKey, valueKey, color }) {
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.map((r) => {
        const pct = Math.round((r[valueKey] / max) * 100);
        return (
          <div key={String(r[labelKey])}>
            <div className="between" style={{ fontSize: 11, marginBottom: 4 }}>
              <span>{r[labelKey]}</span>
              <span className="mono muted">{r[valueKey]}</span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: "var(--line)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: color || "var(--accent)",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminUserDetail({ userId, onBack }) {
  const data = getUserDetail(userId);
  if (!data) {
    return (
      <div className="stack" style={{ gap: 12 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <Icon name="arrowL" size={14} /> Users
        </button>
        <p className="muted">User not found.</p>
      </div>
    );
  }

  const { user, interview, interviews, resume, platform, credits, insights } = data;

  return (
    <div className="stack" style={{ gap: 28, paddingBottom: 40 }}>
      <div className="between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 8 }}>
            <Icon name="arrowL" size={14} /> All users
          </button>
          <div className="display" style={{ fontSize: 26 }}>
            {user.name}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {user.email}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="chip" style={{ textTransform: "capitalize" }}>
            {user.plan}
          </span>
          <span
            className={`chip ${user.status === "active" ? "chip-good" : user.status === "paused" ? "chip-warn" : "chip-bad"}`}
          >
            {user.status}
          </span>
        </div>
      </div>

      <section className="stack" style={{ gap: 12 }}>
        <div className="label" style={{ margin: 0 }}>
          Overview
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          {[
            ["Plan", user.plan],
            ["Signup", new Date(data.signupDate).toLocaleDateString()],
            ["Last active", new Date(user.lastActive).toLocaleString()],
            ["Total credits", (user.creditsUsed + user.creditsRemaining).toLocaleString()],
            ["Used credits", user.creditsUsed.toLocaleString()],
            ["Remaining", user.creditsRemaining.toLocaleString()],
            ["Total sessions", String(data.totalSessions)],
            ["Interviews", String(interview.total)],
          ].map(([k, v]) => (
            <div key={k} className="card" style={{ padding: 14 }}>
              <div
                className="muted"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {k}
              </div>
              <div
                style={{
                  fontWeight: 700,
                  marginTop: 6,
                  textTransform: k === "Plan" ? "capitalize" : "none",
                }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="label" style={{ margin: 0 }}>
          Mock interview analytics
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {[
            ["Total", interview.total],
            ["Avg score", interview.avgScore],
            ["Highest", interview.highestScore],
            ["Lowest", interview.lowestScore],
            ["Practice hrs", interview.practiceHours],
          ].map(([k, v]) => (
            <div key={k} className="card" style={{ padding: 14 }}>
              <div className="muted" style={{ fontSize: 11 }}>
                {k}
              </div>
              <div className="display" style={{ fontSize: 22, marginTop: 4 }}>
                {v}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Score trend</div>
            <BarList rows={interview.scoreTrend} labelKey="date" valueKey="score" color="var(--accent-2)" />
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Company distribution</div>
            <BarList rows={interview.companyDistribution} labelKey="company" valueKey="count" color="var(--teal)" />
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Weekly activity</div>
            <BarList rows={interview.weeklyActivity} labelKey="week" valueKey="count" color="var(--gold)" />
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Role attempts</div>
            <BarList rows={interview.roleDistribution} labelKey="role" valueKey="count" color="var(--good)" />
          </div>
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="label" style={{ margin: 0 }}>
          Interview history
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {interviews.map((row) => (
            <details key={row.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <summary
                style={{
                  padding: "14px 16px",
                  cursor: "pointer",
                  listStyle: "none",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600 }}>
                    {row.company} · {row.role}
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {row.roundType} · {new Date(row.date).toLocaleDateString()} · {row.durationMin} min
                  </div>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <span className="chip" style={{ fontSize: 10 }}>
                    Overall {row.overallScore}
                  </span>
                  <span className="chip" style={{ fontSize: 10 }}>
                    Comm {row.communicationScore}
                  </span>
                  <span className="chip" style={{ fontSize: 10 }}>
                    Tech {row.technicalScore}
                  </span>
                  <span className="chip" style={{ fontSize: 10 }}>
                    Conf {row.confidenceScore}
                  </span>
                </div>
              </summary>
              <div
                className="stack"
                style={{
                  gap: 12,
                  padding: "0 16px 16px",
                  borderTop: "1px solid var(--line)",
                  fontSize: 13,
                }}
              >
                <p style={{ margin: "12px 0 0" }}>{row.feedbackHighlights}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--good)" }}>Strengths</div>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "var(--ink-2)" }}>
                      {row.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)" }}>Weaknesses</div>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "var(--ink-2)" }}>
                      {row.weaknesses.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>AI suggestions</div>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "var(--ink-2)" }}>
                      {row.aiSuggestions.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="label" style={{ margin: 0 }}>
          Resume analytics
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {[
            ["Generated", resume.totalGenerated],
            ["ATS optimizations", resume.atsOptimizations],
            ["Downloads", resume.downloads],
            ["Top template", resume.topTemplate],
          ].map(([k, v]) => (
            <div key={k} className="card" style={{ padding: 14 }}>
              <div className="muted" style={{ fontSize: 11 }}>
                {k}
              </div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Resume score lift</div>
          <BarList rows={resume.scoreImprovement} labelKey="month" valueKey="score" color="var(--accent-2)" />
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="label" style={{ margin: 0 }}>
          Platform usage
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Daily minutes</div>
          <BarList rows={platform.dailyUsage} labelKey="day" valueKey="minutes" color="var(--teal)" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <div className="card" style={{ padding: 16 }}>
            <div className="muted" style={{ fontSize: 11 }}>
              Weekly active days
            </div>
            <div className="display" style={{ fontSize: 28, marginTop: 4 }}>
              {platform.weeklyActiveDays}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>
              Time spent (hrs)
            </div>
            <div className="display" style={{ fontSize: 28, marginTop: 4 }}>
              {platform.timeSpentHours}
            </div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Most used feature</div>
            <div style={{ color: "var(--accent)" }}>{platform.topFeature}</div>
            <div className="stack" style={{ gap: 8, marginTop: 14 }}>
              {platform.featureHeatmap.map((f) => (
                <div key={f.feature}>
                  <div className="between" style={{ fontSize: 11, marginBottom: 4 }}>
                    <span>{f.feature}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${f.intensity * 100}%`,
                        height: "100%",
                        background: "var(--ink)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Session frequency</div>
          <BarList rows={platform.sessionFrequency} labelKey="week" valueKey="sessions" color="var(--good)" />
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="label" style={{ margin: 0 }}>
          Credit usage
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Consumption over time</div>
            <BarList rows={credits.overTime} labelKey="date" valueKey="used" color="var(--warn)" />
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>By feature</div>
            <BarList rows={credits.byFeature} labelKey="feature" valueKey="credits" color="var(--accent-2)" />
          </div>
        </div>
        <div className="card" style={{ padding: 14, fontSize: 13 }}>
          <span className="muted">Est. tokens </span>
          <span className="mono">{credits.estimatedTokens.toLocaleString()}</span>
          <span className="muted" style={{ margin: "0 12px" }}>
            ·
          </span>
          <span className="muted">Most expensive </span>
          <span style={{ fontWeight: 600 }}>{credits.mostExpensiveFeature}</span>
          <span className="muted" style={{ margin: "0 12px" }}>
            ·
          </span>
          <span className="muted">Avg credits / session </span>
          <span className="mono">{credits.avgCreditsPerSession}</span>
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="label" style={{ margin: 0 }}>
          Behavioral insights
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {insights.map((text) => (
            <div
              key={text}
              className="card"
              style={{
                padding: 16,
                background: "linear-gradient(135deg, var(--surface), var(--surface-2))",
              }}
            >
              <Icon name="bolt" size={16} style={{ color: "var(--accent)", marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
