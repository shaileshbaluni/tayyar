import React, { useState, useEffect } from 'react';
import { Icon, Logo, Avatar } from './components/ui';
import { PERSONA } from './data';
import { TweaksPanel, TweakSection, TweakRadio, useTweaks } from './components/TweaksPanel';
import { Dashboard } from './screens/Dashboard';
import { InterviewSetup } from './screens/InterviewSetup';
import { InterviewLive } from './screens/InterviewLive';
import { Scorecard } from './screens/Scorecard';
import { AnswerBuilder } from './screens/AnswerBuilder';
import { ResumeATS } from './screens/ResumeATS';
import { ResumeBuilder } from './screens/ResumeBuilder';
import { QuestionBank } from './screens/QuestionBank';
import { Profile } from './screens/Profile';
import { SalarySimulator } from './salary/SalarySimulator';
import { LinkedInOptimizer } from './linkedin/LinkedInOptimizer';
import { Analytics } from './screens/LinkedInAnalytics';
import { OnboardingModal, isOnboardingComplete } from './components/OnboardingModal';
import { LoginScreen } from './screens/LoginScreen';
import { LandingPage } from './screens/LandingPage';
import { ResumeBuilderMarketingShell } from './screens/ResumeBuilderMarketingShell';
import { FreeMockTrialShell } from './screens/FreeMockTrialShell';
import { AdminApp } from './admin/AdminApp';
import { getRole, clearRole, setRole } from './lib/authRole';
import { useRouteNavigation } from './lib/appNavigation';
import './lib/api';

const NAV = [
  { k:"dashboard", label:"Dashboard", ico:"home" },
  { k:"setup",     label:"Mock Interview", ico:"mic", section:"PRACTICE" },
  { k:"answers",   label:"Answer Builder", ico:"edit" },
  { k:"bank",      label:"Question Bank", ico:"book" },
  { k:"salary",    label:"Salary Negotiator", ico:"money" },
  { k:"builder",   label:"Resume Builder", ico:"file", section:"CAREER" },
  { k:"resume",    label:"Resume ATS", ico:"bolt" },
  { k:"linkedin",  label:"LinkedIn", ico:"link" },
  { k:"analytics", label:"Analytics", ico:"chart", section:"INSIGHTS" },
];

const BOTTOM_NAV = [
  { k: "dashboard", label: "Home", ico: "home" },
  { k: "setup", label: "Mock", ico: "mic", routes: ["setup", "live", "scorecard"] },
  { k: "builder", label: "Resume", sublabel: "Builder", ico: "file", ariaLabel: "Resume Builder" },
  { k: "bank", label: "Bank", ico: "book" },
  { k: "analytics", label: "Stats", ico: "chart" },
];

function bottomNavActive(route, item) {
  if (item.routes) return item.routes.includes(route);
  return route === item.k;
}

const HERO_MOBILE_ROUTES = new Set(["setup", "live", "scorecard", "builder"]);

function contentClassForRoute(route) {
  let c = "content";
  if (HERO_MOBILE_ROUTES.has(route)) c += " content--hero";
  if (route === "live") c += " content--live";
  return c;
}

const TWEAK_DEFAULTS = {
  "theme": "warm",
  "density": "comfortable",
  "persona": "rahul",
  "showOnboard": false
};

/** Unauthenticated hash routes: landing, login, or one free mock interview (no app chrome). */
function readPublicEntry() {
  if (typeof window === "undefined") return "landing";
  const h = (window.location.hash || "").slice(1).toLowerCase();
  if (h === "/login") return "login";
  if (h === "/free-mock") return "freemock";
  if (h === "/resume-builder" || h === "/free-resume-builder") return "resumebuilder";
  return "landing";
}

