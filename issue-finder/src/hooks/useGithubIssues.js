// import { useCallback, useRef, useState } from "react";

// const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;

// function parseRepo(input) {
//   if (!input) return null;
//   const trimmed = input.trim().replace(/\/$/, "");
//   // Accept full URL or owner/repo
//   const urlMatch = trimmed.match(/github\.com\/([^/]+\/[^/]+)/);
//   if (urlMatch) return urlMatch[1];
//   if (/^[^/]+\/[^/]+$/.test(trimmed)) return trimmed;
//   return null;
// }

// async function fetchPage(repo, page) {
//   const headers = {
//     Accept: "application/vnd.github.v3+json",
//     "User-Agent": "issue-finder-app",
//   };
//   if (TOKEN) headers["Authorization"] = `token ${TOKEN}`;

//   const url = `https://api.github.com/repos/${repo}/issues?state=open&assignee=none&per_page=100&page=${page}`;
//   const res = await fetch(url, { headers });

//   if (res.status === 401) throw new Error("Invalid token — check VITE_GITHUB_TOKEN in your .env");
//   if (res.status === 404) throw new Error(`Repository "${repo}" not found or is private`);
//   if (res.status === 403 || res.status === 429) {
//     const reset = res.headers.get("X-RateLimit-Reset");
//     const remaining = res.headers.get("X-RateLimit-Remaining");
//     if (remaining === "0") {
//       const resetTime = reset ? new Date(reset * 1000).toLocaleTimeString() : "unknown";
//       throw new Error(`Rate limit hit — resets at ${resetTime}. Add VITE_GITHUB_TOKEN to .env for 5000 req/hr.`);
//     }
//     throw new Error(`GitHub returned ${res.status} — try again shortly`);
//   }
//   if (!res.ok) throw new Error(`GitHub API error ${res.status}`);

//   const data = await res.json();
//   const remaining = parseInt(res.headers.get("X-RateLimit-Remaining") || "0");
//   const limit = parseInt(res.headers.get("X-RateLimit-Limit") || "60");
//   return { data, remaining, limit };
// }

// function parseIssue(raw) {
//   const labels = (raw.labels || []).map((l) => ({ name: l.name, color: l.color }));
//   return {
//     number:     raw.number,
//     title:      raw.title,
//     url:        raw.html_url,
//     labels,
//     labelNames: labels.map((l) => l.name),
//     createdAt:  raw.created_at,
//     updatedAt:  raw.updated_at,
//     comments:   raw.comments,
//     body:       raw.body || "",
//     user:       raw.user?.login || "unknown",
//     userUrl:    raw.user?.html_url || "",
//     userAvatar: raw.user?.avatar_url || "",
//   };
// }

// export function useGithubIssues() {
//   const [issues, setIssues]     = useState([]);
//   const [status, setStatus]     = useState("idle");
//   const [error, setError]       = useState("");
//   const [progress, setProgress] = useState({ page: 0, found: 0, rl: null, rlMax: null });
//   const stopRef = useRef(false);

//   const start = useCallback(async (repoInput) => {
//     const repo = parseRepo(repoInput);
//     if (!repo) {
//       setError("Enter a valid GitHub repo — e.g. facebook/react or https://github.com/facebook/react");
//       setStatus("error");
//       return;
//     }

//     stopRef.current = false;
//     setIssues([]);
//     setError("");
//     setStatus("running");
//     setProgress({ page: 0, found: 0, rl: null, rlMax: null });

//     const collected = [];
//     let page = 1;

//     try {
//       while (!stopRef.current) {
//         setProgress((p) => ({ ...p, page }));
//         const { data, remaining, limit } = await fetchPage(repo, page);
//         if (!Array.isArray(data) || data.length === 0) break;

//         for (const raw of data) {
//           if (raw.pull_request) continue;
//           collected.push(parseIssue(raw));
//         }

//         setProgress({ page, found: collected.length, rl: remaining, rlMax: limit });
//         setIssues([...collected]);

//         if (data.length < 100) break;
//         page++;
//         await new Promise((r) => setTimeout(r, 200));
//       }
//       setStatus("done");
//     } catch (e) {
//       setError(e.message);
//       setStatus("error");
//     }
//   }, []);

//   const stop = useCallback(() => {
//     stopRef.current = true;
//     setStatus("done");
//   }, []);

//   const reset = useCallback(() => {
//     stopRef.current = true;
//     setIssues([]);
//     setError("");
//     setStatus("idle");
//     setProgress({ page: 0, found: 0, rl: null, rlMax: null });
//   }, []);

