import { isGoodFirstIssue, isHelpWanted } from "../utils/labels";

// Must mirror TYPE_KEYWORDS in IssueFinder.jsx
const BUG_KWS     = ["bug", "defect", "regression", "crash", "fix"];
const FEATURE_KWS = ["feature", "enhancement", "improvement", "request", "feat"];

function hasKeyword(labelNames, keywords) {
  return labelNames.some((n) => keywords.some((kw) => n.toLowerCase().includes(kw)));
}

export default function StatsBar({ issues, filtered, filters, onFilter }) {
  const total     = issues.length;
  const isFiltered = filtered < total;

  const bugs      = issues.filter((i) => hasKeyword(i.labelNames, BUG_KWS)).length;
  const features  = issues.filter((i) => hasKeyword(i.labelNames, FEATURE_KWS)).length;
  const gfi       = issues.filter((i) => isGoodFirstIssue(i.labelNames)).length;
  const hw        = issues.filter((i) => isHelpWanted(i.labelNames)).length;
  const noComment = issues.filter((i) => i.comments === 0).length;

  const activeType   = filters.type;
  const activeGfi    = filters.goodFirst;
  const activeHw     = filters.helpWanted;
  const activeNoComm = filters.noComments;

  function toggleType(slug) {
    onFilter({ ...filters, type: activeType === slug ? "all" : slug });
  }

  function toggleFlag(key) {
    onFilter({ ...filters, [key]: !filters[key] });
  }

  return (
    <div style={{ marginBottom: 20 }}>

      {/* ── Section 1: Scan summary with clickable cells ── */}
      <div style={{
        background: "#161b22",
        border: "1px solid #21262d",
        borderRadius: 10,
        padding: "14px 18px 10px",
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: "#484f58",
          textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 14,
        }}>
          Scan results — all issues with no assignee &amp; no linked PR
          <span style={{ fontWeight: 400, marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>
            · click a card to filter
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* Total — not clickable, just informational */}
          <StatCell
            value={total}
            label="Issues scanned"
            sub="open · unassigned · no PR"
            color="#79c0ff"
            active={false}
            clickable={false}
          />

          <StatCell
            value={bugs}
            label="Bugs"
            sub={pct(bugs, total)}
            color="#f87171"
            active={activeType === "bug"}
            clickable
            onClick={() => toggleType("bug")}
          />

          <StatCell
            value={features}
            label="Enhancements"
            sub={pct(features, total)}
            color="#60a5fa"
            active={activeType === "feature"}
            clickable
            onClick={() => toggleType("feature")}
          />

          <StatCell
            value={noComment}
            label="No comments yet"
            sub="truly untouched"
            color="#fbbf24"
            active={activeNoComm}
            clickable
            onClick={() => toggleFlag("noComments")}
          />

          <StatCell
            value={gfi}
            label="Good first issue"
            sub="labelled by maintainers"
            color="#56d364"
            active={activeGfi}
            clickable
            onClick={() => toggleFlag("goodFirst")}
          />

          <StatCell
            value={hw}
            label="Help wanted"
            sub="maintainers are waiting"
            color="#34d399"
            active={activeHw}
            clickable
            onClick={() => toggleFlag("helpWanted")}
          />
        </div>
      </div>

      {/* ── Section 2: Filter result ── */}
      <div style={{
        background: isFiltered ? "#0d1f12" : "#161b22",
        border: `1px solid ${isFiltered ? "#1f6f47" : "#21262d"}`,
        borderRadius: 10,
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: isFiltered ? "#56d364" : "#79c0ff", lineHeight: 1 }}>
            {filtered}
          </span>
          <span style={{ fontSize: 13, color: "#8b949e" }}>
            {isFiltered
              ? <>issues match your current filters <span style={{ color: "#484f58" }}>({total - filtered} hidden)</span></>
              : "issues shown — no filters applied"}
          </span>
        </div>

        {isFiltered && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#56d364", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#8b949e" }}>Filtered from {total} total</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCell({ value, label, sub, color, active, clickable, onClick }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      title={clickable ? (active ? `Clear "${label}" filter` : `Show only: ${label}`) : undefined}
      style={{
        flex: "1 1 110px",
        minWidth: 100,
        padding: "10px 14px",
        borderRadius: 8,
        border: `1px solid ${active ? color + "55" : "#21262d"}`,
        background: active ? color + "12" : "#0d1117",
        cursor: clickable ? "pointer" : "default",
        transition: "border-color 0.15s, background 0.15s",
        position: "relative",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        if (!clickable) return;
        e.currentTarget.style.borderColor = color + "88";
        e.currentTarget.style.background  = color + "18";
      }}
      onMouseLeave={(e) => {
        if (!clickable) return;
        e.currentTarget.style.borderColor = active ? color + "55" : "#21262d";
        e.currentTarget.style.background  = active ? color + "12" : "#0d1117";
      }}
    >
      {/* Active indicator dot */}
      {active && (
        <span style={{
          position: "absolute", top: 8, right: 8,
          width: 6, height: 6, borderRadius: "50%",
          background: color, display: "inline-block",
        }} />
      )}

      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#c9d1d9", marginTop: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: "#484f58", marginTop: 2 }}>
        {clickable ? (active ? "← click to clear" : sub) : sub}
      </div>
    </div>
  );
}

function pct(n, total) {
  if (!total) return "—";
  return `${Math.round((n / total) * 100)}% of scanned`;
}





// import { isGoodFirstIssue, isHelpWanted } from "../utils/labels";

// export default function StatsBar({ issues, filtered, filters, onFilter }) {
//   const total     = issues.length;
//   const isFiltered = filtered < total;

//   const bugs      = issues.filter((i) => i.labelNames.some((n) => n.includes("bug"))).length;
//   const features  = issues.filter((i) => i.labelNames.some((n) => n.includes("feature") || n.includes("enhancement"))).length;
//   const gfi       = issues.filter((i) => isGoodFirstIssue(i.labelNames)).length;
//   const hw        = issues.filter((i) => isHelpWanted(i.labelNames)).length;
//   const noComment = issues.filter((i) => i.comments === 0).length;

//   // Which stat cell is currently "active" based on current filters
//   const activeType    = filters.type;
//   const activeGfi     = filters.goodFirst;
//   const activeHw      = filters.helpWanted;
//   const activeNoComm  = filters.noComments;

//   function toggleType(typeVal) {
//     // Clicking the active type clears it; clicking another sets it
//     onFilter({ ...filters, type: activeType === typeVal ? "all" : typeVal });
//   }

//   function toggleFlag(key) {
//     onFilter({ ...filters, [key]: !filters[key] });
//   }

//   return (
//     <div style={{ marginBottom: 20 }}>

//       {/* ── Section 1: Scan summary with clickable cells ── */}
//       <div style={{
//         background: "#161b22",
//         border: "1px solid #21262d",
//         borderRadius: 10,
//         padding: "14px 18px 10px",
//         marginBottom: 10,
//       }}>
//         <div style={{
//           fontSize: 11, fontWeight: 600, color: "#484f58",
//           textTransform: "uppercase", letterSpacing: "0.06em",
//           marginBottom: 14,
//         }}>
//           Scan results — all issues with no assignee &amp; no linked PR
//           <span style={{ fontWeight: 400, marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>
//             · click a card to filter
//           </span>
//         </div>

//         <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
//           {/* Total — not clickable, just informational */}
//           <StatCell
//             value={total}
//             label="Issues scanned"
//             sub="open · unassigned · no PR"
//             color="#79c0ff"
//             active={false}
//             clickable={false}
//           />

//           <StatCell
//             value={bugs}
//             label="Bugs"
//             sub={pct(bugs, total)}
//             color="#f87171"
//             active={activeType === "kind/bug"}
//             clickable
//             onClick={() => toggleType("kind/bug")}
//           />

//           <StatCell
//             value={features}
//             label="Enhancements"
//             sub={pct(features, total)}
//             color="#60a5fa"
//             active={activeType === "kind/feature"}
//             clickable
//             onClick={() => toggleType("kind/feature")}
//           />

//           <StatCell
//             value={noComment}
//             label="No comments yet"
//             sub="truly untouched"
//             color="#fbbf24"
//             active={activeNoComm}
//             clickable
//             onClick={() => toggleFlag("noComments")}
//           />

//           <StatCell
//             value={gfi}
//             label="Good first issue"
//             sub="labelled by maintainers"
//             color="#56d364"
//             active={activeGfi}
//             clickable
//             onClick={() => toggleFlag("goodFirst")}
//           />

//           <StatCell
//             value={hw}
//             label="Help wanted"
//             sub="maintainers are waiting"
//             color="#34d399"
//             active={activeHw}
//             clickable
//             onClick={() => toggleFlag("helpWanted")}
//           />
//         </div>
//       </div>

//       {/* ── Section 2: Filter result ── */}
//       <div style={{
//         background: isFiltered ? "#0d1f12" : "#161b22",
//         border: `1px solid ${isFiltered ? "#1f6f47" : "#21262d"}`,
//         borderRadius: 10,
//         padding: "12px 18px",
//         display: "flex",
//         alignItems: "center",
//         gap: 16,
//         flexWrap: "wrap",
//       }}>
//         <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
//           <span style={{ fontSize: 26, fontWeight: 700, color: isFiltered ? "#56d364" : "#79c0ff", lineHeight: 1 }}>
//             {filtered}
//           </span>
//           <span style={{ fontSize: 13, color: "#8b949e" }}>
//             {isFiltered
//               ? <>issues match your current filters <span style={{ color: "#484f58" }}>({total - filtered} hidden)</span></>
//               : "issues shown — no filters applied"}
//           </span>
//         </div>

//         {isFiltered && (
//           <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
//             <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#56d364", display: "inline-block" }} />
//             <span style={{ fontSize: 12, color: "#8b949e" }}>Filtered from {total} total</span>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// function StatCell({ value, label, sub, color, active, clickable, onClick }) {
//   return (
//     <div
//       onClick={clickable ? onClick : undefined}
//       title={clickable ? (active ? `Clear "${label}" filter` : `Show only: ${label}`) : undefined}
//       style={{
//         flex: "1 1 110px",
//         minWidth: 100,
//         padding: "10px 14px",
//         borderRadius: 8,
//         border: `1px solid ${active ? color + "55" : "#21262d"}`,
//         background: active ? color + "12" : "#0d1117",
//         cursor: clickable ? "pointer" : "default",
//         transition: "border-color 0.15s, background 0.15s",
//         position: "relative",
//         userSelect: "none",
//       }}
//       onMouseEnter={(e) => {
//         if (!clickable) return;
//         e.currentTarget.style.borderColor = color + "88";
//         e.currentTarget.style.background  = color + "18";
//       }}
//       onMouseLeave={(e) => {
//         if (!clickable) return;
//         e.currentTarget.style.borderColor = active ? color + "55" : "#21262d";
//         e.currentTarget.style.background  = active ? color + "12" : "#0d1117";
//       }}
//     >
//       {/* Active indicator dot */}
//       {active && (
//         <span style={{
//           position: "absolute", top: 8, right: 8,
//           width: 6, height: 6, borderRadius: "50%",
//           background: color, display: "inline-block",
//         }} />
//       )}

//       <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>
//         {value}
//       </div>
//       <div style={{ fontSize: 12, color: "#c9d1d9", marginTop: 4, fontWeight: 500 }}>
//         {label}
//       </div>
//       <div style={{ fontSize: 11, color: "#484f58", marginTop: 2 }}>
//         {clickable ? (active ? "← click to clear" : sub) : sub}
//       </div>
//     </div>
//   );
// }

// function pct(n, total) {
//   if (!total) return "—";
//   return `${Math.round((n / total) * 100)}% of scanned`;
// }






// // import { isGoodFirstIssue, isHelpWanted } from "../utils/labels";

// // export default function StatsBar({ issues, filtered }) {
// //   const total      = issues.length;
// //   const isFiltered = filtered < total;

// //   // Counts from full scanned set
// //   const bugs       = issues.filter((i) => i.labelNames.some((n) => n.includes("bug"))).length;
// //   const features   = issues.filter((i) => i.labelNames.some((n) => n.includes("feature") || n.includes("enhancement"))).length;
// //   const gfi        = issues.filter((i) => isGoodFirstIssue(i.labelNames)).length;
// //   const hw         = issues.filter((i) => isHelpWanted(i.labelNames)).length;
// //   const noComment  = issues.filter((i) => i.comments === 0).length;

// //   return (
// //     <div style={{ marginBottom: 20 }}>

// //       {/* ── Section 1: Scan summary ── */}
// //       <div style={{
// //         background: "#161b22",
// //         border: "1px solid #21262d",
// //         borderRadius: 10,
// //         padding: "14px 18px",
// //         marginBottom: 10,
// //       }}>
// //         <div style={{
// //           fontSize: 11,
// //           fontWeight: 600,
// //           color: "#484f58",
// //           textTransform: "uppercase",
// //           letterSpacing: "0.06em",
// //           marginBottom: 12,
// //         }}>
// //           Scan results — all issues with no assignee &amp; no linked PR
// //         </div>

// //         <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
// //           <StatCell
// //             value={total}
// //             label="Issues scanned"
// //             sub="open · unassigned · no PR"
// //             color="#79c0ff"
// //             border
// //           />
// //           <StatCell
// //             value={bugs}
// //             label="Bugs"
// //             sub={pct(bugs, total)}
// //             color="#f87171"
// //             border
// //           />
// //           <StatCell
// //             value={features}
// //             label="Enhancements"
// //             sub={pct(features, total)}
// //             color="#60a5fa"
// //             border
// //           />
// //           <StatCell
// //             value={noComment}
// //             label="No comments yet"
// //             sub="truly untouched"
// //             color="#fbbf24"
// //             border
// //           />
// //           <StatCell
// //             value={gfi}
// //             label="Good first issue"
// //             sub="labelled by maintainers"
// //             color="#56d364"
// //             border
// //           />
// //           <StatCell
// //             value={hw}
// //             label="Help wanted"
// //             sub="maintainers are waiting"
// //             color="#34d399"
// //           />
// //         </div>
// //       </div>

// //       {/* ── Section 2: Filter result ── */}
// //       <div style={{
// //         background: isFiltered ? "#0d1f12" : "#161b22",
// //         border: `1px solid ${isFiltered ? "#1f6f47" : "#21262d"}`,
// //         borderRadius: 10,
// //         padding: "12px 18px",
// //         display: "flex",
// //         alignItems: "center",
// //         gap: 16,
// //         flexWrap: "wrap",
// //       }}>
// //         <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
// //           <span style={{ fontSize: 26, fontWeight: 700, color: isFiltered ? "#56d364" : "#79c0ff", lineHeight: 1 }}>
// //             {filtered}
// //           </span>
// //           <span style={{ fontSize: 13, color: "#8b949e" }}>
// //             {isFiltered
// //               ? <>issues match your current filters <span style={{ color: "#484f58" }}>({total - filtered} hidden)</span></>
// //               : "issues shown — no filters applied"}
// //           </span>
// //         </div>

// //         {isFiltered && (
// //           <div style={{
// //             marginLeft: "auto",
// //             fontSize: 12,
// //             color: "#8b949e",
// //             display: "flex",
// //             alignItems: "center",
// //             gap: 6,
// //           }}>
// //             <span style={{
// //               display: "inline-block",
// //               width: 8, height: 8,
// //               borderRadius: "50%",
// //               background: "#56d364",
// //             }} />
// //             Filtered from {total} total
// //           </div>
// //         )}
// //       </div>
// //     </div>
// //   );
// // }

// // function StatCell({ value, label, sub, color, border }) {
// //   return (
// //     <div style={{
// //       flex: "1 1 120px",
// //       padding: "8px 16px 8px 0",
// //       marginRight: border ? 16 : 0,
// //       borderRight: border ? "1px solid #21262d" : "none",
// //       minWidth: 100,
// //     }}>
// //       <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>
// //         {value}
// //       </div>
// //       <div style={{ fontSize: 12, color: "#c9d1d9", marginTop: 3, fontWeight: 500 }}>
// //         {label}
// //       </div>
// //       <div style={{ fontSize: 11, color: "#484f58", marginTop: 2 }}>
// //         {sub}
// //       </div>
// //     </div>
// //   );
// // }

// // function pct(n, total) {
// //   if (!total) return "—";
// //   return `${Math.round((n / total) * 100)}% of scanned`;
// // }





// // // import { isGoodFirstIssue, isHelpWanted } from "../utils/labels";

// // // export default function StatsBar({ issues, filtered }) {
// // //   const bugs      = issues.filter((i) => i.labelNames.some((n) => n.includes("bug"))).length;
// // //   const features  = issues.filter((i) => i.labelNames.some((n) => n.includes("feature"))).length;
// // //   const gfi       = issues.filter((i) => isGoodFirstIssue(i.labelNames)).length;
// // //   const hw        = issues.filter((i) => isHelpWanted(i.labelNames)).length;
// // //   const noComment = issues.filter((i) => i.comments === 0).length;

// // //   const stats = [
// // //     { label: "Total",         value: issues.length, color: "#79c0ff" },
// // //     { label: "Showing",       value: filtered,       color: "#a371f7" },
// // //     { label: "Bugs",          value: bugs,           color: "#f87171" },
// // //     { label: "Features",      value: features,       color: "#60a5fa" },
// // //     { label: "Good first",    value: gfi,            color: "#56d364" },
// // //     { label: "Help wanted",   value: hw,             color: "#34d399" },
// // //     { label: "No comments",   value: noComment,      color: "#fbbf24" },
// // //   ];

// // //   return (
// // //     <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
// // //       {stats.map((s) => (
// // //         <div key={s.label} style={{
// // //           background: "#161b22",
// // //           border: "1px solid #21262d",
// // //           borderRadius: 8,
// // //           padding: "8px 14px",
// // //           minWidth: 80,
// // //           textAlign: "center",
// // //         }}>
// // //           <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>
// // //             {s.value}
// // //           </div>
// // //           <div style={{ fontSize: 11, color: "#8b949e", marginTop: 3, whiteSpace: "nowrap" }}>
// // //             {s.label}
// // //           </div>
// // //         </div>
// // //       ))}
// // //     </div>
// // //   );
// // // }
