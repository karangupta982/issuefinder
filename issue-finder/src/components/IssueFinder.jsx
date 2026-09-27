import { useEffect, useMemo, useRef, useState } from "react";
import FilterBar from "./FilterBar";
import IssueCard from "./IssueCard";
import StatsBar from "./StatsBar";
import { useGithubIssues } from "../hooks/useGithubIssues";

// ── Filter logic ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  search: "",
  sort: "newest",
  type: "all",
  age: "all",
  comments: "all",
  goodFirst: false,
  helpWanted: false,
  triageAccepted: false,
  noComments: false,
};

function loadState() {
  try {
    const saved = localStorage.getItem("isf-state");
    if (!saved) return { repo: "", filters: DEFAULT_FILTERS };
    const p = JSON.parse(saved);
    return { repo: p.repo || "", filters: { ...DEFAULT_FILTERS, ...(p.filters || {}) } };
  } catch { return { repo: "", filters: DEFAULT_FILTERS }; }
}

// Map of type filter slug → substrings ANY label must contain (OR logic within array)
const TYPE_KEYWORDS = {
  bug:           ["bug", "defect", "regression", "crash", "fix"],
  feature:       ["feature", "enhancement", "improvement", "request", "feat"],
  support:       ["support", "question", "help"],
  documentation: ["doc", "readme", "wiki", "typo", "spelling"],
  cleanup:       ["cleanup", "chore", "refactor", "style", "lint", "test", "ci"],
};

function matchesType(labelNames, typeSlug) {
  const keywords = TYPE_KEYWORDS[typeSlug];
  if (!keywords) return false;
  return labelNames.some((n) =>
    keywords.some((kw) => n.toLowerCase().includes(kw))
  );
}

function applyFilters(issues, f) {
  let out = [...issues];
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    out = out.filter(
      (i) => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q) || String(i.number).includes(q)
    );
  }
  if (f.type !== "all") out = out.filter((i) => matchesType(i.labelNames, f.type));
  if (f.age  !== "all") { const c = Date.now() - parseInt(f.age) * 86400000; out = out.filter((i) => new Date(i.createdAt) >= c); }
  if (f.comments === "0")  out = out.filter((i) => i.comments === 0);
  if (f.comments === "1+") out = out.filter((i) => i.comments >= 1);
  if (f.comments === "5+") out = out.filter((i) => i.comments >= 5);
  if (f.goodFirst)      out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("good first")));
  if (f.helpWanted)     out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("help wanted")));
  if (f.triageAccepted) out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("accepted")));
  if (f.noComments)     out = out.filter((i) => i.comments === 0);
  out.sort((a, b) => {
    switch (f.sort) {
      case "easiest-first":    return (a._complexity ?? 50) - (b._complexity ?? 50);
      case "hardest-first":    return (b._complexity ?? 50) - (a._complexity ?? 50);
      case "newest":           return new Date(b.createdAt) - new Date(a.createdAt);
      case "oldest":           return new Date(a.createdAt) - new Date(b.createdAt);
      case "most-comments":    return b.comments - a.comments;
      case "least-comments":   return a.comments - b.comments;
      case "recently-updated": return new Date(b.updatedAt) - new Date(a.updatedAt);
      default: return 0;
    }
  });
  return out;
}