//   return { issues, status, error, progress, start, stop, reset };
// }


import { useCallback, useRef, useState } from "react";

const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;

// ── Shared helpers ─────────────────────────────────────────────────────────

export function parseRepo(input) {
  if (!input) return null;
  const trimmed = input.trim().replace(/\/$/, "");
  const urlMatch = trimmed.match(/github\.com\/([^/]+\/[^/]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[^/]+\/[^/]+$/.test(trimmed)) return trimmed;
  return null;
}

function authHeaders(acceptOverride) {
  return {
    Accept: acceptOverride || "application/vnd.github.v3+json",
    "User-Agent": "issue-finder-app",
    ...(TOKEN ? { Authorization: `token ${TOKEN}` } : {}),
  };
}

function handleApiError(res) {
  if (res.status === 401) throw new Error("Invalid token — check VITE_GITHUB_TOKEN in your .env");
  if (res.status === 404) throw new Error("Repository not found or is private");
  if (res.status === 403 || res.status === 429) {
    const reset     = res.headers.get("X-RateLimit-Reset");
    const remaining = res.headers.get("X-RateLimit-Remaining");
    if (remaining === "0") {
      const t = reset ? new Date(reset * 1000).toLocaleTimeString() : "unknown";
      throw new Error(`Rate limit exhausted — resets at ${t}. Add VITE_GITHUB_TOKEN to .env for 5000 req/hr.`);
    }
    throw new Error(`GitHub returned ${res.status} — try again shortly`);
  }
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
}

function rlFromHeaders(res) {
  return {
    rl:    parseInt(res.headers.get("X-RateLimit-Remaining") || "0"),
    rlMax: parseInt(res.headers.get("X-RateLimit-Limit")     || "60"),
    rlReset: parseInt(res.headers.get("X-RateLimit-Reset")   || "0"),
  };
}

// ── Rate limit pre-check ───────────────────────────────────────────────────
// Returns { remaining, limit, resetAt } before Phase 2 so we can warn.

export async function fetchRateLimit() {
  const res = await fetch("https://api.github.com/rate_limit", { headers: authHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  const core = data.resources?.core || {};
  return {
    remaining: core.remaining ?? 0,
    limit:     core.limit     ?? 60,
    resetAt:   core.reset     ? new Date(core.reset * 1000) : null,
  };
}

// ── Phase 1: paginate open unassigned issues ───────────────────────────────

async function fetchIssuePage(repo, page) {
  const url = `https://api.github.com/repos/${repo}/issues?state=open&assignee=none&per_page=100&page=${page}`;
  const res = await fetch(url, { headers: authHeaders() });
  handleApiError(res);
  const data = await res.json();
  return { data, ...rlFromHeaders(res) };
}

function parseIssue(raw) {
  const labels = (raw.labels || []).map((l) => ({ name: l.name, color: l.color }));
  return {
    number:     raw.number,
    title:      raw.title,
    url:        raw.html_url,
    labels,
    labelNames: labels.map((l) => l.name),
    createdAt:  raw.created_at,
    updatedAt:  raw.updated_at,
    comments:   raw.comments,
    body:       raw.body || "",
    user:       raw.user?.login || "unknown",
    userUrl:    raw.user?.html_url || "",
    userAvatar: raw.user?.avatar_url || "",
  };
}

// ── Phase 2: timeline check for linked PRs ────────────────────────────────
// Uses the mockingbird-preview timeline API. Pages through events and returns
// true if any cross-referenced event has a pull_request source.

async function issueHasLinkedPR(repo, issueNumber) {
  let page = 1;
  while (true) {
    const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/timeline?per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: authHeaders("application/vnd.github.mockingbird-preview+json"),
    });
    if (!res.ok) return false; // fail open — don't exclude on API error

    const events = await res.json();
    if (!Array.isArray(events) || events.length === 0) return false;

    for (const ev of events) {
      if (
        ev.event === "cross-referenced" &&
        ev.source?.type === "issue" &&
        ev.source?.issue?.pull_request !== undefined
      ) {
        return true;
      }
    }

    if (events.length < 100) return false;
    page++;
  }
}

// ── Bounded concurrency pool ───────────────────────────────────────────────

async function pMap(items, fn, { concurrency = 8, shouldStop = () => false } = {}) {
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < items.length) {
      if (shouldStop()) return;
      const i = nextIdx++;
      await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

const INIT_PROGRESS = {
  phase: "idle",   // "scanning" | "done-phase1" | "checking" | "done"
  page: 0,
  fetched: 0,
  checked: 0,
  found: 0,
  rl: null,
  rlMax: null,
  rlReset: null,
};

export function useGithubIssues() {
  // Phase 1 results — the unfiltered list, kept so Phase 2 can work on them
  const rawIssuesRef = useRef([]);
  const repoRef      = useRef(null);

  const [issues,   setIssues]   = useState([]);   // what the UI renders
  const [status,   setStatus]   = useState("idle");
  const [error,    setError]    = useState("");
  const [progress, setProgress] = useState(INIT_PROGRESS);

  // Rate-limit advisory shown before Phase 2
  const [rlAdvisory, setRlAdvisory] = useState(null); // null | { remaining, limit, resetAt, needed }

  const stopRef = useRef(false);

  // ── Phase 1 ─────────────────────────────────────────────────────────────
  const startPhase1 = useCallback(async (repoInput) => {
    const repo = parseRepo(repoInput);
    if (!repo) {
      setError("Enter a valid GitHub repo — e.g. facebook/react or https://github.com/facebook/react");
      setStatus("error");
      return;
    }

    stopRef.current    = false;
    repoRef.current    = repo;
    rawIssuesRef.current = [];

    setIssues([]);
    setError("");
    setRlAdvisory(null);
    setStatus("running");
    setProgress({ ...INIT_PROGRESS, phase: "scanning" });

    const collected = [];
    let page = 1;

    try {
      while (!stopRef.current) {
        setProgress((p) => ({ ...p, page }));
        const { data, rl, rlMax, rlReset } = await fetchIssuePage(repo, page);
        if (!Array.isArray(data) || data.length === 0) break;

        for (const raw of data) {
          if (!raw.pull_request) collected.push(parseIssue(raw));
        }

        rawIssuesRef.current = collected;
        setProgress((p) => ({ ...p, fetched: collected.length, rl, rlMax, rlReset }));
        setIssues([...collected]);

        if (data.length < 100) break;
        page++;
        await new Promise((r) => setTimeout(r, 200));
      }
      setStatus("done-phase1");
      setProgress((p) => ({ ...p, phase: "done-phase1" }));
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }, []);

  // ── Rate-limit advisory check (called when user hovers/clicks Phase 2 btn) ─
  const checkRateLimit = useCallback(async () => {
    const rl = await fetchRateLimit();
    if (!rl) return;
    const needed = rawIssuesRef.current.length; // 1 req per issue minimum
    setRlAdvisory({ ...rl, needed });
  }, []);

  // ── Phase 2 ─────────────────────────────────────────────────────────────
  const startPhase2 = useCallback(async () => {
    const repo      = repoRef.current;
    const rawIssues = rawIssuesRef.current;
    if (!repo || rawIssues.length === 0) return;

    stopRef.current = false;
    setError("");
    setRlAdvisory(null);
    setStatus("running");
    setProgress((p) => ({ ...p, phase: "checking", checked: 0, found: 0 }));

    // Clear the issue list — we'll rebuild it with only clean issues
    setIssues([]);

    const confirmed = [];
    let checked = 0;

    try {
      await pMap(
        rawIssues,
        async (issue) => {
          if (stopRef.current) return;
          const hasLinkedPR = await issueHasLinkedPR(repo, issue.number);
          checked++;
          if (!hasLinkedPR) {
            confirmed.push(issue);
            confirmed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setIssues([...confirmed]);
          }
          setProgress((p) => ({ ...p, checked, found: confirmed.length }));
        },
        {
          concurrency: TOKEN ? 10 : 3,
          shouldStop: () => stopRef.current,
        }
      );
      setStatus("done");
      setProgress((p) => ({ ...p, phase: "done" }));
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }, []);

  // ── Stop / Reset ─────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    stopRef.current = true;
    // preserve whatever phase we were in
    setStatus((s) => s === "running" ? (
      rawIssuesRef.current.length > 0 ? "done-phase1" : "idle"
    ) : s);
    setProgress((p) => ({
      ...p,
      phase: p.phase === "checking" ? "done-phase1" : p.phase,
    }));
  }, []);

  const reset = useCallback(() => {
    stopRef.current      = true;
    rawIssuesRef.current = [];
    repoRef.current      = null;
    setIssues([]);
    setError("");
    setRlAdvisory(null);
    setStatus("idle");
    setProgress(INIT_PROGRESS);
  }, []);

  return {
    issues,
    status,       // "idle" | "running" | "done-phase1" | "done" | "error"
    error,
    progress,
    rlAdvisory,
    startPhase1,
    startPhase2,
    checkRateLimit,
    stop,
    reset,
  };
}
