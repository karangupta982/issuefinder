// Derive a readable foreground from a GitHub label hex color
export function labelFgFromHex(hex) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#0f172a" : "#f8fafc";
}

export function isGoodFirstIssue(names) {
  return names.some((n) => n.toLowerCase().includes("good first issue"));
}

export function isHelpWanted(names) {
  return names.some((n) => n.toLowerCase().includes("help wanted"));
}

export function isTriageAccepted(names) {
  return names.some((n) => n.toLowerCase().includes("triage/accepted") || n.toLowerCase() === "accepted");
}

export function getTypeInfo(names) {
  const lc = names.map((n) => n.toLowerCase());
  const has = (...kws) => lc.some((n) => kws.some((kw) => n.includes(kw)));
  if (has("bug", "defect", "regression", "crash"))             return { type: "bug",     accent: "#f87171" };
  if (has("feature", "enhancement", "improvement", "feat"))    return { type: "feature", accent: "#60a5fa" };
  if (has("support", "question"))                              return { type: "support", accent: "#fbbf24" };
  if (has("doc", "readme", "wiki", "typo", "spelling"))        return { type: "docs",    accent: "#a78bfa" };
  if (has("cleanup", "chore", "refactor", "lint", "style"))    return { type: "cleanup", accent: "#34d399" };
  return                                                               { type: "other",   accent: "#94a3b8" };
}

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function ageColor(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days < 7)   return "#34d399";
  if (days < 30)  return "#60a5fa";
  if (days < 90)  return "#fbbf24";
  if (days < 365) return "#f97316";
  return "#f87171";
}

// ── Complexity scorer ──────────────────────────────────────────────────────
// Returns a score 0–100. Lower = easier to pick up and get merged.
// Pure function — uses only data already in the issue object, no extra API calls.

const EASY_LABEL_PATTERNS = [
  "good first issue", "beginner", "starter", "easy",
  "documentation", "docs", "doc", "typo", "readme",
  "cleanup", "chore", "refactor", "style", "formatting",
  "test", "testing", "ci",
];

const HARD_LABEL_PATTERNS = [
  "bug", "regression", "crash", "panic", "security", "cve",
  "performance", "memory", "leak", "race", "deadlock", "breaking",
  "core", "arch", "architecture", "design", "rfc", "epic",
  "priority/critical", "priority/important",
];

const EASY_TITLE_WORDS = [
  "typo", "doc", "docs", "readme", "comment", "spelling",
  "add", "update", "bump", "clean", "format", "lint",
  "test", "example", "log", "link", "copyright", "license",
  "missing", "fix typo",
];

const HARD_TITLE_WORDS = [
  "race condition", "deadlock", "memory leak", "segfault", "panic",
  "regression", "breaking", "refactor", "rearchitect", "redesign",
  "performance", "concurrent", "parallel", "async", "cache",
  "security", "cve", "vulnerability", "exploit",
  "migration", "upgrade", "deprecat",
];