const App = () => {
  const [appRole, setAppRole] = useState(() => getRole());
  const { route, go, back, resetStack } = useRouteNavigation("dashboard");
  const [interviewState, setInterviewState] = useState({});
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [onboardingDone, setOnboardingDone] = useState(() => isOnboardingComplete());
  const [marketingView, setMarketingView] = useState(() => readPublicEntry());

  const logoutToLogin = () => {
    clearRole();
    setAppRole(null);
    resetStack("dashboard");
    setMarketingView("landing");
    try {
      window.location.hash = "";
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (t.theme === "ink") {
      root.style.setProperty("--bg", "#15110D");
      root.style.setProperty("--surface", "#1F1A14");
      root.style.setProperty("--surface-2", "#2A241D");
      root.style.setProperty("--ink", "#F4EFE6");
      root.style.setProperty("--ink-2", "#D2C8B4");
      root.style.setProperty("--ink-3", "#A39A8C");
      root.style.setProperty("--ink-4", "#6B6357");
      root.style.setProperty("--line", "#2A241D");
      root.style.setProperty("--line-2", "#3D362C");
    } else if (t.theme === "indigo") {
      root.style.setProperty("--bg", "#F1F0F7");
      root.style.setProperty("--surface", "#FAFAFD");
      root.style.setProperty("--surface-2", "#E5E3F0");
      root.style.setProperty("--accent", "#3730A3");
      root.style.setProperty("--accent-2", "#6366F1");
      root.style.setProperty("--accent-soft", "#E0E7FF");
    } else {
      root.style.setProperty("--bg", "#F4EFE6");
      root.style.setProperty("--surface", "#FBF8F2");
      root.style.setProperty("--surface-2", "#EFE8DA");
      root.style.setProperty("--ink", "#15110D");
      root.style.setProperty("--ink-2", "#3D362C");
      root.style.setProperty("--ink-3", "#6B6357");
      root.style.setProperty("--ink-4", "#A39A8C");
      root.style.setProperty("--line", "#E2DACB");
      root.style.setProperty("--line-2", "#D2C8B4");
      root.style.setProperty("--accent", "#C2410C");
      root.style.setProperty("--accent-2", "#E47B3B");
      root.style.setProperty("--accent-soft", "#F8E6D2");
    }
  }, [t.theme]);

  useEffect(() => {
    const onHash = () => setMarketingView(readPublicEntry());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (appRole && typeof window !== "undefined" && window.location.hash) {
      const { pathname, search } = window.location;
      window.history.replaceState(null, "", pathname + search);
    }
  }, [appRole]);

  if (!appRole) {
    if (marketingView === "freemock") {
      return (
        <FreeMockTrialShell />
      );
    }
    if (marketingView === "resumebuilder") {
      return <ResumeBuilderMarketingShell />;
    }
    if (marketingView !== "login") {
      return (
        <LandingPage
          onGoToLogin={() => {
            window.location.hash = "#/login";
          }}
          onFreeMockInterview={() => {
            window.location.hash = "#/free-mock";
          }}
        />
      );
    }
    return <LoginScreen onAfterPick={(r) => setAppRole(r)} />;
  }

  if (appRole === "admin") {
    return <AdminApp onLogout={logoutToLogin} />;
  }

  const render = () => {
    switch(route) {
      case "dashboard": return <Dashboard go={go} back={back}/>;
      case "setup":     return <InterviewSetup go={go} back={back} state={interviewState} setState={setInterviewState}/>;
      case "live":      return <InterviewLive go={go} back={back} state={interviewState} setInterviewState={setInterviewState}/>;
      case "scorecard": return <Scorecard go={go} back={back} state={interviewState}/>;
      case "answers":   return <AnswerBuilder go={go} back={back}/>;
      case "builder":   return <ResumeBuilder go={go} back={back}/>;
      case "resume":    return <ResumeATS go={go} back={back}/>;
      case "bank":      return <QuestionBank go={go} back={back}/>;
      case "profile":   return <Profile go={go} back={back}/>;
      case "salary":    return <SalarySimulator go={go} back={back}/>;
      case "linkedin":  return <LinkedInOptimizer go={go} back={back}/>;
      case "analytics": return <Analytics go={go} back={back}/>;
      default:          return <Dashboard go={go} back={back}/>;
    }
  };

  return (
    <div className="app">
      {!onboardingDone && <OnboardingModal onComplete={() => setOnboardingDone(true)} />}
      <div className="app-body">
        <aside className="sidebar">
          <div style={{ padding:"6px 8px 10px" }}>
            <Logo size={26}/>
          </div>
          {NAV.map(n=>(
            <React.Fragment key={n.k}>
              {n.section && <div className="nav-section">{n.section}</div>}
              <div className={"nav-item " + (route===n.k || (n.k==="setup" && (route==="live"||route==="scorecard")) ? "active":"")}
                   onClick={() => go(n.k, { reset: true })}>
                <span className="nav-ico"><Icon name={n.ico} size={17}/></span>
                {n.label}
                {n.k==="setup" && <span className="chip chip-accent" style={{ marginLeft:"auto", fontSize:10, padding:"2px 7px" }}>Hero</span>}
              </div>
            </React.Fragment>
          ))}
          <div style={{ flex:1 }}/>
          <div className="card" style={{ padding:12, background:"var(--surface-2)" }}>
            <div className="center" style={{ gap:8, marginBottom:6 }}>
              <Icon name="flame" size={14} style={{ color:"var(--accent)" }}/>
              <span style={{ fontWeight:600, fontSize:12 }}>{PERSONA.streak}-day streak</span>
            </div>
            <div className="muted" style={{ fontSize:11, marginBottom:8 }}>Practice today to keep it alive.</div>
            <button className="btn btn-accent btn-sm" style={{ width:"100%" }} onClick={()=>go("setup")}>Quick mock</button>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ margin: "8px 8px 0", width: "calc(100% - 16px)", justifyContent: "center" }}
            onClick={logoutToLogin}
          >
            Switch account
          </button>
          <div className="center" style={{ gap:8, padding:"10px 8px 0", cursor:"pointer" }} onClick={()=>go("profile")}>
            <Avatar name={PERSONA.name} size={28}/>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:12.5, fontWeight:600 }}>{PERSONA.name}</div>
              <div className="muted" style={{ fontSize:10.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{PERSONA.email}</div>
            </div>
            <Icon name="settings" size={14} style={{ color:"var(--ink-3)", marginLeft:"auto" }}/>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <button className="btn btn-quiet btn-sm" style={{ display:"none" }}><Icon name="menu" size={16}/></button>
            <Logo size={22}/>
            <div className="center" style={{ flex:1, maxWidth:420, background:"var(--surface)", padding:"7px 12px", borderRadius:10, gap:8, border:"1px solid var(--line)", marginLeft:14 }}>
              <Icon name="search" size={14} style={{ color:"var(--ink-3)" }}/>
              <input style={{ background:"transparent", border:0, outline:0, flex:1, fontSize:13 }} placeholder="Search companies, questions, lessons..."/>
              <span className="mono muted" style={{ fontSize:11 }}>⌘K</span>
            </div>
            <span style={{ flex:1 }}/>
            <span className="chip chip-accent" style={{ fontSize:11 }}><Icon name="flame" size={11}/> {PERSONA.streak}d</span>
            <span className="chip" style={{ fontSize:11 }}><Icon name="bolt" size={11}/> {PERSONA.xp} XP</span>
            <button className="btn btn-quiet btn-sm"><Icon name="bell" size={15}/></button>
            <div style={{ cursor:"pointer", position:"relative" }} onClick={()=>go("profile")} title="My Profile">
              <Avatar name={PERSONA.name} size={28}/>
            </div>
          </div>

          <div className={contentClassForRoute(route)}>{render()}</div>
        </main>
      </div>

      {route !== "live" && (
      <nav className="bottomnav" aria-label="Main">
        {BOTTOM_NAV.map((n) => {
          const active = bottomNavActive(route, n);
          return (
            <button
              key={n.k}
              type="button"
              className={"bottomnav-item" + (active ? " active" : "")}
              aria-label={n.ariaLabel || n.label}
              aria-current={active ? "page" : undefined}
              onClick={() => go(n.k, { reset: true })}
            >
              <span className="ico"><Icon name={n.ico} size={20} /></span>
              {n.sublabel ? (
                <span className="bottomnav-label-stack">
                  <span>{n.label}</span>
                  <span className="bottomnav-label-sub">{n.sublabel}</span>
                </span>
              ) : (
                <span>{n.label}</span>
              )}
            </button>
          );
        })}
      </nav>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio
            label="Palette"
            value={t.theme}
            options={[
              { value:"warm",   label:"Warm"   },
              { value:"ink",    label:"Ink"    },
              { value:"indigo", label:"Indigo" },
            ]}
            onChange={v=>setTweak("theme", v)}
          />
        </TweakSection>
        <TweakSection label="Demo persona">
          <TweakRadio
            label="Active user"
            value={t.persona}
            options={[
              { value:"rahul",   label:"Rahul · Fresher" },
              { value:"priya",   label:"Priya · Switcher" },
              { value:"amit",    label:"Amit · MBA" },
            ]}
            onChange={v=>setTweak("persona", v)}
          />
        </TweakSection>
        <TweakSection label="Jump to screen">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {NAV.map(n=>(
              <button key={n.k} className="btn btn-ghost btn-sm" onClick={()=>go(n.k)} style={{ justifyContent:"flex-start" }}>
                <Icon name={n.ico} size={12}/> {n.label}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={()=>go("live")} style={{ justifyContent:"flex-start" }}>
              <Icon name="video" size={12}/> Live interview
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>go("scorecard")} style={{ justifyContent:"flex-start" }}>
              <Icon name="award" size={12}/> Scorecard
            </button>
          </div>
        </TweakSection>
        <TweakSection label="Dev / onboarding">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={() => {
              localStorage.removeItem("tayyar-onboarding-complete");
              window.location.reload();
            }}
          >
            Replay welcome & profile setup
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ width: "100%", justifyContent: "flex-start", marginTop: 6 }}
            onClick={logoutToLogin}
          >
            Sign out (login screen)
          </button>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

export default App;