function parseRepoSlug(input) {
  if (!input) return null;
  const t = input.trim().replace(/\/$/, "");
  const m = t.match(/github\.com\/([^/]+\/[^/]+)/);
  return m ? m[1] : /^[^/]+\/[^/]+$/.test(t) ? t : null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TOKEN_OK = !!import.meta.env.VITE_GITHUB_TOKEN;

// ── Component ──────────────────────────────────────────────────────────────

export default function IssueFinder() {
  const init = loadState();
  const [repo, setRepo]       = useState(init.repo);
  const [filters, setFilters] = useState(init.filters);
  const [showRlWarning, setShowRlWarning] = useState(false);
  const [bulkCopied, setBulkCopied]       = useState(false);

  const {
    issues, status, error, progress, rlAdvisory,
    startPhase1, startPhase2, checkRateLimit, stop, reset,
  } = useGithubIssues();

  useEffect(() => {
    localStorage.setItem("isf-state", JSON.stringify({ repo, filters }));
  }, [repo, filters]);

  const filtered  = useMemo(() => applyFilters(issues, filters), [issues, filters]);
  const repoSlug  = parseRepoSlug(repo);
  const canScan   = !!repoSlug && status !== "running";
  const phase1Done = status === "done-phase1";
  const allDone    = status === "done";
  const isRunning  = status === "running";
  const rlPct      = progress.rlMax ? Math.round((progress.rl / progress.rlMax) * 100) : null;

  function handleScan() {
    if (!canScan) return;
    setShowRlWarning(false);
    startPhase1(repo);
  }

  function handleRepoChange(val) {
    setRepo(val);
    if (status !== "idle") reset();
    setShowRlWarning(false);
  }

  function handleReset() {
    reset();
    setFilters(DEFAULT_FILTERS);
    setShowRlWarning(false);
  }

  async function handlePhase2Click() {
    // Always fetch fresh rate limit before showing the advisory
    await checkRateLimit();
    setShowRlWarning(true);
  }

  function handlePhase2Confirm() {
    setShowRlWarning(false);
    startPhase2();
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      {/* ── Top bar ── */}
      <header style={{
        background: "#161b22", borderBottom: "1px solid #21262d",
        padding: "0 24px", height: 56,
        display: "flex", alignItems: "center", gap: 14,
        position: "sticky", top: 0, zIndex: 20,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="8" stroke="#388bfd" strokeWidth="1.5"/>
            <circle cx="9" cy="9" r="3.5" fill="#388bfd"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", letterSpacing: "-0.01em" }}>
            IssueFinder
          </span>
        </div>

        {/* Repo input */}
        <div style={{ flex: 1, maxWidth: 460, position: "relative" }}>
          <input
            type="text"
            value={repo}
            onChange={(e) => handleRepoChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="github.com/owner/repo  or  owner/repo"
            style={{
              width: "100%", padding: "7px 12px",
              borderRadius: 6, outline: "none",
              border: `1px solid ${repoSlug ? "#388bfd" : "#30363d"}`,
              background: "#0d1117", color: "#e6edf3", fontSize: 13,
              transition: "border-color 0.15s",
            }}
          />
          {repoSlug && (
            <span style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              fontSize: 10, color: "#56d364", fontWeight: 600, pointerEvents: "none",
            }}>
              {repoSlug}
            </span>
          )}
        </div>

        {/* Scan / Stop */}
        {!isRunning ? (
          <button onClick={handleScan} disabled={!canScan} style={btnStyle(canScan ? "#238636" : "#21262d", canScan ? "#fff" : "#484f58", !canScan)}>
            {phase1Done || allDone ? "Re-scan" : "Scan"}
          </button>
        ) : (
          <button onClick={stop} style={btnStyle("#da3633", "#fff")}>Stop</button>
        )}

        {(phase1Done || allDone || issues.length > 0) && (
          <button onClick={handleReset} style={{
            padding: "7px 12px", borderRadius: 6,
            border: "1px solid #30363d", background: "transparent",
            color: "#8b949e", fontSize: 13, cursor: "pointer", flexShrink: 0,
          }}>
            Clear
          </button>
        )}

        {/* Rate limit + token status */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          {progress.rl !== null && (
            <span style={{ fontSize: 11, color: rlPct !== null && rlPct < 20 ? "#f87171" : "#484f58" }}>
              {progress.rl}/{progress.rlMax} remaining
            </span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
            background: TOKEN_OK ? "#1a3c34" : "#2d2208",
            color:      TOKEN_OK ? "#56d364" : "#fbbf24",
            border:     `1px solid ${TOKEN_OK ? "#1f6f47" : "#6e4c05"}`,
          }}>
            {TOKEN_OK ? "Token active" : "No token"}
          </span>
        </div>
      </header>

      {/* ── Progress bar ── */}
      {isRunning && (
        <div style={{ height: 2, background: "#21262d" }}>
          <div style={{
            height: "100%",
            background: progress.phase === "checking" ? "#388bfd" : "#238636",
            width: progress.phase === "checking" && progress.fetched > 0
              ? `${50 + Math.round((progress.checked / progress.fetched) * 50)}%`
              : `${Math.min(48, Math.max(4, progress.page * 2))}%`,
            transition: "width 0.35s ease, background 0.3s ease",
          }}/>
        </div>
      )}

      {/* ── Error banner ── */}
      {status === "error" && (
        <div style={{ background: "#3d1c1e", borderBottom: "1px solid #f8514933", padding: "10px 24px", color: "#ff7b72", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Main ── */}
      <main style={{ maxWidth: 940, margin: "0 auto", padding: "24px 24px 60px" }}>

        {/* Idle */}
        {status === "idle" && (
          <div style={{ paddingTop: 80, textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 48, height: 48, borderRadius: 12,
              background: "#161b22", border: "1px solid #21262d", marginBottom: 20,
            }}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" stroke="#388bfd" strokeWidth="1.5"/>
                <path d="M16.5 16.5L21 21" stroke="#388bfd" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ fontSize: 17, fontWeight: 600, color: "#e6edf3", margin: "0 0 8px" }}>
              Find contribution-ready issues
            </p>
            <p style={{ fontSize: 13, color: "#8b949e", margin: "0 0 28px", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
              Enter any public GitHub repo above. Phase 1 finds open issues with no assignee. Phase 2 (optional) removes any that have a linked PR.
            </p>
            {!TOKEN_OK && (
              <div style={{
                display: "inline-block", textAlign: "left",
                background: "#161b22", border: "1px solid #6e4c05",
                borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#e3b341", maxWidth: 400,
              }}>
                <strong style={{ display: "block", marginBottom: 4 }}>Token not configured</strong>
                Add <Code>VITE_GITHUB_TOKEN=ghp_...</Code> to your <Code>.env</Code> and restart Vite.
                Without it you're limited to 60 API req/hr — Phase 2 may hit that wall.
              </div>
            )}
          </div>
        )}

        {/* Phase 1 scanning */}
        {isRunning && progress.phase === "scanning" && (
          <StatusRow color="#238636">
            Fetching issues — page {progress.page}, {progress.fetched} found so far
          </StatusRow>
        )}

        {/* Phase 2 checking */}
        {isRunning && progress.phase === "checking" && (
          <StatusRow color="#388bfd">
            Checking for linked PRs — {progress.checked} / {progress.fetched} issues checked
            {progress.found > 0 && <span style={{ color: "#56d364", marginLeft: 8 }}>· {progress.found} clean</span>}
          </StatusRow>
        )}

        {/* ── Phase 2 CTA — shown after Phase 1 completes ── */}
        {(phase1Done || allDone) && issues.length > 0 && (
          <Phase2Panel
            status={status}
            progress={progress}
            rlAdvisory={rlAdvisory}
            showWarning={showRlWarning}
            onCheckRl={handlePhase2Click}
            onConfirm={handlePhase2Confirm}
            onDismiss={() => setShowRlWarning(false)}
            isRunning={isRunning}
          />
        )}

        {/* Stats */}
        {issues.length > 0 && <StatsBar issues={issues} filtered={filtered.length} filters={filters} onFilter={setFilters} />}

        {/* Filters + bulk copy */}
        {issues.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <FilterBar filters={filters} onChange={setFilters} total={issues.length} filtered={filtered.length} />
            </div>
            {filtered.length > 0 && (
              <button
                onClick={() => {
                  const text = filtered.map((i) => i.url).join("\n");
                  navigator.clipboard.writeText(text).then(() => {
                    setBulkCopied(true);
                    setTimeout(() => setBulkCopied(false), 2000);
                  });
                }}
                title={`Copy ${filtered.length} issue URL${filtered.length !== 1 ? "s" : ""} to clipboard`}
                style={{
                  marginTop: 12,
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: `1px solid ${bulkCopied ? "#238636" : "#30363d"}`,
                  background: bulkCopied ? "#1a3c3480" : "transparent",
                  color: bulkCopied ? "#56d364" : "#8b949e",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                {bulkCopied ? `✓ Copied ${filtered.length}` : `Copy ${filtered.length} URLs`}
              </button>
            )}
          </div>
        )}

        {/* No match */}
        {(phase1Done || allDone) && issues.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 12 }}>No issues match these filters.</p>
            <button onClick={() => setFilters(DEFAULT_FILTERS)} style={btnStyle("#21262d", "#8b949e")}>
              Clear filters
            </button>
          </div>
        )}

        {/* Issue list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((issue) => <IssueCard key={issue.number} issue={issue} />)}
        </div>

        {/* Footer */}
        {(phase1Done || allDone) && issues.length > 0 && (
          <div style={{ marginTop: 28, textAlign: "center", fontSize: 11, color: "#484f58" }}>
            {allDone && progress.fetched > 0
              ? `${progress.fetched} fetched → ${issues.length} with no linked PR · ${filtered.length} shown`
              : `${issues.length} issues · ${filtered.length} shown`}
            {" · "}{repoSlug}
          </div>
        )}
      </main>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #161b22; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
        input::placeholder { color: #484f58; }
        select option { background: #161b22; color: #e6edf3; }
      `}</style>
    </div>
  );
}

// ── Phase 2 panel ──────────────────────────────────────────────────────────

function Phase2Panel({ status, progress, rlAdvisory, showWarning, onCheckRl, onConfirm, onDismiss }) {
  const allDone    = status === "done";
  const phase1Done = status === "done-phase1";

  // Color-coded rate-limit sufficiency
  const enough = rlAdvisory ? rlAdvisory.remaining >= rlAdvisory.needed : null;
  const tight   = rlAdvisory ? rlAdvisory.remaining >= rlAdvisory.needed * 0.5 && !enough : false;

  return (
    <div style={{
      background: "#161b22",
      border: "1px solid #21262d",
      borderRadius: 10,
      padding: "14px 18px",
      marginBottom: 20,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 2 }}>
            {allDone ? "PR filter applied" : "Filter out issues with linked PRs"}
          </div>
          <div style={{ fontSize: 12, color: "#8b949e" }}>
            {allDone
              ? `${progress.fetched} candidates → ${progress.found} with no linked PR (open or merged)`
              : `Phase 1 found ${progress.fetched} issues. Phase 2 checks each one's timeline for any linked PR — open, merged, or closed.`}
          </div>
        </div>

        {phase1Done && (
          <button
            onClick={onCheckRl}
            style={btnStyle("#1f6feb", "#79c0ff")}
          >
            Check linked PRs
          </button>
        )}

        {allDone && (
          <span style={{
            fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 99,
            background: "#1a3c34", color: "#56d364", border: "1px solid #1f6f47",
          }}>
            Done
          </span>
        )}
      </div>

      {/* Rate-limit advisory — shown after user clicks the button */}
      {showWarning && rlAdvisory && (
        <div style={{
          background: "#0d1117",
          border: `1px solid ${enough ? "#1f6f47" : tight ? "#6e4c05" : "#8b1a1a"}`,
          borderRadius: 8,
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
          {/* Traffic-light row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: enough ? "#56d364" : tight ? "#fbbf24" : "#f87171",
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: enough ? "#56d364" : tight ? "#fbbf24" : "#f87171" }}>
              {enough
                ? "You have enough API calls"
                : tight
                  ? "You might run out mid-way"
                  : "Rate limit too low — Phase 2 will likely fail"}
            </span>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <RlStat label="Issues to check" value={rlAdvisory.needed} color="#e6edf3" />
            <RlStat label="API calls remaining" value={rlAdvisory.remaining} color={enough ? "#56d364" : "#f87171"} />
            <RlStat label="Total limit" value={rlAdvisory.limit} color="#8b949e" />
          </div>

          {!enough && rlAdvisory.resetAt && (
            <p style={{ fontSize: 12, color: "#8b949e", margin: 0 }}>
              Limit resets at <strong style={{ color: "#e6edf3" }}>{rlAdvisory.resetAt.toLocaleTimeString()}</strong>.
              {!TOKEN_OK && " Add VITE_GITHUB_TOKEN to your .env for 5000 req/hr."}
            </p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onConfirm} style={btnStyle(enough ? "#238636" : "#8b1a1a", "#fff")}>
              {enough ? "Run Phase 2" : "Run anyway (may fail)"}
            </button>
            <button onClick={onDismiss} style={btnStyle("#21262d", "#8b949e")}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function StatusRow({ color, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      fontSize: 12, color: "#8b949e", marginBottom: 16,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0,
        animation: "blink 1.1s ease-in-out infinite",
      }} />
      {children}
    </div>
  );
}

function RlStat({ label, value, color }) {
  return (
    <div style={{ background: "#161b22", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#8b949e", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Code({ children }) {
  return (
    <code style={{ background: "#0d1117", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>
      {children}
    </code>
  );
}

function btnStyle(bg, color, disabled = false) {
  return {
    padding: "7px 14px", borderRadius: 6, border: "none",
    background: bg, color, fontSize: 13, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0,
    opacity: disabled ? 0.5 : 1,
  };
}











// import { useEffect, useMemo, useRef, useState } from "react";
// import FilterBar from "./FilterBar";
// import IssueCard from "./IssueCard";
// import StatsBar from "./StatsBar";
// import { useGithubIssues } from "../hooks/useGithubIssues";

// // ── Filter logic ───────────────────────────────────────────────────────────

// const DEFAULT_FILTERS = {
//   search: "",
//   sort: "newest",
//   type: "all",
//   age: "all",
//   comments: "all",
//   goodFirst: false,
//   helpWanted: false,
//   triageAccepted: false,
//   noComments: false,
// };

// function loadState() {
//   try {
//     const saved = localStorage.getItem("isf-state");
//     if (!saved) return { repo: "", filters: DEFAULT_FILTERS };
//     const p = JSON.parse(saved);
//     return { repo: p.repo || "", filters: { ...DEFAULT_FILTERS, ...(p.filters || {}) } };
//   } catch { return { repo: "", filters: DEFAULT_FILTERS }; }
// }

// function applyFilters(issues, f) {
//   let out = [...issues];
//   if (f.search.trim()) {
//     const q = f.search.trim().toLowerCase();
//     out = out.filter(
//       (i) => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q) || String(i.number).includes(q)
//     );
//   }
//   if (f.type !== "all")  out = out.filter((i) => i.labelNames.includes(f.type));
//   if (f.age  !== "all")  { const c = Date.now() - parseInt(f.age) * 86400000; out = out.filter((i) => new Date(i.createdAt) >= c); }
//   if (f.comments === "0")  out = out.filter((i) => i.comments === 0);
//   if (f.comments === "1+") out = out.filter((i) => i.comments >= 1);
//   if (f.comments === "5+") out = out.filter((i) => i.comments >= 5);
//   if (f.goodFirst)      out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("good first")));
//   if (f.helpWanted)     out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("help wanted")));
//   if (f.triageAccepted) out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("accepted")));
//   if (f.noComments)     out = out.filter((i) => i.comments === 0);
//   out.sort((a, b) => {
//     switch (f.sort) {
//       case "newest":           return new Date(b.createdAt) - new Date(a.createdAt);
//       case "oldest":           return new Date(a.createdAt) - new Date(b.createdAt);
//       case "most-comments":    return b.comments - a.comments;
//       case "least-comments":   return a.comments - b.comments;
//       case "recently-updated": return new Date(b.updatedAt) - new Date(a.updatedAt);
//       default: return 0;
//     }
//   });
//   return out;
// }

// function parseRepoSlug(input) {
//   if (!input) return null;
//   const t = input.trim().replace(/\/$/, "");
//   const m = t.match(/github\.com\/([^/]+\/[^/]+)/);
//   return m ? m[1] : /^[^/]+\/[^/]+$/.test(t) ? t : null;
// }

// // ── Constants ──────────────────────────────────────────────────────────────

// const TOKEN_OK = !!import.meta.env.VITE_GITHUB_TOKEN;

// // ── Component ──────────────────────────────────────────────────────────────

// export default function IssueFinder() {
//   const init = loadState();
//   const [repo, setRepo]       = useState(init.repo);
//   const [filters, setFilters] = useState(init.filters);
//   const [showRlWarning, setShowRlWarning] = useState(false);
//   const [bulkCopied, setBulkCopied]       = useState(false);

//   const {
//     issues, status, error, progress, rlAdvisory,
//     startPhase1, startPhase2, checkRateLimit, stop, reset,
//   } = useGithubIssues();

//   useEffect(() => {
//     localStorage.setItem("isf-state", JSON.stringify({ repo, filters }));
//   }, [repo, filters]);

//   const filtered  = useMemo(() => applyFilters(issues, filters), [issues, filters]);
//   const repoSlug  = parseRepoSlug(repo);
//   const canScan   = !!repoSlug && status !== "running";
//   const phase1Done = status === "done-phase1";
//   const allDone    = status === "done";
//   const isRunning  = status === "running";
//   const rlPct      = progress.rlMax ? Math.round((progress.rl / progress.rlMax) * 100) : null;

//   function handleScan() {
//     if (!canScan) return;
//     setShowRlWarning(false);
//     startPhase1(repo);
//   }

//   function handleRepoChange(val) {
//     setRepo(val);
//     if (status !== "idle") reset();
//     setShowRlWarning(false);
//   }

//   function handleReset() {
//     reset();
//     setFilters(DEFAULT_FILTERS);
//     setShowRlWarning(false);
//   }

//   async function handlePhase2Click() {
//     // Always fetch fresh rate limit before showing the advisory
//     await checkRateLimit();
//     setShowRlWarning(true);
//   }

//   function handlePhase2Confirm() {
//     setShowRlWarning(false);
//     startPhase2();
//   }

//   // ── Render ─────────────────────────────────────────────────────────────

//   return (
//     <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3",
//       fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

//       {/* ── Top bar ── */}
//       <header style={{
//         background: "#161b22", borderBottom: "1px solid #21262d",
//         padding: "0 24px", height: 56,
//         display: "flex", alignItems: "center", gap: 14,
//         position: "sticky", top: 0, zIndex: 20,
//       }}>
//         {/* Logo */}
//         <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
//           <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
//             <circle cx="9" cy="9" r="8" stroke="#388bfd" strokeWidth="1.5"/>
//             <circle cx="9" cy="9" r="3.5" fill="#388bfd"/>
//           </svg>
//           <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", letterSpacing: "-0.01em" }}>
//             IssueFinder
//           </span>
//         </div>

//         {/* Repo input */}
//         <div style={{ flex: 1, maxWidth: 460, position: "relative" }}>
//           <input
//             type="text"
//             value={repo}
//             onChange={(e) => handleRepoChange(e.target.value)}
//             onKeyDown={(e) => e.key === "Enter" && handleScan()}
//             placeholder="github.com/owner/repo  or  owner/repo"
//             style={{
//               width: "100%", padding: "7px 12px",
//               borderRadius: 6, outline: "none",
//               border: `1px solid ${repoSlug ? "#388bfd" : "#30363d"}`,
//               background: "#0d1117", color: "#e6edf3", fontSize: 13,
//               transition: "border-color 0.15s",
//             }}
//           />
//           {repoSlug && (
//             <span style={{
//               position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
//               fontSize: 10, color: "#56d364", fontWeight: 600, pointerEvents: "none",
//             }}>
//               {repoSlug}
//             </span>
//           )}
//         </div>

//         {/* Scan / Stop */}
//         {!isRunning ? (
//           <button onClick={handleScan} disabled={!canScan} style={btnStyle(canScan ? "#238636" : "#21262d", canScan ? "#fff" : "#484f58", !canScan)}>
//             {phase1Done || allDone ? "Re-scan" : "Scan"}
//           </button>
//         ) : (
//           <button onClick={stop} style={btnStyle("#da3633", "#fff")}>Stop</button>
//         )}

//         {(phase1Done || allDone || issues.length > 0) && (
//           <button onClick={handleReset} style={{
//             padding: "7px 12px", borderRadius: 6,
//             border: "1px solid #30363d", background: "transparent",
//             color: "#8b949e", fontSize: 13, cursor: "pointer", flexShrink: 0,
//           }}>
//             Clear
//           </button>
//         )}

//         {/* Rate limit + token status */}
//         <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
//           {progress.rl !== null && (
//             <span style={{ fontSize: 11, color: rlPct !== null && rlPct < 20 ? "#f87171" : "#484f58" }}>
//               {progress.rl}/{progress.rlMax} remaining
//             </span>
//           )}
//           <span style={{
//             fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
//             background: TOKEN_OK ? "#1a3c34" : "#2d2208",
//             color:      TOKEN_OK ? "#56d364" : "#fbbf24",
//             border:     `1px solid ${TOKEN_OK ? "#1f6f47" : "#6e4c05"}`,
//           }}>
//             {TOKEN_OK ? "Token active" : "No token"}
//           </span>
//         </div>
//       </header>

//       {/* ── Progress bar ── */}
//       {isRunning && (
//         <div style={{ height: 2, background: "#21262d" }}>
//           <div style={{
//             height: "100%",
//             background: progress.phase === "checking" ? "#388bfd" : "#238636",
//             width: progress.phase === "checking" && progress.fetched > 0
//               ? `${50 + Math.round((progress.checked / progress.fetched) * 50)}%`
//               : `${Math.min(48, Math.max(4, progress.page * 2))}%`,
//             transition: "width 0.35s ease, background 0.3s ease",
//           }}/>
//         </div>
//       )}

//       {/* ── Error banner ── */}
//       {status === "error" && (
//         <div style={{ background: "#3d1c1e", borderBottom: "1px solid #f8514933", padding: "10px 24px", color: "#ff7b72", fontSize: 13 }}>
//           {error}
//         </div>
//       )}

//       {/* ── Main ── */}
//       <main style={{ maxWidth: 940, margin: "0 auto", padding: "24px 24px 60px" }}>

//         {/* Idle */}
//         {status === "idle" && (
//           <div style={{ paddingTop: 80, textAlign: "center" }}>
//             <div style={{
//               display: "inline-flex", alignItems: "center", justifyContent: "center",
//               width: 48, height: 48, borderRadius: 12,
//               background: "#161b22", border: "1px solid #21262d", marginBottom: 20,
//             }}>
//               <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
//                 <circle cx="11" cy="11" r="7" stroke="#388bfd" strokeWidth="1.5"/>
//                 <path d="M16.5 16.5L21 21" stroke="#388bfd" strokeWidth="1.5" strokeLinecap="round"/>
//               </svg>
//             </div>
//             <p style={{ fontSize: 17, fontWeight: 600, color: "#e6edf3", margin: "0 0 8px" }}>
//               Find contribution-ready issues
//             </p>
//             <p style={{ fontSize: 13, color: "#8b949e", margin: "0 0 28px", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
//               Enter any public GitHub repo above. Phase 1 finds open issues with no assignee. Phase 2 (optional) removes any that have a linked PR.
//             </p>
//             {!TOKEN_OK && (
//               <div style={{
//                 display: "inline-block", textAlign: "left",
//                 background: "#161b22", border: "1px solid #6e4c05",
//                 borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#e3b341", maxWidth: 400,
//               }}>
//                 <strong style={{ display: "block", marginBottom: 4 }}>Token not configured</strong>
//                 Add <Code>VITE_GITHUB_TOKEN=ghp_...</Code> to your <Code>.env</Code> and restart Vite.
//                 Without it you're limited to 60 API req/hr — Phase 2 may hit that wall.
//               </div>
//             )}
//           </div>
//         )}

//         {/* Phase 1 scanning */}
//         {isRunning && progress.phase === "scanning" && (
//           <StatusRow color="#238636">
//             Fetching issues — page {progress.page}, {progress.fetched} found so far
//           </StatusRow>
//         )}

//         {/* Phase 2 checking */}
//         {isRunning && progress.phase === "checking" && (
//           <StatusRow color="#388bfd">
//             Checking for linked PRs — {progress.checked} / {progress.fetched} issues checked
//             {progress.found > 0 && <span style={{ color: "#56d364", marginLeft: 8 }}>· {progress.found} clean</span>}
//           </StatusRow>
//         )}

//         {/* ── Phase 2 CTA — shown after Phase 1 completes ── */}
//         {(phase1Done || allDone) && issues.length > 0 && (
//           <Phase2Panel
//             status={status}
//             progress={progress}
//             rlAdvisory={rlAdvisory}
//             showWarning={showRlWarning}
//             onCheckRl={handlePhase2Click}
//             onConfirm={handlePhase2Confirm}
//             onDismiss={() => setShowRlWarning(false)}
//             isRunning={isRunning}
//           />
//         )}

//         {/* Stats */}
//         {issues.length > 0 && <StatsBar issues={issues} filtered={filtered.length} filters={filters} onFilter={setFilters} />}

//         {/* Filters + bulk copy */}
//         {issues.length > 0 && (
//           <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
//             <div style={{ flex: 1 }}>
//               <FilterBar filters={filters} onChange={setFilters} total={issues.length} filtered={filtered.length} />
//             </div>
//             {filtered.length > 0 && (
//               <button
//                 onClick={() => {
//                   const text = filtered.map((i) => i.url).join("\n");
//                   navigator.clipboard.writeText(text).then(() => {
//                     setBulkCopied(true);
//                     setTimeout(() => setBulkCopied(false), 2000);
//                   });
//                 }}
//                 title={`Copy ${filtered.length} issue URL${filtered.length !== 1 ? "s" : ""} to clipboard`}
//                 style={{
//                   marginTop: 12,
//                   padding: "7px 14px",
//                   borderRadius: 6,
//                   border: `1px solid ${bulkCopied ? "#238636" : "#30363d"}`,
//                   background: bulkCopied ? "#1a3c3480" : "transparent",
//                   color: bulkCopied ? "#56d364" : "#8b949e",
//                   fontSize: 12,
//                   fontWeight: 600,
//                   cursor: "pointer",
//                   whiteSpace: "nowrap",
//                   flexShrink: 0,
//                   transition: "all 0.15s",
//                 }}
//               >
//                 {bulkCopied ? `✓ Copied ${filtered.length}` : `Copy ${filtered.length} URLs`}
//               </button>
//             )}
//           </div>
//         )}

//         {/* No match */}
//         {(phase1Done || allDone) && issues.length > 0 && filtered.length === 0 && (
//           <div style={{ textAlign: "center", padding: "48px 0" }}>
//             <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 12 }}>No issues match these filters.</p>
//             <button onClick={() => setFilters(DEFAULT_FILTERS)} style={btnStyle("#21262d", "#8b949e")}>
//               Clear filters
//             </button>
//           </div>
//         )}

//         {/* Issue list */}
//         <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
//           {filtered.map((issue) => <IssueCard key={issue.number} issue={issue} />)}
//         </div>

//         {/* Footer */}
//         {(phase1Done || allDone) && issues.length > 0 && (
//           <div style={{ marginTop: 28, textAlign: "center", fontSize: 11, color: "#484f58" }}>
//             {allDone && progress.fetched > 0
//               ? `${progress.fetched} fetched → ${issues.length} with no linked PR · ${filtered.length} shown`
//               : `${issues.length} issues · ${filtered.length} shown`}
//             {" · "}{repoSlug}
//           </div>
//         )}
//       </main>

//       <style>{`
//         * { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
//         ::-webkit-scrollbar { width: 6px; height: 6px; }
//         ::-webkit-scrollbar-track { background: #161b22; }
//         ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
//         input::placeholder { color: #484f58; }
//         select option { background: #161b22; color: #e6edf3; }
//       `}</style>
//     </div>
//   );
// }

// // ── Phase 2 panel ──────────────────────────────────────────────────────────

// function Phase2Panel({ status, progress, rlAdvisory, showWarning, onCheckRl, onConfirm, onDismiss }) {
//   const allDone    = status === "done";
//   const phase1Done = status === "done-phase1";

//   // Color-coded rate-limit sufficiency
//   const enough = rlAdvisory ? rlAdvisory.remaining >= rlAdvisory.needed : null;
//   const tight   = rlAdvisory ? rlAdvisory.remaining >= rlAdvisory.needed * 0.5 && !enough : false;

//   return (
//     <div style={{
//       background: "#161b22",
//       border: "1px solid #21262d",
//       borderRadius: 10,
//       padding: "14px 18px",
//       marginBottom: 20,
//       display: "flex",
//       flexDirection: "column",
//       gap: 12,
//     }}>
//       <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
//         <div style={{ flex: 1 }}>
//           <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 2 }}>
//             {allDone ? "PR filter applied" : "Filter out issues with linked PRs"}
//           </div>
//           <div style={{ fontSize: 12, color: "#8b949e" }}>
//             {allDone
//               ? `${progress.fetched} candidates → ${progress.found} with no linked PR (open or merged)`
//               : `Phase 1 found ${progress.fetched} issues. Phase 2 checks each one's timeline for any linked PR — open, merged, or closed.`}
//           </div>
//         </div>

//         {phase1Done && (
//           <button
//             onClick={onCheckRl}
//             style={btnStyle("#1f6feb", "#79c0ff")}
//           >
//             Check linked PRs
//           </button>
//         )}

//         {allDone && (
//           <span style={{
//             fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 99,
//             background: "#1a3c34", color: "#56d364", border: "1px solid #1f6f47",
//           }}>
//             Done
//           </span>
//         )}
//       </div>

//       {/* Rate-limit advisory — shown after user clicks the button */}
//       {showWarning && rlAdvisory && (
//         <div style={{
//           background: "#0d1117",
//           border: `1px solid ${enough ? "#1f6f47" : tight ? "#6e4c05" : "#8b1a1a"}`,
//           borderRadius: 8,
//           padding: "12px 14px",
//           display: "flex",
//           flexDirection: "column",
//           gap: 10,
//         }}>
//           {/* Traffic-light row */}
//           <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//             <span style={{
//               width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
//               background: enough ? "#56d364" : tight ? "#fbbf24" : "#f87171",
//             }} />
//             <span style={{ fontSize: 13, fontWeight: 600, color: enough ? "#56d364" : tight ? "#fbbf24" : "#f87171" }}>
//               {enough
//                 ? "You have enough API calls"
//                 : tight
//                   ? "You might run out mid-way"
//                   : "Rate limit too low — Phase 2 will likely fail"}
//             </span>
//           </div>

//           {/* Stats */}
//           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
//             <RlStat label="Issues to check" value={rlAdvisory.needed} color="#e6edf3" />
//             <RlStat label="API calls remaining" value={rlAdvisory.remaining} color={enough ? "#56d364" : "#f87171"} />
//             <RlStat label="Total limit" value={rlAdvisory.limit} color="#8b949e" />
//           </div>

//           {!enough && rlAdvisory.resetAt && (
//             <p style={{ fontSize: 12, color: "#8b949e", margin: 0 }}>
//               Limit resets at <strong style={{ color: "#e6edf3" }}>{rlAdvisory.resetAt.toLocaleTimeString()}</strong>.
//               {!TOKEN_OK && " Add VITE_GITHUB_TOKEN to your .env for 5000 req/hr."}
//             </p>
//           )}

//           <div style={{ display: "flex", gap: 8 }}>
//             <button onClick={onConfirm} style={btnStyle(enough ? "#238636" : "#8b1a1a", "#fff")}>
//               {enough ? "Run Phase 2" : "Run anyway (may fail)"}
//             </button>
//             <button onClick={onDismiss} style={btnStyle("#21262d", "#8b949e")}>
//               Cancel
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// // ── Small helpers ──────────────────────────────────────────────────────────

// function StatusRow({ color, children }) {
//   return (
//     <div style={{
//       display: "flex", alignItems: "center", gap: 8,
//       fontSize: 12, color: "#8b949e", marginBottom: 16,
//     }}>
//       <span style={{
//         width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0,
//         animation: "blink 1.1s ease-in-out infinite",
//       }} />
//       {children}
//     </div>
//   );
// }

// function RlStat({ label, value, color }) {
//   return (
//     <div style={{ background: "#161b22", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
//       <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
//       <div style={{ fontSize: 10, color: "#8b949e", marginTop: 2 }}>{label}</div>
//     </div>
//   );
// }

// function Code({ children }) {
//   return (
//     <code style={{ background: "#0d1117", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>
//       {children}
//     </code>
//   );
// }

// function btnStyle(bg, color, disabled = false) {
//   return {
//     padding: "7px 14px", borderRadius: 6, border: "none",
//     background: bg, color, fontSize: 13, fontWeight: 600,
//     cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0,
//     opacity: disabled ? 0.5 : 1,
//   };
// }






// // // // import { useEffect, useMemo, useRef, useState } from "react";
// // // // import FilterBar from "./FilterBar";
// // // // import IssueCard from "./IssueCard";
// // // // import StatsBar from "./StatsBar";
// // // // import { useGithubIssues } from "../hooks/useGithubIssues";

// // // // const DEFAULT_FILTERS = {
// // // //   search: "",
// // // //   sort: "newest",
// // // //   type: "all",
// // // //   age: "all",
// // // //   comments: "all",
// // // //   goodFirst: false,
// // // //   helpWanted: false,
// // // //   triageAccepted: false,
// // // //   noComments: false,
// // // // };

// // // // function loadState() {
// // // //   try {
// // // //     const saved = localStorage.getItem("isf-state");
// // // //     if (!saved) return { repo: "", filters: DEFAULT_FILTERS };
// // // //     const parsed = JSON.parse(saved);
// // // //     return {
// // // //       repo: parsed.repo || "",
// // // //       filters: { ...DEFAULT_FILTERS, ...(parsed.filters || {}) },
// // // //     };
// // // //   } catch {
// // // //     return { repo: "", filters: DEFAULT_FILTERS };
// // // //   }
// // // // }

// // // // function applyFilters(issues, f) {
// // // //   let out = [...issues];

// // // //   if (f.search.trim()) {
// // // //     const q = f.search.trim().toLowerCase();
// // // //     out = out.filter(
// // // //       (i) =>
// // // //         i.title.toLowerCase().includes(q) ||
// // // //         i.body.toLowerCase().includes(q) ||
// // // //         String(i.number).includes(q)
// // // //     );
// // // //   }

// // // //   if (f.type !== "all") out = out.filter((i) => i.labelNames.includes(f.type));

// // // //   if (f.age !== "all") {
// // // //     const cutoff = Date.now() - parseInt(f.age) * 86400000;
// // // //     out = out.filter((i) => new Date(i.createdAt).getTime() >= cutoff);
// // // //   }

// // // //   if (f.comments === "0")  out = out.filter((i) => i.comments === 0);
// // // //   if (f.comments === "1+") out = out.filter((i) => i.comments >= 1);
// // // //   if (f.comments === "5+") out = out.filter((i) => i.comments >= 5);

// // // //   if (f.goodFirst)      out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("good first")));
// // // //   if (f.helpWanted)     out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("help wanted")));
// // // //   if (f.triageAccepted) out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("accepted")));
// // // //   if (f.noComments)     out = out.filter((i) => i.comments === 0);

// // // //   out.sort((a, b) => {
// // // //     switch (f.sort) {
// // // //       case "newest":           return new Date(b.createdAt) - new Date(a.createdAt);
// // // //       case "oldest":           return new Date(a.createdAt) - new Date(b.createdAt);
// // // //       case "most-comments":    return b.comments - a.comments;
// // // //       case "least-comments":   return a.comments - b.comments;
// // // //       case "recently-updated": return new Date(b.updatedAt) - new Date(a.updatedAt);
// // // //       default:                 return 0;
// // // //     }
// // // //   });

// // // //   return out;
// // // // }

// // // // function parseRepoSlug(input) {
// // // //   if (!input) return null;
// // // //   const trimmed = input.trim().replace(/\/$/, "");
// // // //   const urlMatch = trimmed.match(/github\.com\/([^/]+\/[^/]+)/);
// // // //   if (urlMatch) return urlMatch[1];
// // // //   if (/^[^/]+\/[^/]+$/.test(trimmed)) return trimmed;
// // // //   return null;
// // // // }

// // // // const TOKEN_OK = !import.meta.env.VITE_GITHUB_TOKEN;

// // // // export default function IssueFinder() {
// // // //   const init = loadState();
// // // //   const [repo, setRepo]       = useState(init.repo);
// // // //   const [filters, setFilters] = useState(init.filters);
// // // //   const { issues, status, error, progress, start, stop, reset } = useGithubIssues();
// // // //   const inputRef = useRef(null);

// // // //   useEffect(() => {
// // // //     localStorage.setItem("isf-state", JSON.stringify({ repo, filters }));
// // // //   }, [repo, filters]);

// // // //   const filtered = useMemo(() => applyFilters(issues, filters), [issues, filters]);
// // // //   const repoSlug = parseRepoSlug(repo);
// // // //   const canScan  = !!repoSlug && status !== "running";

// // // //   function handleScan() {
// // // //     if (!canScan) return;
// // // //     start(repo);
// // // //   }

// // // //   function handleKeyDown(e) {
// // // //     if (e.key === "Enter") handleScan();
// // // //   }

// // // //   function handleReset() {
// // // //     reset();
// // // //     setFilters(DEFAULT_FILTERS);
// // // //   }

// // // //   const rlPct = progress.rlMax ? Math.round((progress.rl / progress.rlMax) * 100) : null;

// // // //   return (
// // // //     <div style={{
// // // //       minHeight: "100vh",
// // // //       background: "#0d1117",
// // // //       color: "#e6edf3",
// // // //       fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
// // // //     }}>

// // // //       {/* ── Topbar ── */}
// // // //       <header style={{
// // // //         background: "#161b22",
// // // //         borderBottom: "1px solid #21262d",
// // // //         padding: "0 24px",
// // // //         height: 56,
// // // //         display: "flex",
// // // //         alignItems: "center",
// // // //         gap: 16,
// // // //         position: "sticky",
// // // //         top: 0,
// // // //         zIndex: 20,
// // // //       }}>
// // // //         {/* Wordmark */}
// // // //         <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
// // // //           <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
// // // //             <circle cx="10" cy="10" r="9" stroke="#388bfd" strokeWidth="1.5" />
// // // //             <circle cx="10" cy="10" r="4" fill="#388bfd" />
// // // //           </svg>
// // // //           <span style={{ fontSize: 14, fontWeight: 600, color: "#e6edf3", letterSpacing: "-0.01em" }}>
// // // //             IssueFinder
// // // //           </span>
// // // //         </div>

// // // //         {/* Repo input */}
// // // //         <div style={{ flex: 1, maxWidth: 480, position: "relative" }}>
// // // //           <input
// // // //             ref={inputRef}
// // // //             type="text"
// // // //             value={repo}
// // // //             onChange={(e) => {
// // // //               setRepo(e.target.value);
// // // //               if (status !== "idle") reset();
// // // //             }}
// // // //             onKeyDown={handleKeyDown}
// // // //             placeholder="github.com/owner/repo or owner/repo"
// // // //             style={{
// // // //               width: "100%",
// // // //               padding: "7px 12px",
// // // //               borderRadius: 6,
// // // //               border: `1px solid ${repoSlug ? "#388bfd" : "#30363d"}`,
// // // //               background: "#0d1117",
// // // //               color: "#e6edf3",
// // // //               fontSize: 13,
// // // //               outline: "none",
// // // //               transition: "border-color 0.15s",
// // // //             }}
// // // //           />
// // // //           {repoSlug && (
// // // //             <span style={{
// // // //               position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
// // // //               fontSize: 10, color: "#56d364", fontWeight: 600, pointerEvents: "none",
// // // //             }}>
// // // //               {repoSlug}
// // // //             </span>
// // // //           )}
// // // //         </div>

// // // //         {/* Scan / Stop */}
// // // //         {status !== "running" ? (
// // // //           <button
// // // //             onClick={handleScan}
// // // //             disabled={!canScan}
// // // //             style={{
// // // //               padding: "7px 16px",
// // // //               borderRadius: 6,
// // // //               border: "none",
// // // //               background: canScan ? "#238636" : "#21262d",
// // // //               color: canScan ? "#fff" : "#484f58",
// // // //               fontSize: 13,
// // // //               fontWeight: 600,
// // // //               cursor: canScan ? "pointer" : "not-allowed",
// // // //               flexShrink: 0,
// // // //               transition: "background 0.15s",
// // // //             }}
// // // //           >
// // // //             {status === "done" || status === "error" ? "Re-scan" : "Scan"}
// // // //           </button>
// // // //         ) : (
// // // //           <button
// // // //             onClick={stop}
// // // //             style={{
// // // //               padding: "7px 16px", borderRadius: 6, border: "none",
// // // //               background: "#da3633", color: "#fff",
// // // //               fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0,
// // // //             }}
// // // //           >
// // // //             Stop
// // // //           </button>
// // // //         )}

// // // //         {issues.length > 0 && (
// // // //           <button
// // // //             onClick={handleReset}
// // // //             style={{
// // // //               padding: "7px 14px", borderRadius: 6,
// // // //               border: "1px solid #30363d", background: "transparent",
// // // //               color: "#8b949e", fontSize: 13, cursor: "pointer", flexShrink: 0,
// // // //             }}
// // // //           >
// // // //             Clear
// // // //           </button>
// // // //         )}

// // // //         {/* Rate limit + token pill — pushed right */}
// // // //         <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
// // // //           {progress.rl !== null && (
// // // //             <span style={{ fontSize: 11, color: rlPct < 20 ? "#f87171" : "#8b949e" }}>
// // // //               {progress.rl}/{progress.rlMax} API calls
// // // //             </span>
// // // //           )}
// // // //           <span style={{
// // // //             fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
// // // //             background: TOKEN_OK ? "#1a3c34" : "#2d2208",
// // // //             color:      TOKEN_OK ? "#56d364" : "#fbbf24",
// // // //             border:     `1px solid ${TOKEN_OK ? "#1f6f47" : "#6e4c05"}`,
// // // //           }}>
// // // //             {TOKEN_OK ? "Token active" : "No token"}
// // // //           </span>
// // // //         </div>
// // // //       </header>

// // // //       {/* ── Progress bar ── */}
// // // //       {status === "running" && (
// // // //         <div style={{ height: 2, background: "#21262d", position: "relative" }}>
// // // //           <div style={{
// // // //             position: "absolute", left: 0, top: 0, height: "100%",
// // // //             background: "#238636",
// // // //             width: progress.page > 0 ? `${Math.min(100, progress.page * 1.2)}%` : "8%",
// // // //             transition: "width 0.4s ease",
// // // //           }} />
// // // //         </div>
// // // //       )}

// // // //       {/* ── Error banner ── */}
// // // //       {status === "error" && (
// // // //         <div style={{
// // // //           background: "#3d1c1e", borderBottom: "1px solid #f8514933",
// // // //           padding: "10px 24px", color: "#ff7b72", fontSize: 13,
// // // //         }}>
// // // //           {error}
// // // //         </div>
// // // //       )}

// // // //       {/* ── Main ── */}
// // // //       <main style={{ maxWidth: 940, margin: "0 auto", padding: "24px 24px 60px" }}>

// // // //         {/* Idle state */}
// // // //         {status === "idle" && (
// // // //           <div style={{ paddingTop: 80, textAlign: "center" }}>
// // // //             <div style={{
// // // //               display: "inline-flex", alignItems: "center", justifyContent: "center",
// // // //               width: 52, height: 52, borderRadius: 12,
// // // //               background: "#161b22", border: "1px solid #21262d",
// // // //               marginBottom: 20,
// // // //             }}>
// // // //               <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
// // // //                 <circle cx="11" cy="11" r="7" stroke="#388bfd" strokeWidth="1.5"/>
// // // //                 <path d="M16.5 16.5L21 21" stroke="#388bfd" strokeWidth="1.5" strokeLinecap="round"/>
// // // //               </svg>
// // // //             </div>
// // // //             <p style={{ fontSize: 18, fontWeight: 600, color: "#e6edf3", margin: "0 0 8px" }}>
// // // //               Find contribution-ready issues
// // // //             </p>
// // // //             <p style={{ fontSize: 14, color: "#8b949e", margin: "0 0 32px", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
// // // //               Enter any public GitHub repo above to scan for open issues with no assignee and no linked pull request.
// // // //             </p>
// // // //             {!TOKEN_OK && (
// // // //               <div style={{
// // // //                 display: "inline-block", textAlign: "left",
// // // //                 background: "#161b22", border: "1px solid #6e4c05",
// // // //                 borderRadius: 8, padding: "14px 18px", fontSize: 12,
// // // //                 color: "#e3b341", maxWidth: 420,
// // // //               }}>
// // // //                 <span style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Token not configured</span>
// // // //                 Add <code style={{ background: "#0d1117", padding: "1px 5px", borderRadius: 4 }}>VITE_GITHUB_TOKEN=ghp_...</code> to your <code style={{ background: "#0d1117", padding: "1px 5px", borderRadius: 4 }}>.env</code> file, then restart Vite. Without it, scanning large repos will hit GitHub's 60 req/hr limit.
// // // //               </div>
// // // //             )}
// // // //           </div>
// // // //         )}

// // // //         {/* Running: show partial results + scanning notice */}
// // // //         {status === "running" && issues.length === 0 && (
// // // //           <div style={{ paddingTop: 60, textAlign: "center", color: "#8b949e", fontSize: 13 }}>
// // // //             Scanning page {progress.page}…
// // // //           </div>
// // // //         )}

// // // //         {status === "running" && issues.length > 0 && (
// // // //           <div style={{
// // // //             fontSize: 12, color: "#8b949e",
// // // //             padding: "0 0 16px",
// // // //             display: "flex", alignItems: "center", gap: 8,
// // // //           }}>
// // // //             <span style={{
// // // //               display: "inline-block", width: 7, height: 7, borderRadius: "50%",
// // // //               background: "#56d364",
// // // //               animation: "blink 1.1s ease-in-out infinite",
// // // //             }} />
// // // //             Scanning page {progress.page} — {progress.found} issues found so far
// // // //           </div>
// // // //         )}

// // // //         {/* Stats */}
// // // //         {issues.length > 0 && <StatsBar issues={issues} filtered={filtered.length} />}

// // // //         {/* Filters */}
// // // //         {issues.length > 0 && (
// // // //           <FilterBar
// // // //             filters={filters}
// // // //             onChange={setFilters}
// // // //             total={issues.length}
// // // //             filtered={filtered.length}
// // // //           />
// // // //         )}

// // // //         {/* No results after filter */}
// // // //         {status === "done" && issues.length > 0 && filtered.length === 0 && (
// // // //           <div style={{ textAlign: "center", padding: "60px 0" }}>
// // // //             <p style={{ color: "#8b949e", fontSize: 14, margin: "0 0 12px" }}>
// // // //               No issues match these filters.
// // // //             </p>
// // // //             <button
// // // //               onClick={() => setFilters(DEFAULT_FILTERS)}
// // // //               style={{
// // // //                 padding: "7px 16px", borderRadius: 6,
// // // //                 border: "1px solid #30363d", background: "transparent",
// // // //                 color: "#8b949e", fontSize: 13, cursor: "pointer",
// // // //               }}
// // // //             >
// // // //               Clear filters
// // // //             </button>
// // // //           </div>
// // // //         )}

// // // //         {/* Issue list */}
// // // //         <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
// // // //           {filtered.map((issue) => (
// // // //             <IssueCard key={issue.number} issue={issue} />
// // // //           ))}
// // // //         </div>

// // // //         {/* Done footer */}
// // // //         {status === "done" && filtered.length > 0 && (
// // // //           <div style={{
// // // //             marginTop: 28, textAlign: "center", fontSize: 12, color: "#484f58",
// // // //           }}>
// // // //             {issues.length} issues fetched · {filtered.length} shown · {repoSlug}
// // // //           </div>
// // // //         )}
// // // //       </main>

// // // //       <style>{`
// // // //         * { box-sizing: border-box; margin: 0; padding: 0; }
// // // //         @keyframes blink {
// // // //           0%, 100% { opacity: 1; }
// // // //           50% { opacity: 0.25; }
// // // //         }
// // // //         ::-webkit-scrollbar { width: 6px; height: 6px; }
// // // //         ::-webkit-scrollbar-track { background: #161b22; }
// // // //         ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
// // // //         input::placeholder { color: #484f58; }
// // // //         select option { background: #161b22; color: #e6edf3; }
// // // //         a { color: inherit; }
// // // //       `}</style>
// // // //     </div>
// // // //   );
// // // // }






// // // import { useEffect, useMemo, useRef, useState } from "react";
// // // import FilterBar from "./FilterBar";
// // // import IssueCard from "./IssueCard";
// // // import StatsBar from "./StatsBar";
// // // import { useGithubIssues } from "../hooks/useGithubIssues";

// // // // ── Filter logic ───────────────────────────────────────────────────────────

// // // const DEFAULT_FILTERS = {
// // //   search: "",
// // //   sort: "newest",
// // //   type: "all",
// // //   age: "all",
// // //   comments: "all",
// // //   goodFirst: false,
// // //   helpWanted: false,
// // //   triageAccepted: false,
// // //   noComments: false,
// // // };

// // // function loadState() {
// // //   try {
// // //     const saved = localStorage.getItem("isf-state");
// // //     if (!saved) return { repo: "", filters: DEFAULT_FILTERS };
// // //     const p = JSON.parse(saved);
// // //     return { repo: p.repo || "", filters: { ...DEFAULT_FILTERS, ...(p.filters || {}) } };
// // //   } catch { return { repo: "", filters: DEFAULT_FILTERS }; }
// // // }

// // // function applyFilters(issues, f) {
// // //   let out = [...issues];
// // //   if (f.search.trim()) {
// // //     const q = f.search.trim().toLowerCase();
// // //     out = out.filter(
// // //       (i) => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q) || String(i.number).includes(q)
// // //     );
// // //   }
// // //   if (f.type !== "all")  out = out.filter((i) => i.labelNames.includes(f.type));
// // //   if (f.age  !== "all")  { const c = Date.now() - parseInt(f.age) * 86400000; out = out.filter((i) => new Date(i.createdAt) >= c); }
// // //   if (f.comments === "0")  out = out.filter((i) => i.comments === 0);
// // //   if (f.comments === "1+") out = out.filter((i) => i.comments >= 1);
// // //   if (f.comments === "5+") out = out.filter((i) => i.comments >= 5);
// // //   if (f.goodFirst)      out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("good first")));
// // //   if (f.helpWanted)     out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("help wanted")));
// // //   if (f.triageAccepted) out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("accepted")));
// // //   if (f.noComments)     out = out.filter((i) => i.comments === 0);
// // //   out.sort((a, b) => {
// // //     switch (f.sort) {
// // //       case "newest":           return new Date(b.createdAt) - new Date(a.createdAt);
// // //       case "oldest":           return new Date(a.createdAt) - new Date(b.createdAt);
// // //       case "most-comments":    return b.comments - a.comments;
// // //       case "least-comments":   return a.comments - b.comments;
// // //       case "recently-updated": return new Date(b.updatedAt) - new Date(a.updatedAt);
// // //       default: return 0;
// // //     }
// // //   });
// // //   return out;
// // // }

// // // function parseRepoSlug(input) {
// // //   if (!input) return null;
// // //   const t = input.trim().replace(/\/$/, "");
// // //   const m = t.match(/github\.com\/([^/]+\/[^/]+)/);
// // //   return m ? m[1] : /^[^/]+\/[^/]+$/.test(t) ? t : null;
// // // }

// // // // ── Constants ──────────────────────────────────────────────────────────────

// // // const TOKEN_OK = !!import.meta.env.VITE_GITHUB_TOKEN;

// // // // ── Component ──────────────────────────────────────────────────────────────

// // // export default function IssueFinder() {
// // //   const init = loadState();
// // //   const [repo, setRepo]       = useState(init.repo);
// // //   const [filters, setFilters] = useState(init.filters);
// // //   const [showRlWarning, setShowRlWarning] = useState(false);

// // //   const {
// // //     issues, status, error, progress, rlAdvisory,
// // //     startPhase1, startPhase2, checkRateLimit, stop, reset,
// // //   } = useGithubIssues();

// // //   useEffect(() => {
// // //     localStorage.setItem("isf-state", JSON.stringify({ repo, filters }));
// // //   }, [repo, filters]);

// // //   const filtered  = useMemo(() => applyFilters(issues, filters), [issues, filters]);
// // //   const repoSlug  = parseRepoSlug(repo);
// // //   const canScan   = !!repoSlug && status !== "running";
// // //   const phase1Done = status === "done-phase1";
// // //   const allDone    = status === "done";
// // //   const isRunning  = status === "running";
// // //   const rlPct      = progress.rlMax ? Math.round((progress.rl / progress.rlMax) * 100) : null;

// // //   function handleScan() {
// // //     if (!canScan) return;
// // //     setShowRlWarning(false);
// // //     startPhase1(repo);
// // //   }

// // //   function handleRepoChange(val) {
// // //     setRepo(val);
// // //     if (status !== "idle") reset();
// // //     setShowRlWarning(false);
// // //   }

// // //   function handleReset() {
// // //     reset();
// // //     setFilters(DEFAULT_FILTERS);
// // //     setShowRlWarning(false);
// // //   }

// // //   async function handlePhase2Click() {
// // //     // Always fetch fresh rate limit before showing the advisory
// // //     await checkRateLimit();
// // //     setShowRlWarning(true);
// // //   }

// // //   function handlePhase2Confirm() {
// // //     setShowRlWarning(false);
// // //     startPhase2();
// // //   }

// // //   // ── Render ─────────────────────────────────────────────────────────────

// // //   return (
// // //     <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3",
// // //       fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

// // //       {/* ── Top bar ── */}
// // //       <header style={{
// // //         background: "#161b22", borderBottom: "1px solid #21262d",
// // //         padding: "0 24px", height: 56,
// // //         display: "flex", alignItems: "center", gap: 14,
// // //         position: "sticky", top: 0, zIndex: 20,
// // //       }}>
// // //         {/* Logo */}
// // //         <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
// // //           <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
// // //             <circle cx="9" cy="9" r="8" stroke="#388bfd" strokeWidth="1.5"/>
// // //             <circle cx="9" cy="9" r="3.5" fill="#388bfd"/>
// // //           </svg>
// // //           <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", letterSpacing: "-0.01em" }}>
// // //             IssueFinder
// // //           </span>
// // //         </div>

// // //         {/* Repo input */}
// // //         <div style={{ flex: 1, maxWidth: 460, position: "relative" }}>
// // //           <input
// // //             type="text"
// // //             value={repo}
// // //             onChange={(e) => handleRepoChange(e.target.value)}
// // //             onKeyDown={(e) => e.key === "Enter" && handleScan()}
// // //             placeholder="github.com/owner/repo  or  owner/repo"
// // //             style={{
// // //               width: "100%", padding: "7px 12px",
// // //               borderRadius: 6, outline: "none",
// // //               border: `1px solid ${repoSlug ? "#388bfd" : "#30363d"}`,
// // //               background: "#0d1117", color: "#e6edf3", fontSize: 13,
// // //               transition: "border-color 0.15s",
// // //             }}
// // //           />
// // //           {repoSlug && (
// // //             <span style={{
// // //               position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
// // //               fontSize: 10, color: "#56d364", fontWeight: 600, pointerEvents: "none",
// // //             }}>
// // //               {repoSlug}
// // //             </span>
// // //           )}
// // //         </div>

// // //         {/* Scan / Stop */}
// // //         {!isRunning ? (
// // //           <button onClick={handleScan} disabled={!canScan} style={btnStyle(canScan ? "#238636" : "#21262d", canScan ? "#fff" : "#484f58", !canScan)}>
// // //             {phase1Done || allDone ? "Re-scan" : "Scan"}
// // //           </button>
// // //         ) : (
// // //           <button onClick={stop} style={btnStyle("#da3633", "#fff")}>Stop</button>
// // //         )}

// // //         {(phase1Done || allDone || issues.length > 0) && (
// // //           <button onClick={handleReset} style={{
// // //             padding: "7px 12px", borderRadius: 6,
// // //             border: "1px solid #30363d", background: "transparent",
// // //             color: "#8b949e", fontSize: 13, cursor: "pointer", flexShrink: 0,
// // //           }}>
// // //             Clear
// // //           </button>
// // //         )}

// // //         {/* Rate limit + token status */}
// // //         <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
// // //           {progress.rl !== null && (
// // //             <span style={{ fontSize: 11, color: rlPct !== null && rlPct < 20 ? "#f87171" : "#484f58" }}>
// // //               {progress.rl}/{progress.rlMax} remaining
// // //             </span>
// // //           )}
// // //           <span style={{
// // //             fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
// // //             background: TOKEN_OK ? "#1a3c34" : "#2d2208",
// // //             color:      TOKEN_OK ? "#56d364" : "#fbbf24",
// // //             border:     `1px solid ${TOKEN_OK ? "#1f6f47" : "#6e4c05"}`,
// // //           }}>
// // //             {TOKEN_OK ? "Token active" : "No token"}
// // //           </span>
// // //         </div>
// // //       </header>

// // //       {/* ── Progress bar ── */}
// // //       {isRunning && (
// // //         <div style={{ height: 2, background: "#21262d" }}>
// // //           <div style={{
// // //             height: "100%",
// // //             background: progress.phase === "checking" ? "#388bfd" : "#238636",
// // //             width: progress.phase === "checking" && progress.fetched > 0
// // //               ? `${50 + Math.round((progress.checked / progress.fetched) * 50)}%`
// // //               : `${Math.min(48, Math.max(4, progress.page * 2))}%`,
// // //             transition: "width 0.35s ease, background 0.3s ease",
// // //           }}/>
// // //         </div>
// // //       )}

// // //       {/* ── Error banner ── */}
// // //       {status === "error" && (
// // //         <div style={{ background: "#3d1c1e", borderBottom: "1px solid #f8514933", padding: "10px 24px", color: "#ff7b72", fontSize: 13 }}>
// // //           {error}
// // //         </div>
// // //       )}

// // //       {/* ── Main ── */}
// // //       <main style={{ maxWidth: 940, margin: "0 auto", padding: "24px 24px 60px" }}>

// // //         {/* Idle */}
// // //         {status === "idle" && (
// // //           <div style={{ paddingTop: 80, textAlign: "center" }}>
// // //             <div style={{
// // //               display: "inline-flex", alignItems: "center", justifyContent: "center",
// // //               width: 48, height: 48, borderRadius: 12,
// // //               background: "#161b22", border: "1px solid #21262d", marginBottom: 20,
// // //             }}>
// // //               <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
// // //                 <circle cx="11" cy="11" r="7" stroke="#388bfd" strokeWidth="1.5"/>
// // //                 <path d="M16.5 16.5L21 21" stroke="#388bfd" strokeWidth="1.5" strokeLinecap="round"/>
// // //               </svg>
// // //             </div>
// // //             <p style={{ fontSize: 17, fontWeight: 600, color: "#e6edf3", margin: "0 0 8px" }}>
// // //               Find contribution-ready issues
// // //             </p>
// // //             <p style={{ fontSize: 13, color: "#8b949e", margin: "0 0 28px", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
// // //               Enter any public GitHub repo above. Phase 1 finds open issues with no assignee. Phase 2 (optional) removes any that have a linked PR.
// // //             </p>
// // //             {!TOKEN_OK && (
// // //               <div style={{
// // //                 display: "inline-block", textAlign: "left",
// // //                 background: "#161b22", border: "1px solid #6e4c05",
// // //                 borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#e3b341", maxWidth: 400,
// // //               }}>
// // //                 <strong style={{ display: "block", marginBottom: 4 }}>Token not configured</strong>
// // //                 Add <Code>VITE_GITHUB_TOKEN=ghp_...</Code> to your <Code>.env</Code> and restart Vite.
// // //                 Without it you're limited to 60 API req/hr — Phase 2 may hit that wall.
// // //               </div>
// // //             )}
// // //           </div>
// // //         )}

// // //         {/* Phase 1 scanning */}
// // //         {isRunning && progress.phase === "scanning" && (
// // //           <StatusRow color="#238636">
// // //             Fetching issues — page {progress.page}, {progress.fetched} found so far
// // //           </StatusRow>
// // //         )}

// // //         {/* Phase 2 checking */}
// // //         {isRunning && progress.phase === "checking" && (
// // //           <StatusRow color="#388bfd">
// // //             Checking for linked PRs — {progress.checked} / {progress.fetched} issues checked
// // //             {progress.found > 0 && <span style={{ color: "#56d364", marginLeft: 8 }}>· {progress.found} clean</span>}
// // //           </StatusRow>
// // //         )}

// // //         {/* ── Phase 2 CTA — shown after Phase 1 completes ── */}
// // //         {(phase1Done || allDone) && issues.length > 0 && (
// // //           <Phase2Panel
// // //             status={status}
// // //             progress={progress}
// // //             rlAdvisory={rlAdvisory}
// // //             showWarning={showRlWarning}
// // //             onCheckRl={handlePhase2Click}
// // //             onConfirm={handlePhase2Confirm}
// // //             onDismiss={() => setShowRlWarning(false)}
// // //             isRunning={isRunning}
// // //           />
// // //         )}

// // //         {/* Stats */}
// // //         {issues.length > 0 && <StatsBar issues={issues} filtered={filtered.length} />}

// // //         {/* Filters */}
// // //         {issues.length > 0 && (
// // //           <FilterBar filters={filters} onChange={setFilters} total={issues.length} filtered={filtered.length} />
// // //         )}

// // //         {/* No match */}
// // //         {(phase1Done || allDone) && issues.length > 0 && filtered.length === 0 && (
// // //           <div style={{ textAlign: "center", padding: "48px 0" }}>
// // //             <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 12 }}>No issues match these filters.</p>
// // //             <button onClick={() => setFilters(DEFAULT_FILTERS)} style={btnStyle("#21262d", "#8b949e")}>
// // //               Clear filters
// // //             </button>
// // //           </div>
// // //         )}

// // //         {/* Issue list */}
// // //         <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
// // //           {filtered.map((issue) => <IssueCard key={issue.number} issue={issue} />)}
// // //         </div>

// // //         {/* Footer */}
// // //         {(phase1Done || allDone) && issues.length > 0 && (
// // //           <div style={{ marginTop: 28, textAlign: "center", fontSize: 11, color: "#484f58" }}>
// // //             {allDone && progress.fetched > 0
// // //               ? `${progress.fetched} fetched → ${issues.length} with no linked PR · ${filtered.length} shown`
// // //               : `${issues.length} issues · ${filtered.length} shown`}
// // //             {" · "}{repoSlug}
// // //           </div>
// // //         )}
// // //       </main>

// // //       <style>{`
// // //         * { box-sizing: border-box; margin: 0; padding: 0; }
// // //         @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
// // //         ::-webkit-scrollbar { width: 6px; height: 6px; }
// // //         ::-webkit-scrollbar-track { background: #161b22; }
// // //         ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
// // //         input::placeholder { color: #484f58; }
// // //         select option { background: #161b22; color: #e6edf3; }
// // //       `}</style>
// // //     </div>
// // //   );
// // // }

// // // // ── Phase 2 panel ──────────────────────────────────────────────────────────

// // // function Phase2Panel({ status, progress, rlAdvisory, showWarning, onCheckRl, onConfirm, onDismiss }) {
// // //   const allDone    = status === "done";
// // //   const phase1Done = status === "done-phase1";

// // //   // Color-coded rate-limit sufficiency
// // //   const enough = rlAdvisory ? rlAdvisory.remaining >= rlAdvisory.needed : null;
// // //   const tight   = rlAdvisory ? rlAdvisory.remaining >= rlAdvisory.needed * 0.5 && !enough : false;

// // //   return (
// // //     <div style={{
// // //       background: "#161b22",
// // //       border: "1px solid #21262d",
// // //       borderRadius: 10,
// // //       padding: "14px 18px",
// // //       marginBottom: 20,
// // //       display: "flex",
// // //       flexDirection: "column",
// // //       gap: 12,
// // //     }}>
// // //       <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
// // //         <div style={{ flex: 1 }}>
// // //           <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 2 }}>
// // //             {allDone ? "PR filter applied" : "Filter out issues with linked PRs"}
// // //           </div>
// // //           <div style={{ fontSize: 12, color: "#8b949e" }}>
// // //             {allDone
// // //               ? `${progress.fetched} candidates → ${progress.found} with no linked PR (open or merged)`
// // //               : `Phase 1 found ${progress.fetched} issues. Phase 2 checks each one's timeline for any linked PR — open, merged, or closed.`}
// // //           </div>
// // //         </div>

// // //         {phase1Done && (
// // //           <button
// // //             onClick={onCheckRl}
// // //             style={btnStyle("#1f6feb", "#79c0ff")}
// // //           >
// // //             Check linked PRs
// // //           </button>
// // //         )}

// // //         {allDone && (
// // //           <span style={{
// // //             fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 99,
// // //             background: "#1a3c34", color: "#56d364", border: "1px solid #1f6f47",
// // //           }}>
// // //             Done
// // //           </span>
// // //         )}
// // //       </div>

// // //       {/* Rate-limit advisory — shown after user clicks the button */}
// // //       {showWarning && rlAdvisory && (
// // //         <div style={{
// // //           background: "#0d1117",
// // //           border: `1px solid ${enough ? "#1f6f47" : tight ? "#6e4c05" : "#8b1a1a"}`,
// // //           borderRadius: 8,
// // //           padding: "12px 14px",
// // //           display: "flex",
// // //           flexDirection: "column",
// // //           gap: 10,
// // //         }}>
// // //           {/* Traffic-light row */}
// // //           <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
// // //             <span style={{
// // //               width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
// // //               background: enough ? "#56d364" : tight ? "#fbbf24" : "#f87171",
// // //             }} />
// // //             <span style={{ fontSize: 13, fontWeight: 600, color: enough ? "#56d364" : tight ? "#fbbf24" : "#f87171" }}>
// // //               {enough
// // //                 ? "You have enough API calls"
// // //                 : tight
// // //                   ? "You might run out mid-way"
// // //                   : "Rate limit too low — Phase 2 will likely fail"}
// // //             </span>
// // //           </div>

// // //           {/* Stats */}
// // //           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
// // //             <RlStat label="Issues to check" value={rlAdvisory.needed} color="#e6edf3" />
// // //             <RlStat label="API calls remaining" value={rlAdvisory.remaining} color={enough ? "#56d364" : "#f87171"} />
// // //             <RlStat label="Total limit" value={rlAdvisory.limit} color="#8b949e" />
// // //           </div>

// // //           {!enough && rlAdvisory.resetAt && (
// // //             <p style={{ fontSize: 12, color: "#8b949e", margin: 0 }}>
// // //               Limit resets at <strong style={{ color: "#e6edf3" }}>{rlAdvisory.resetAt.toLocaleTimeString()}</strong>.
// // //               {!TOKEN_OK && " Add VITE_GITHUB_TOKEN to your .env for 5000 req/hr."}
// // //             </p>
// // //           )}

// // //           <div style={{ display: "flex", gap: 8 }}>
// // //             <button onClick={onConfirm} style={btnStyle(enough ? "#238636" : "#8b1a1a", "#fff")}>
// // //               {enough ? "Run Phase 2" : "Run anyway (may fail)"}
// // //             </button>
// // //             <button onClick={onDismiss} style={btnStyle("#21262d", "#8b949e")}>
// // //               Cancel
// // //             </button>
// // //           </div>
// // //         </div>
// // //       )}
// // //     </div>
// // //   );
// // // }

// // // // ── Small helpers ──────────────────────────────────────────────────────────

// // // function StatusRow({ color, children }) {
// // //   return (
// // //     <div style={{
// // //       display: "flex", alignItems: "center", gap: 8,
// // //       fontSize: 12, color: "#8b949e", marginBottom: 16,
// // //     }}>
// // //       <span style={{
// // //         width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0,
// // //         animation: "blink 1.1s ease-in-out infinite",
// // //       }} />
// // //       {children}
// // //     </div>
// // //   );
// // // }

// // // function RlStat({ label, value, color }) {
// // //   return (
// // //     <div style={{ background: "#161b22", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
// // //       <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
// // //       <div style={{ fontSize: 10, color: "#8b949e", marginTop: 2 }}>{label}</div>
// // //     </div>
// // //   );
// // // }

// // // function Code({ children }) {
// // //   return (
// // //     <code style={{ background: "#0d1117", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>
// // //       {children}
// // //     </code>
// // //   );
// // // }

// // // function btnStyle(bg, color, disabled = false) {
// // //   return {
// // //     padding: "7px 14px", borderRadius: 6, border: "none",
// // //     background: bg, color, fontSize: 13, fontWeight: 600,
// // //     cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0,
// // //     opacity: disabled ? 0.5 : 1,
// // //   };
// // // }






// // // --------






// // import { useEffect, useMemo, useRef, useState } from "react";
// // import FilterBar from "./FilterBar";
// // import IssueCard from "./IssueCard";
// // import StatsBar from "./StatsBar";
// // import { useGithubIssues } from "../hooks/useGithubIssues";

// // // ── Filter logic ───────────────────────────────────────────────────────────

// // const DEFAULT_FILTERS = {
// //   search: "",
// //   sort: "newest",
// //   type: "all",
// //   age: "all",
// //   comments: "all",
// //   goodFirst: false,
// //   helpWanted: false,
// //   triageAccepted: false,
// //   noComments: false,
// // };

// // function loadState() {
// //   try {
// //     const saved = localStorage.getItem("isf-state");
// //     if (!saved) return { repo: "", filters: DEFAULT_FILTERS };
// //     const p = JSON.parse(saved);
// //     return { repo: p.repo || "", filters: { ...DEFAULT_FILTERS, ...(p.filters || {}) } };
// //   } catch { return { repo: "", filters: DEFAULT_FILTERS }; }
// // }

// // function applyFilters(issues, f) {
// //   let out = [...issues];
// //   if (f.search.trim()) {
// //     const q = f.search.trim().toLowerCase();
// //     out = out.filter(
// //       (i) => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q) || String(i.number).includes(q)
// //     );
// //   }
// //   if (f.type !== "all")  out = out.filter((i) => i.labelNames.includes(f.type));
// //   if (f.age  !== "all")  { const c = Date.now() - parseInt(f.age) * 86400000; out = out.filter((i) => new Date(i.createdAt) >= c); }
// //   if (f.comments === "0")  out = out.filter((i) => i.comments === 0);
// //   if (f.comments === "1+") out = out.filter((i) => i.comments >= 1);
// //   if (f.comments === "5+") out = out.filter((i) => i.comments >= 5);
// //   if (f.goodFirst)      out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("good first")));
// //   if (f.helpWanted)     out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("help wanted")));
// //   if (f.triageAccepted) out = out.filter((i) => i.labelNames.some((n) => n.toLowerCase().includes("accepted")));
// //   if (f.noComments)     out = out.filter((i) => i.comments === 0);
// //   out.sort((a, b) => {
// //     switch (f.sort) {
// //       case "newest":           return new Date(b.createdAt) - new Date(a.createdAt);
// //       case "oldest":           return new Date(a.createdAt) - new Date(b.createdAt);
// //       case "most-comments":    return b.comments - a.comments;
// //       case "least-comments":   return a.comments - b.comments;
// //       case "recently-updated": return new Date(b.updatedAt) - new Date(a.updatedAt);
// //       default: return 0;
// //     }
// //   });
// //   return out;
// // }

// // function parseRepoSlug(input) {
// //   if (!input) return null;
// //   const t = input.trim().replace(/\/$/, "");
// //   const m = t.match(/github\.com\/([^/]+\/[^/]+)/);
// //   return m ? m[1] : /^[^/]+\/[^/]+$/.test(t) ? t : null;
// // }

// // // ── Constants ──────────────────────────────────────────────────────────────

// // const TOKEN_OK = !!import.meta.env.VITE_GITHUB_TOKEN;

// // // ── Component ──────────────────────────────────────────────────────────────

// // export default function IssueFinder() {
// //   const init = loadState();
// //   const [repo, setRepo]       = useState(init.repo);
// //   const [filters, setFilters] = useState(init.filters);
// //   const [showRlWarning, setShowRlWarning] = useState(false);
// //   const [bulkCopied, setBulkCopied]       = useState(false);

// //   const {
// //     issues, status, error, progress, rlAdvisory,
// //     startPhase1, startPhase2, checkRateLimit, stop, reset,
// //   } = useGithubIssues();

// //   useEffect(() => {
// //     localStorage.setItem("isf-state", JSON.stringify({ repo, filters }));
// //   }, [repo, filters]);

// //   const filtered  = useMemo(() => applyFilters(issues, filters), [issues, filters]);
// //   const repoSlug  = parseRepoSlug(repo);
// //   const canScan   = !!repoSlug && status !== "running";
// //   const phase1Done = status === "done-phase1";
// //   const allDone    = status === "done";
// //   const isRunning  = status === "running";
// //   const rlPct      = progress.rlMax ? Math.round((progress.rl / progress.rlMax) * 100) : null;

// //   function handleScan() {
// //     if (!canScan) return;
// //     setShowRlWarning(false);
// //     startPhase1(repo);
// //   }

// //   function handleRepoChange(val) {
// //     setRepo(val);
// //     if (status !== "idle") reset();
// //     setShowRlWarning(false);
// //   }

// //   function handleReset() {
// //     reset();
// //     setFilters(DEFAULT_FILTERS);
// //     setShowRlWarning(false);
// //   }

// //   async function handlePhase2Click() {
// //     // Always fetch fresh rate limit before showing the advisory
// //     await checkRateLimit();
// //     setShowRlWarning(true);
// //   }

// //   function handlePhase2Confirm() {
// //     setShowRlWarning(false);
// //     startPhase2();
// //   }

// //   // ── Render ─────────────────────────────────────────────────────────────

// //   return (
// //     <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3",
// //       fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

// //       {/* ── Top bar ── */}
// //       <header style={{
// //         background: "#161b22", borderBottom: "1px solid #21262d",
// //         padding: "0 24px", height: 56,
// //         display: "flex", alignItems: "center", gap: 14,
// //         position: "sticky", top: 0, zIndex: 20,
// //       }}>
// //         {/* Logo */}
// //         <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
// //           <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
// //             <circle cx="9" cy="9" r="8" stroke="#388bfd" strokeWidth="1.5"/>
// //             <circle cx="9" cy="9" r="3.5" fill="#388bfd"/>
// //           </svg>
// //           <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", letterSpacing: "-0.01em" }}>
// //             IssueFinder
// //           </span>
// //         </div>

// //         {/* Repo input */}
// //         <div style={{ flex: 1, maxWidth: 460, position: "relative" }}>
// //           <input
// //             type="text"
// //             value={repo}
// //             onChange={(e) => handleRepoChange(e.target.value)}
// //             onKeyDown={(e) => e.key === "Enter" && handleScan()}
// //             placeholder="github.com/owner/repo  or  owner/repo"
// //             style={{
// //               width: "100%", padding: "7px 12px",
// //               borderRadius: 6, outline: "none",
// //               border: `1px solid ${repoSlug ? "#388bfd" : "#30363d"}`,
// //               background: "#0d1117", color: "#e6edf3", fontSize: 13,
// //               transition: "border-color 0.15s",
// //             }}
// //           />
// //           {repoSlug && (
// //             <span style={{
// //               position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
// //               fontSize: 10, color: "#56d364", fontWeight: 600, pointerEvents: "none",
// //             }}>
// //               {repoSlug}
// //             </span>
// //           )}
// //         </div>

// //         {/* Scan / Stop */}
// //         {!isRunning ? (
// //           <button onClick={handleScan} disabled={!canScan} style={btnStyle(canScan ? "#238636" : "#21262d", canScan ? "#fff" : "#484f58", !canScan)}>
// //             {phase1Done || allDone ? "Re-scan" : "Scan"}
// //           </button>
// //         ) : (
// //           <button onClick={stop} style={btnStyle("#da3633", "#fff")}>Stop</button>
// //         )}

// //         {(phase1Done || allDone || issues.length > 0) && (
// //           <button onClick={handleReset} style={{
// //             padding: "7px 12px", borderRadius: 6,
// //             border: "1px solid #30363d", background: "transparent",
// //             color: "#8b949e", fontSize: 13, cursor: "pointer", flexShrink: 0,
// //           }}>
// //             Clear
// //           </button>
// //         )}

// //         {/* Rate limit + token status */}
// //         <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
// //           {progress.rl !== null && (
// //             <span style={{ fontSize: 11, color: rlPct !== null && rlPct < 20 ? "#f87171" : "#484f58" }}>
// //               {progress.rl}/{progress.rlMax} remaining
// //             </span>
// //           )}
// //           <span style={{
// //             fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
// //             background: TOKEN_OK ? "#1a3c34" : "#2d2208",
// //             color:      TOKEN_OK ? "#56d364" : "#fbbf24",
// //             border:     `1px solid ${TOKEN_OK ? "#1f6f47" : "#6e4c05"}`,
// //           }}>
// //             {TOKEN_OK ? "Token active" : "No token"}
// //           </span>
// //         </div>
// //       </header>

// //       {/* ── Progress bar ── */}
// //       {isRunning && (
// //         <div style={{ height: 2, background: "#21262d" }}>
// //           <div style={{
// //             height: "100%",
// //             background: progress.phase === "checking" ? "#388bfd" : "#238636",
// //             width: progress.phase === "checking" && progress.fetched > 0
// //               ? `${50 + Math.round((progress.checked / progress.fetched) * 50)}%`
// //               : `${Math.min(48, Math.max(4, progress.page * 2))}%`,
// //             transition: "width 0.35s ease, background 0.3s ease",
// //           }}/>
// //         </div>
// //       )}

// //       {/* ── Error banner ── */}
// //       {status === "error" && (
// //         <div style={{ background: "#3d1c1e", borderBottom: "1px solid #f8514933", padding: "10px 24px", color: "#ff7b72", fontSize: 13 }}>
// //           {error}
// //         </div>
// //       )}

// //       {/* ── Main ── */}
// //       <main style={{ maxWidth: 940, margin: "0 auto", padding: "24px 24px 60px" }}>

// //         {/* Idle */}
// //         {status === "idle" && (
// //           <div style={{ paddingTop: 80, textAlign: "center" }}>
// //             <div style={{
// //               display: "inline-flex", alignItems: "center", justifyContent: "center",
// //               width: 48, height: 48, borderRadius: 12,
// //               background: "#161b22", border: "1px solid #21262d", marginBottom: 20,
// //             }}>
// //               <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
// //                 <circle cx="11" cy="11" r="7" stroke="#388bfd" strokeWidth="1.5"/>
// //                 <path d="M16.5 16.5L21 21" stroke="#388bfd" strokeWidth="1.5" strokeLinecap="round"/>
// //               </svg>
// //             </div>
// //             <p style={{ fontSize: 17, fontWeight: 600, color: "#e6edf3", margin: "0 0 8px" }}>
// //               Find contribution-ready issues
// //             </p>
// //             <p style={{ fontSize: 13, color: "#8b949e", margin: "0 0 28px", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
// //               Enter any public GitHub repo above. Phase 1 finds open issues with no assignee. Phase 2 (optional) removes any that have a linked PR.
// //             </p>
// //             {!TOKEN_OK && (
// //               <div style={{
// //                 display: "inline-block", textAlign: "left",
// //                 background: "#161b22", border: "1px solid #6e4c05",
// //                 borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#e3b341", maxWidth: 400,
// //               }}>
// //                 <strong style={{ display: "block", marginBottom: 4 }}>Token not configured</strong>
// //                 Add <Code>VITE_GITHUB_TOKEN=ghp_...</Code> to your <Code>.env</Code> and restart Vite.
// //                 Without it you're limited to 60 API req/hr — Phase 2 may hit that wall.
// //               </div>
// //             )}
// //           </div>
// //         )}

// //         {/* Phase 1 scanning */}
// //         {isRunning && progress.phase === "scanning" && (
// //           <StatusRow color="#238636">
// //             Fetching issues — page {progress.page}, {progress.fetched} found so far
// //           </StatusRow>
// //         )}

// //         {/* Phase 2 checking */}
// //         {isRunning && progress.phase === "checking" && (
// //           <StatusRow color="#388bfd">
// //             Checking for linked PRs — {progress.checked} / {progress.fetched} issues checked
// //             {progress.found > 0 && <span style={{ color: "#56d364", marginLeft: 8 }}>· {progress.found} clean</span>}
// //           </StatusRow>
// //         )}

// //         {/* ── Phase 2 CTA — shown after Phase 1 completes ── */}
// //         {(phase1Done || allDone) && issues.length > 0 && (
// //           <Phase2Panel
// //             status={status}
// //             progress={progress}
// //             rlAdvisory={rlAdvisory}
// //             showWarning={showRlWarning}
// //             onCheckRl={handlePhase2Click}
// //             onConfirm={handlePhase2Confirm}
// //             onDismiss={() => setShowRlWarning(false)}
// //             isRunning={isRunning}
// //           />
// //         )}

// //         {/* Stats */}
// //         {issues.length > 0 && <StatsBar issues={issues} filtered={filtered.length} />}

// //         {/* Filters + bulk copy */}
// //         {issues.length > 0 && (
// //           <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
// //             <div style={{ flex: 1 }}>
// //               <FilterBar filters={filters} onChange={setFilters} total={issues.length} filtered={filtered.length} />
// //             </div>
// //             {filtered.length > 0 && (
// //               <button
// //                 onClick={() => {
// //                   const text = filtered.map((i) => i.url).join("\n");
// //                   navigator.clipboard.writeText(text).then(() => {
// //                     setBulkCopied(true);
// //                     setTimeout(() => setBulkCopied(false), 2000);
// //                   });
// //                 }}
// //                 title={`Copy ${filtered.length} issue URL${filtered.length !== 1 ? "s" : ""} to clipboard`}
// //                 style={{
// //                   marginTop: 12,
// //                   padding: "7px 14px",
// //                   borderRadius: 6,
// //                   border: `1px solid ${bulkCopied ? "#238636" : "#30363d"}`,
// //                   background: bulkCopied ? "#1a3c3480" : "transparent",
// //                   color: bulkCopied ? "#56d364" : "#8b949e",
// //                   fontSize: 12,
// //                   fontWeight: 600,
// //                   cursor: "pointer",
// //                   whiteSpace: "nowrap",
// //                   flexShrink: 0,
// //                   transition: "all 0.15s",
// //                 }}
// //               >
// //                 {bulkCopied ? `✓ Copied ${filtered.length}` : `Copy ${filtered.length} URLs`}
// //               </button>
// //             )}
// //           </div>
// //         )}

// //         {/* No match */}
// //         {(phase1Done || allDone) && issues.length > 0 && filtered.length === 0 && (
// //           <div style={{ textAlign: "center", padding: "48px 0" }}>
// //             <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 12 }}>No issues match these filters.</p>
// //             <button onClick={() => setFilters(DEFAULT_FILTERS)} style={btnStyle("#21262d", "#8b949e")}>
// //               Clear filters
// //             </button>
// //           </div>
// //         )}

// //         {/* Issue list */}
// //         <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
// //           {filtered.map((issue) => <IssueCard key={issue.number} issue={issue} />)}
// //         </div>

// //         {/* Footer */}
// //         {(phase1Done || allDone) && issues.length > 0 && (
// //           <div style={{ marginTop: 28, textAlign: "center", fontSize: 11, color: "#484f58" }}>
// //             {allDone && progress.fetched > 0
// //               ? `${progress.fetched} fetched → ${issues.length} with no linked PR · ${filtered.length} shown`
// //               : `${issues.length} issues · ${filtered.length} shown`}
// //             {" · "}{repoSlug}
// //           </div>
// //         )}
// //       </main>

// //       <style>{`
// //         * { box-sizing: border-box; margin: 0; padding: 0; }
// //         @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
// //         ::-webkit-scrollbar { width: 6px; height: 6px; }
// //         ::-webkit-scrollbar-track { background: #161b22; }
// //         ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
// //         input::placeholder { color: #484f58; }
// //         select option { background: #161b22; color: #e6edf3; }
// //       `}</style>
// //     </div>
// //   );
// // }

// // // ── Phase 2 panel ──────────────────────────────────────────────────────────

// // function Phase2Panel({ status, progress, rlAdvisory, showWarning, onCheckRl, onConfirm, onDismiss }) {
// //   const allDone    = status === "done";
// //   const phase1Done = status === "done-phase1";

// //   // Color-coded rate-limit sufficiency
// //   const enough = rlAdvisory ? rlAdvisory.remaining >= rlAdvisory.needed : null;
// //   const tight   = rlAdvisory ? rlAdvisory.remaining >= rlAdvisory.needed * 0.5 && !enough : false;

// //   return (
// //     <div style={{
// //       background: "#161b22",
// //       border: "1px solid #21262d",
// //       borderRadius: 10,
// //       padding: "14px 18px",
// //       marginBottom: 20,
// //       display: "flex",
// //       flexDirection: "column",
// //       gap: 12,
// //     }}>
// //       <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
// //         <div style={{ flex: 1 }}>
// //           <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 2 }}>
// //             {allDone ? "PR filter applied" : "Filter out issues with linked PRs"}
// //           </div>
// //           <div style={{ fontSize: 12, color: "#8b949e" }}>
// //             {allDone
// //               ? `${progress.fetched} candidates → ${progress.found} with no linked PR (open or merged)`
// //               : `Phase 1 found ${progress.fetched} issues. Phase 2 checks each one's timeline for any linked PR — open, merged, or closed.`}
// //           </div>
// //         </div>

// //         {phase1Done && (
// //           <button
// //             onClick={onCheckRl}
// //             style={btnStyle("#1f6feb", "#79c0ff")}
// //           >
// //             Check linked PRs
// //           </button>
// //         )}

// //         {allDone && (
// //           <span style={{
// //             fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 99,
// //             background: "#1a3c34", color: "#56d364", border: "1px solid #1f6f47",
// //           }}>
// //             Done
// //           </span>
// //         )}
// //       </div>

// //       {/* Rate-limit advisory — shown after user clicks the button */}
// //       {showWarning && rlAdvisory && (
// //         <div style={{
// //           background: "#0d1117",
// //           border: `1px solid ${enough ? "#1f6f47" : tight ? "#6e4c05" : "#8b1a1a"}`,
// //           borderRadius: 8,
// //           padding: "12px 14px",
// //           display: "flex",
// //           flexDirection: "column",
// //           gap: 10,
// //         }}>
// //           {/* Traffic-light row */}
// //           <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
// //             <span style={{
// //               width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
// //               background: enough ? "#56d364" : tight ? "#fbbf24" : "#f87171",
// //             }} />
// //             <span style={{ fontSize: 13, fontWeight: 600, color: enough ? "#56d364" : tight ? "#fbbf24" : "#f87171" }}>
// //               {enough
// //                 ? "You have enough API calls"
// //                 : tight
// //                   ? "You might run out mid-way"
// //                   : "Rate limit too low — Phase 2 will likely fail"}
// //             </span>
// //           </div>

// //           {/* Stats */}
// //           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
// //             <RlStat label="Issues to check" value={rlAdvisory.needed} color="#e6edf3" />
// //             <RlStat label="API calls remaining" value={rlAdvisory.remaining} color={enough ? "#56d364" : "#f87171"} />
// //             <RlStat label="Total limit" value={rlAdvisory.limit} color="#8b949e" />
// //           </div>

// //           {!enough && rlAdvisory.resetAt && (
// //             <p style={{ fontSize: 12, color: "#8b949e", margin: 0 }}>
// //               Limit resets at <strong style={{ color: "#e6edf3" }}>{rlAdvisory.resetAt.toLocaleTimeString()}</strong>.
// //               {!TOKEN_OK && " Add VITE_GITHUB_TOKEN to your .env for 5000 req/hr."}
// //             </p>
// //           )}

// //           <div style={{ display: "flex", gap: 8 }}>
// //             <button onClick={onConfirm} style={btnStyle(enough ? "#238636" : "#8b1a1a", "#fff")}>
// //               {enough ? "Run Phase 2" : "Run anyway (may fail)"}
// //             </button>
// //             <button onClick={onDismiss} style={btnStyle("#21262d", "#8b949e")}>
// //               Cancel
// //             </button>
// //           </div>
// //         </div>
// //       )}
// //     </div>
// //   );
// // }

// // // ── Small helpers ──────────────────────────────────────────────────────────

// // function StatusRow({ color, children }) {
// //   return (
// //     <div style={{
// //       display: "flex", alignItems: "center", gap: 8,
// //       fontSize: 12, color: "#8b949e", marginBottom: 16,
// //     }}>
// //       <span style={{
// //         width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0,
// //         animation: "blink 1.1s ease-in-out infinite",
// //       }} />
// //       {children}
// //     </div>
// //   );
// // }

// // function RlStat({ label, value, color }) {
// //   return (
// //     <div style={{ background: "#161b22", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
// //       <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
// //       <div style={{ fontSize: 10, color: "#8b949e", marginTop: 2 }}>{label}</div>
// //     </div>
// //   );
// // }

// // function Code({ children }) {
// //   return (
// //     <code style={{ background: "#0d1117", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>
// //       {children}
// //     </code>
// //   );
// // }

// // function btnStyle(bg, color, disabled = false) {
// //   return {
// //     padding: "7px 14px", borderRadius: 6, border: "none",
// //     background: bg, color, fontSize: 13, fontWeight: 600,
// //     cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0,
// //     opacity: disabled ? 0.5 : 1,
// //   };
// // }
