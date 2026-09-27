import { useState } from "react";
import {
  labelFgFromHex,
  getTypeInfo,
  isGoodFirstIssue,
  isHelpWanted,
  timeAgo,
  ageColor,
} from "../utils/labels";

export default function IssueCard({ issue }) {
  const [copied, setCopied]     = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { accent } = getTypeInfo(issue.labelNames);
  const gfi        = isGoodFirstIssue(issue.labelNames);
  const hw         = isHelpWanted(issue.labelNames);
  const bodyText   = issue.body?.trim().slice(0, 380);
  const age        = ageColor(issue.createdAt);

  function copy() {
    navigator.clipboard.writeText(`#${issue.number} ${issue.title}\n${issue.url}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div style={{
      background: "#161b22",
      border: "1px solid #21262d",
      borderLeft: `3px solid ${accent}`,
      borderRadius: 10,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      transition: "border-color 0.15s",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#30363d"; e.currentTarget.style.borderLeftColor = accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#21262d"; e.currentTarget.style.borderLeftColor = accent; }}
    >
      {/* Row 1: number + title + actions */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: accent,
          fontFamily: "monospace", whiteSpace: "nowrap",
          marginTop: 2, minWidth: 44,
        }}>
          #{issue.number}
        </span>

        <span style={{
          flex: 1, fontSize: 14, fontWeight: 500,
          color: "#e6edf3", lineHeight: 1.5,
        }}>
          {issue.title}
        </span>

        <div style={{ display: "flex", gap: 6, flexShrink: 0, marginTop: 1 }}>
          <button onClick={copy} style={actionBtn(copied ? "#1f6feb" : undefined)}>
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            style={{ ...actionBtn(), textDecoration: "none" }}
          >
            Open
          </a>
        </div>
      </div>

      {/* Row 2: special badges */}
      {(gfi || hw) && (
        <div style={{ display: "flex", gap: 6 }}>
          {gfi && <Badge text="Good first issue" bg="#0d419d" color="#79c0ff" />}
          {hw  && <Badge text="Help wanted"      bg="#1a3c34" color="#56d364" />}
        </div>
      )}

      {/* Row 3: labels */}
      {issue.labels.filter((l) => !["good first issue", "help wanted"].includes(l.name.toLowerCase())).length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {issue.labels
            .filter((l) => !["good first issue", "help wanted"].includes(l.name.toLowerCase()))
            .map((l) => {
              const fg = labelFgFromHex(l.color);
              return (
                <span key={l.name} style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 500,
                  background: `#${l.color}`, color: fg,
                }}>
                  {l.name}
                </span>
              );
            })}
        </div>
      )}

      {/* Row 4: meta */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
        <img
          src={issue.userAvatar}
          alt={issue.user}
          style={{ width: 16, height: 16, borderRadius: "50%", marginRight: 6 }}
        />
        <a
          href={issue.userUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12, color: "#8b949e", textDecoration: "none", marginRight: 16 }}
        >
          {issue.user}
        </a>

        <span style={{ fontSize: 12, color: age, marginRight: 16, fontWeight: 500 }}>
          {timeAgo(issue.createdAt)}
        </span>

        <span style={{ fontSize: 12, color: "#8b949e", marginRight: 16 }}>
          updated {timeAgo(issue.updatedAt)}
        </span>

        <span style={{
          fontSize: 12,
          color: issue.comments === 0 ? "#fbbf24" : "#8b949e",
          fontWeight: issue.comments === 0 ? 600 : 400,
          marginRight: "auto",
        }}>
          {issue.comments === 0 ? "No comments" : `${issue.comments} comment${issue.comments !== 1 ? "s" : ""}`}
        </span>

        {bodyText && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              fontSize: 11, color: "#8b949e", background: "none",
              border: "none", cursor: "pointer", padding: 0,
            }}
          >
            {expanded ? "Hide" : "Preview"}
          </button>
        )}
      </div>

      {/* Body preview */}
      {expanded && bodyText && (
        <div style={{
          fontSize: 12, color: "#8b949e", background: "#0d1117",
          border: "1px solid #21262d", borderRadius: 6,
          padding: "10px 12px", lineHeight: 1.65,
          whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto",
          fontFamily: "ui-monospace, monospace",
        }}>
          {bodyText}{issue.body.length > 380 ? " …" : ""}
        </div>
      )}
    </div>
  );
}

function Badge({ text, bg, color }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 9px",
      borderRadius: 99, background: bg, color,
    }}>
      {text}
    </span>
  );
}

function actionBtn(activeColor) {
  return {
    padding: "3px 10px",
    borderRadius: 6,
    border: `1px solid ${activeColor || "#30363d"}`,
    background: activeColor ? `${activeColor}22` : "transparent",
    color: activeColor || "#8b949e",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    display: "inline-block",
  };
}
