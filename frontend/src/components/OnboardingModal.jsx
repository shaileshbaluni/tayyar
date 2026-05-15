import React, { useState, useCallback, useRef } from "react";
import { Icon } from "./ui";
import { profileToResumeData, resumeParsedToProfile } from "../lib/profileBridge";
import { parseResumeFromUploadFile } from "../resume/ResumeUpload";
import { useResumeStore } from "../resume/store";
import { seedPrimaryCandidateFromProfile } from "../lib/candidateProfiles";

const PROFILE_KEY = "tayyar-user-profile";
const ONBOARD_KEY = "tayyar-onboarding-complete";

const emptyProfile = () => ({
  basics: { name: "", email: "", phone: "", location: "" },
  education: [],
  experience: [],
  projects: [],
  certifications: [],
  skills: [],
});

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return { ...emptyProfile(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return emptyProfile();
}

function saveCandidatesFromProfile(profile) {
  seedPrimaryCandidateFromProfile(profile);
}

function parseErrorMessage(raw) {
  let msg = raw || "Something went wrong";
  try {
    const o = JSON.parse(msg);
    if (o?.detail != null) msg = typeof o.detail === "string" ? o.detail : JSON.stringify(o.detail);
  } catch {
    /* plain string */
  }
  if (/404|not found/i.test(msg)) {
    return (
      "Google AI returned 404 for the configured Gemini model (e.g. gemini-2.0-flash may be unavailable). " +
      "In backend `.env`, set GEMINI_MODEL=gemini-2.5-flash or GEMINI_MODEL=gemini-1.5-flash, save, and restart the API server."
    );
  }
  return msg.length > 420 ? `${msg.slice(0, 420)}…` : msg;
}

const Field = ({ label, value, onChange, disabled, placeholder, type = "text" }) => (
  <div className="stack" style={{ gap: 4 }}>
    <label className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>
      {label}
    </label>
    <input
      type={type}
      className="input"
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

/**
 * First-launch gate: blur + dark overlay, upload or full manual profile, then seed Profile + Resume Builder + interview candidates.
 */
export const OnboardingModal = ({ onComplete }) => {
  const [mode, setMode] = useState("choose"); // choose | manual | review
  const [profile, setProfile] = useState(() => loadProfile());
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const fileRef = useRef(null);

  const updateBasics = useCallback((field, val) => {
    setProfile((p) => ({ ...p, basics: { ...p.basics, [field]: val } }));
  }, []);

  const handleExtract = useCallback(async (file) => {
    if (!file) return;
    setExtractError(null);
    setExtracting(true);
    setMode("review");
    try {
      const parsed = await parseResumeFromUploadFile(file);
      const data = resumeParsedToProfile(parsed);
      setProfile((prev) => ({
        ...prev,
        basics: { ...prev.basics, ...data.basics },
        education: data.education.length ? data.education : prev.education,
        experience: data.experience.length ? data.experience : prev.experience,
        projects: data.projects.length ? data.projects : prev.projects,
        certifications: data.certifications.length ? data.certifications : prev.certifications,
        skills: data.skills?.length ? data.skills : prev.skills || [],
      }));
    } catch (e) {
      setExtractError(parseErrorMessage(e?.message));
      setMode("choose");
    } finally {
      setExtracting(false);
    }
  }, []);

  const finish = useCallback(() => {
    const merged = { ...emptyProfile(), ...profile };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
    localStorage.setItem(ONBOARD_KEY, "1");
    saveCandidatesFromProfile(merged);
    try {
      const data = profileToResumeData(merged);
      useResumeStore.getState().importResumeData(data);
    } catch {
      /* optional */
    }
    onComplete();
  }, [profile, onComplete]);

  const disabled = extracting;

  const expBlock = (
    <div className="card" style={{ padding: 16, background: "var(--surface-2)" }}>
      <div className="between" style={{ alignItems: "center", marginBottom: 8 }}>
        <div className="label" style={{ margin: 0 }}>
          Experience
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={() =>
            setProfile((p) => ({
              ...p,
              experience: [...p.experience, { company: "", position: "", date: "", summary: "", highlights: [] }],
            }))
          }
        >
          + Add role
        </button>
      </div>
      {profile.experience.length === 0 && (
        <div className="muted" style={{ fontSize: 12 }}>Add at least one role, or use resume upload to auto-fill.</div>
      )}
      {profile.experience.map((exp, i) => (
        <div
          key={i}
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--surface)",
          }}
        >
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Field
              label="COMPANY"
              value={exp.company}
              disabled={disabled}
              placeholder="e.g. TCS"
              onChange={(v) =>
                setProfile((p) => {
                  const nx = [...p.experience];
                  nx[i] = { ...nx[i], company: v };
                  return { ...p, experience: nx };
                })
              }
            />
            <Field
              label="ROLE / TITLE"
              value={exp.position}
              disabled={disabled}
              placeholder="e.g. Software Engineer"
              onChange={(v) =>
                setProfile((p) => {
                  const nx = [...p.experience];
                  nx[i] = { ...nx[i], position: v };
                  return { ...p, experience: nx };
                })
              }
            />
            <Field
              label="DATES"
              value={exp.date}
              disabled={disabled}
              placeholder="e.g. 2022 – Present"
              onChange={(v) =>
                setProfile((p) => {
                  const nx = [...p.experience];
                  nx[i] = { ...nx[i], date: v };
                  return { ...p, experience: nx };
                })
              }
            />
          </div>
          <div className="stack" style={{ gap: 4, marginTop: 10 }}>
            <label className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>
              SUMMARY
            </label>
            <textarea
              className="textarea"
              disabled={disabled}
              rows={2}
              value={exp.summary || ""}
              placeholder="What you did in this role"
              onChange={(e) =>
                setProfile((p) => {
                  const nx = [...p.experience];
                  nx[i] = { ...nx[i], summary: e.target.value };
                  return { ...p, experience: nx };
                })
              }
            />
          </div>
          <div className="stack" style={{ gap: 4, marginTop: 8 }}>
            <label className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>
              KEY BULLETS (ONE PER LINE)
            </label>
            <textarea
              className="textarea"
              disabled={disabled}
              rows={3}
              value={(exp.highlights || []).join("\n")}
              placeholder={"Shipped X\nReduced latency by 40%"}
              onChange={(e) => {
                const lines = e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                setProfile((p) => {
                  const nx = [...p.experience];
                  nx[i] = { ...nx[i], highlights: lines };
                  return { ...p, experience: nx };
                });
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            style={{ marginTop: 8 }}
            disabled={disabled}
            onClick={() => setProfile((p) => ({ ...p, experience: p.experience.filter((_, j) => j !== i) }))}
          >
            Remove role
          </button>
        </div>
      ))}
    </div>
  );

  const eduBlock = (
    <div className="card" style={{ padding: 16, background: "var(--surface-2)" }}>
      <div className="between" style={{ alignItems: "center", marginBottom: 8 }}>
        <div className="label" style={{ margin: 0 }}>
          Education
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={() =>
            setProfile((p) => ({
              ...p,
              education: [...p.education, { institution: "", area: "", studyType: "", score: "", date: "" }],
            }))
          }
        >
          + Add school
        </button>
      </div>
      {profile.education.length === 0 && (
        <div className="muted" style={{ fontSize: 12 }}>Add degrees or certifications issued by schools.</div>
      )}
      {profile.education.map((ed, i) => (
        <div
          key={i}
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--surface)",
          }}
        >
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {[
              ["INSTITUTION", "institution", "College / university"],
              ["DEGREE / TYPE", "studyType", "B.Tech, MBA…"],
              ["FIELD / AREA", "area", "Computer Science"],
              ["SCORE / GPA", "score", "Optional"],
              ["YEAR / RANGE", "date", "2020 – 2024"],
            ].map(([label, key, ph]) => (
              <Field
                key={key}
                label={label}
                value={ed[key]}
                disabled={disabled}
                placeholder={ph}
                onChange={(v) =>
                  setProfile((p) => {
                    const nx = [...p.education];
                    nx[i] = { ...nx[i], [key]: v };
                    return { ...p, education: nx };
                  })
                }
              />
            ))}
          </div>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            style={{ marginTop: 8 }}
            disabled={disabled}
            onClick={() => setProfile((p) => ({ ...p, education: p.education.filter((_, j) => j !== i) }))}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );

  const projBlock = (
    <div className="card" style={{ padding: 16, background: "var(--surface-2)" }}>
      <div className="between" style={{ alignItems: "center", marginBottom: 8 }}>
        <div className="label" style={{ margin: 0 }}>
          Projects
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={() =>
            setProfile((p) => ({
              ...p,
              projects: [...p.projects, { name: "", date: "", description: "", highlights: [] }],
            }))
          }
        >
          + Add project
        </button>
      </div>
      {profile.projects.map((pr, i) => (
        <div
          key={i}
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--surface)",
          }}
        >
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Field
              label="PROJECT NAME"
              value={pr.name}
              disabled={disabled}
              placeholder="Name"
              onChange={(v) =>
                setProfile((p) => {
                  const nx = [...p.projects];
                  nx[i] = { ...nx[i], name: v };
                  return { ...p, projects: nx };
                })
              }
            />
            <Field
              label="DATE / STATUS"
              value={pr.date}
              disabled={disabled}
              placeholder="2024 or ongoing"
              onChange={(v) =>
                setProfile((p) => {
                  const nx = [...p.projects];
                  nx[i] = { ...nx[i], date: v };
                  return { ...p, projects: nx };
                })
              }
            />
          </div>
          <div className="stack" style={{ gap: 4, marginTop: 8 }}>
            <label className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>
              DESCRIPTION
            </label>
            <textarea
              className="textarea"
              disabled={disabled}
              rows={2}
              value={pr.description || ""}
              onChange={(e) =>
                setProfile((p) => {
                  const nx = [...p.projects];
                  nx[i] = { ...nx[i], description: e.target.value };
                  return { ...p, projects: nx };
                })
              }
            />
          </div>
          <div className="stack" style={{ gap: 4, marginTop: 8 }}>
            <label className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>
              HIGHLIGHTS (ONE PER LINE)
            </label>
            <textarea
              className="textarea"
              disabled={disabled}
              rows={2}
              value={(pr.highlights || []).join("\n")}
              onChange={(e) => {
                const lines = e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                setProfile((p) => {
                  const nx = [...p.projects];
                  nx[i] = { ...nx[i], highlights: lines };
                  return { ...p, projects: nx };
                });
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            style={{ marginTop: 8 }}
            disabled={disabled}
            onClick={() => setProfile((p) => ({ ...p, projects: p.projects.filter((_, j) => j !== i) }))}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );

  const certBlock = (
    <div className="card" style={{ padding: 16, background: "var(--surface-2)" }}>
      <div className="between" style={{ alignItems: "center", marginBottom: 8 }}>
        <div className="label" style={{ margin: 0 }}>
          Certifications
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={() =>
            setProfile((p) => ({
              ...p,
              certifications: [...p.certifications, { name: "", issuer: "", date: "" }],
            }))
          }
        >
          + Add certification
        </button>
      </div>
      {profile.certifications.map((c, i) => (
        <div
          key={i}
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--surface)",
          }}
        >
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Field
              label="NAME"
              value={c.name}
              disabled={disabled}
              placeholder="AWS Solutions Architect"
              onChange={(v) =>
                setProfile((p) => {
                  const nx = [...p.certifications];
                  nx[i] = { ...nx[i], name: v };
                  return { ...p, certifications: nx };
                })
              }
            />
            <Field
              label="ISSUER"
              value={c.issuer}
              disabled={disabled}
              placeholder="Amazon"
              onChange={(v) =>
                setProfile((p) => {
                  const nx = [...p.certifications];
                  nx[i] = { ...nx[i], issuer: v };
                  return { ...p, certifications: nx };
                })
              }
            />
            <Field
              label="DATE"
              value={c.date}
              disabled={disabled}
              placeholder="2024"
              onChange={(v) =>
                setProfile((p) => {
                  const nx = [...p.certifications];
                  nx[i] = { ...nx[i], date: v };
                  return { ...p, certifications: nx };
                })
              }
            />
          </div>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            style={{ marginTop: 8 }}
            disabled={disabled}
            onClick={() => setProfile((p) => ({ ...p, certifications: p.certifications.filter((_, j) => j !== i) }))}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(10, 8, 6, 0.52)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-title"
        style={{
          width: "min(960px, 100%)",
          maxHeight: "min(94vh, 960px)",
          overflow: "auto",
          padding: 28,
          borderRadius: 16,
          boxShadow: "0 24px 80px -24px rgba(21,17,13,0.35)",
        }}
      >
        {mode === "choose" && (
          <div className="stack" style={{ gap: 20 }}>
            <div className="stack" style={{ gap: 8, textAlign: "center" }}>
              <div id="onboard-title" className="display" style={{ fontSize: 26 }}>
                Welcome — let’s set up your profile
              </div>
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>
                We use this to personalize mock interviews, your profile page, and your resume builder. ATS scoring stays separate until you run it from Resume ATS.
              </p>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              <button
                type="button"
                className="card"
                style={{
                  padding: 22,
                  textAlign: "left",
                  cursor: "pointer",
                  border: "2px solid var(--line)",
                  background: "var(--surface)",
                }}
                onClick={() => fileRef.current?.click()}
              >
                <Icon name="upload" size={28} style={{ color: "var(--accent)" }} />
                <div style={{ fontWeight: 800, fontSize: 16, marginTop: 12 }}>Upload your resume</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
                  PDF or DOCX. We’ll extract basics, experience, education, projects, and certifications — then you can review and edit every field before continuing.
                </div>
              </button>
              <button
                type="button"
                className="card"
                style={{
                  padding: 22,
                  textAlign: "left",
                  cursor: "pointer",
                  border: "2px solid var(--line)",
                  background: "var(--surface)",
                }}
                onClick={() => {
                  setProfile(loadProfile());
                  setMode("manual");
                }}
              >
                <Icon name="edit" size={28} style={{ color: "var(--ink)" }} />
                <div style={{ fontWeight: 800, fontSize: 16, marginTop: 12 }}>Fill details manually</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
                  Enter contact details plus experience, education, projects, and certifications — the same sections as your Profile and resume builder.
                </div>
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleExtract(f);
              }}
            />
            {extractError && (
              <div
                style={{
                  color: "var(--bad)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(176,39,31,0.08)",
                  border: "1px solid rgba(176,39,31,0.25)",
                }}
              >
                {extractError}
              </div>
            )}
          </div>
        )}

        {(mode === "manual" || mode === "review") && (
          <div className="stack" style={{ gap: 18 }}>
            <div className="between" style={{ alignItems: "flex-start", gap: 12 }}>
              <div>
                <div className="display" style={{ fontSize: 22 }}>
                  {extracting ? "Extracting your resume…" : mode === "manual" ? "Enter your profile" : "Review your profile"}
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 0 }}>
                  {extracting
                    ? "This may take up to a couple of minutes. Please keep this tab open."
                    : "Edit any section. When you continue, we save to Profile, seed Resume Builder, and use this data for personalized mock interviews."}
                </p>
              </div>
              {mode === "manual" && (
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setMode("choose")}>
                  Back
                </button>
              )}
            </div>

            <div className="card" style={{ padding: 18, background: "var(--surface-2)" }}>
              <div className="label">Basics</div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 10 }}>
                {["name", "email", "phone", "location"].map((field) => (
                  <Field
                    key={field}
                    label={field.toUpperCase()}
                    value={profile.basics[field]}
                    disabled={disabled}
                    placeholder={field === "name" ? "Full name" : field === "email" ? "you@example.com" : field}
                    type={field === "email" ? "email" : "text"}
                    onChange={(v) => updateBasics(field, v)}
                  />
                ))}
              </div>
            </div>

            {expBlock}
            {eduBlock}
            {projBlock}
            {certBlock}

            <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {mode === "review" && !extracting && (
                <button type="button" className="btn btn-quiet" onClick={() => setMode("choose")}>
                  Start over
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={extracting || !(profile.basics?.name || "").trim()}
                onClick={finish}
              >
                Save & continue to dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export function isOnboardingComplete() {
  return localStorage.getItem(ONBOARD_KEY) === "1";
}