export function complexityScore(issue) {
  let score = 50; // neutral baseline
  const title  = (issue.title  || "").toLowerCase();
  const body   = (issue.body   || "").toLowerCase();
  const labels = issue.labelNames.map((n) => n.toLowerCase());

  // ── Label signals ──────────────────────────────────────────────────────
  for (const pat of EASY_LABEL_PATTERNS) {
    if (labels.some((l) => l.includes(pat))) { score -= 20; break; }
  }
  for (const pat of HARD_LABEL_PATTERNS) {
    if (labels.some((l) => l.includes(pat))) { score += 15; break; }
  }

  // ── "good first issue" is a strong standalone signal ──────────────────
  if (labels.some((l) => l.includes("good first issue"))) score -= 25;

  // ── Title keyword signals ──────────────────────────────────────────────
  for (const word of EASY_TITLE_WORDS) {
    if (title.includes(word)) { score -= 10; break; }
  }
  for (const phrase of HARD_TITLE_WORDS) {
    if (title.includes(phrase)) { score += 15; break; }
  }

  // ── Title length — longer titles often mean more complex problems ──────
  if (title.length < 40)  score -= 5;
  if (title.length > 80)  score += 8;
  if (title.length > 120) score += 7;

  // ── Body length — longer descriptions = more context needed ───────────
  const bodyLen = body.length;
  if (bodyLen === 0)         score -= 5;  // no description = probably tiny
  if (bodyLen < 200)         score -= 5;
  if (bodyLen > 1000)        score += 8;
  if (bodyLen > 3000)        score += 10;
  if (bodyLen > 6000)        score += 7;

  // ── Comment count — heavily discussed = contested or complex ──────────
  const c = issue.comments;
  if (c === 0)  score -= 8;
  if (c >= 5)   score += 8;
  if (c >= 10)  score += 8;
  if (c >= 20)  score += 9;

  // ── Age — issues open > 1 year often have blockers or deep complexity ─
  const ageDays = Math.floor((Date.now() - new Date(issue.createdAt)) / 86400000);
  if (ageDays > 365) score += 10;
  if (ageDays > 730) score += 8;

  // ── Clamp to 0–100 ────────────────────────────────────────────────────
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function complexityLabel(score) {
  if (score <= 25) return { text: "Easy",   color: "#56d364", bg: "#1a3c34" };
  if (score <= 45) return { text: "Low",    color: "#34d399", bg: "#0f2922" };
  if (score <= 60) return { text: "Medium", color: "#fbbf24", bg: "#2d2208" };
  if (score <= 75) return { text: "High",   color: "#f97316", bg: "#2d1600" };
  return                   { text: "Hard",  color: "#f87171", bg: "#3d1c1e" };
}






// // Derive a readable foreground from a GitHub label hex color
// export function labelFgFromHex(hex) {
//   const r = parseInt(hex.slice(0, 2), 16);
//   const g = parseInt(hex.slice(2, 4), 16);
//   const b = parseInt(hex.slice(4, 6), 16);
//   const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
//   return luminance > 0.55 ? "#0f172a" : "#f8fafc";
// }

// export function isGoodFirstIssue(names) {
//   return names.some((n) => n.toLowerCase().includes("good first issue"));
// }

// export function isHelpWanted(names) {
//   return names.some((n) => n.toLowerCase().includes("help wanted"));
// }

// export function isTriageAccepted(names) {
//   return names.some((n) => n.toLowerCase().includes("triage/accepted") || n.toLowerCase() === "accepted");
// }

// export function getTypeInfo(names) {
//   if (names.some((n) => n.includes("bug")))           return { type: "bug",     accent: "#f87171" };
//   if (names.some((n) => n.includes("feature")))       return { type: "feature", accent: "#60a5fa" };
//   if (names.some((n) => n.includes("support")))       return { type: "support", accent: "#fbbf24" };
//   if (names.some((n) => n.includes("documentation") || n.includes("docs"))) return { type: "docs", accent: "#a78bfa" };
//   if (names.some((n) => n.includes("cleanup")))       return { type: "cleanup", accent: "#34d399" };
//   return                                                      { type: "other",   accent: "#94a3b8" };
// }

// export function timeAgo(dateStr) {
//   const diff = Date.now() - new Date(dateStr).getTime();
//   const mins  = Math.floor(diff / 60000);
//   const hours = Math.floor(diff / 3600000);
//   const days  = Math.floor(diff / 86400000);
//   if (mins < 60)  return `${mins}m ago`;
//   if (hours < 24) return `${hours}h ago`;
//   if (days < 7)   return `${days}d ago`;
//   if (days < 30)  return `${Math.floor(days / 7)}w ago`;
//   if (days < 365) return `${Math.floor(days / 30)}mo ago`;
//   return `${Math.floor(days / 365)}y ago`;
// }

// export function ageColor(dateStr) {
//   const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
//   if (days < 7)   return "#34d399";
//   if (days < 30)  return "#60a5fa";
//   if (days < 90)  return "#fbbf24";
//   if (days < 365) return "#f97316";
//   return "#f87171";
// }
