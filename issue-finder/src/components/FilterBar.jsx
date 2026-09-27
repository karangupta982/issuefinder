const S = {
  select: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #30363d",
    background: "#161b22",
    color: "#e6edf3",
    fontSize: 12,
    cursor: "pointer",
    outline: "none",
  },
  input: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #30363d",
    background: "#161b22",
    color: "#e6edf3",
    fontSize: 12,
    outline: "none",
    flex: "1",
    minWidth: 180,
  },
};

function Toggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 6,
        border: `1px solid ${active ? "#388bfd" : "#30363d"}`,
        background: active ? "#1f6feb22" : "transparent",
        color: active ? "#79c0ff" : "#8b949e",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export default function FilterBar({ filters, onChange, total, filtered }) {
  const set = (key, val) => onChange({ ...filters, [key]: val });

  return (
    <div style={{
      position: "sticky",
      top: 0,
      zIndex: 10,
      background: "#0d1117",
      borderBottom: "1px solid #21262d",
      padding: "12px 0 14px",
      marginBottom: 16,
    }}>
      {/* Row 1: search + selects */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search issues..."
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={S.input}
        />
        <select value={filters.sort} onChange={(e) => set("sort", e.target.value)} style={S.select}>
          <option value="easiest-first">Easiest first</option>
          <option value="hardest-first">Hardest first</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="most-comments">Most comments</option>
          <option value="least-comments">Fewest comments</option>
          <option value="recently-updated">Recently updated</option>
        </select>
        <select value={filters.type} onChange={(e) => set("type", e.target.value)} style={S.select}>
          <option value="all">All types</option>
          <option value="bug">Bug / Defect</option>
          <option value="feature">Feature / Enhancement</option>
          <option value="support">Support / Question</option>
          <option value="documentation">Docs / Readme</option>
          <option value="cleanup">Cleanup / Chore</option>
        </select>
        <select value={filters.age} onChange={(e) => set("age", e.target.value)} style={S.select}>
          <option value="all">Any age</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 6 months</option>
          <option value="365">Last year</option>
        </select>
        <select value={filters.comments} onChange={(e) => set("comments", e.target.value)} style={S.select}>
          <option value="all">Any comments</option>
          <option value="0">No comments</option>
          <option value="1+">Has comments</option>
          <option value="5+">5+ comments</option>
        </select>
      </div>

      {/* Row 2: toggles + count */}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Toggle active={filters.goodFirst}      onClick={() => set("goodFirst",      !filters.goodFirst)}>Good first issue</Toggle>
        <Toggle active={filters.helpWanted}     onClick={() => set("helpWanted",     !filters.helpWanted)}>Help wanted</Toggle>
        <Toggle active={filters.triageAccepted} onClick={() => set("triageAccepted", !filters.triageAccepted)}>Triage accepted</Toggle>
        <Toggle active={filters.noComments}     onClick={() => set("noComments",     !filters.noComments)}>No comments</Toggle>

        <span style={{ marginLeft: "auto", fontSize: 12, color: "#8b949e" }}>
          {filtered} <span style={{ color: "#484f58" }}>/ {total} issues</span>
        </span>
      </div>
    </div>
  );
}






// const S = {
//   select: {
//     padding: "6px 10px",
//     borderRadius: 6,
//     border: "1px solid #30363d",
//     background: "#161b22",
//     color: "#e6edf3",
//     fontSize: 12,
//     cursor: "pointer",
//     outline: "none",
//   },
//   input: {
//     padding: "6px 12px",
//     borderRadius: 6,
//     border: "1px solid #30363d",
//     background: "#161b22",
//     color: "#e6edf3",
//     fontSize: 12,
//     outline: "none",
//     flex: "1",
//     minWidth: 180,
//   },
// };

// function Toggle({ active, onClick, children }) {
//   return (
//     <button
//       onClick={onClick}
//       style={{
//         padding: "5px 12px",
//         borderRadius: 6,
//         border: `1px solid ${active ? "#388bfd" : "#30363d"}`,
//         background: active ? "#1f6feb22" : "transparent",
//         color: active ? "#79c0ff" : "#8b949e",
//         fontSize: 12,
//         fontWeight: active ? 600 : 400,
//         cursor: "pointer",
//         whiteSpace: "nowrap",
//       }}
//     >
//       {children}
//     </button>
//   );
// }

// export default function FilterBar({ filters, onChange, total, filtered }) {
//   const set = (key, val) => onChange({ ...filters, [key]: val });

//   return (
//     <div style={{
//       position: "sticky",
//       top: 0,
//       zIndex: 10,
//       background: "#0d1117",
//       borderBottom: "1px solid #21262d",
//       padding: "12px 0 14px",
//       marginBottom: 16,
//     }}>
//       {/* Row 1: search + selects */}
//       <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
//         <input
//           type="text"
//           placeholder="Search issues..."
//           value={filters.search}
//           onChange={(e) => set("search", e.target.value)}
//           style={S.input}
//         />
//         <select value={filters.sort} onChange={(e) => set("sort", e.target.value)} style={S.select}>
//           <option value="newest">Newest first</option>
//           <option value="oldest">Oldest first</option>
//           <option value="most-comments">Most comments</option>
//           <option value="least-comments">Fewest comments</option>
//           <option value="recently-updated">Recently updated</option>
//         </select>
//         <select value={filters.type} onChange={(e) => set("type", e.target.value)} style={S.select}>
//           <option value="all">All types</option>
//           <option value="kind/bug">Bug</option>
//           <option value="kind/feature">Feature</option>
//           <option value="kind/support">Support</option>
//           <option value="kind/documentation">Documentation</option>
//           <option value="kind/cleanup">Cleanup</option>
//         </select>
//         <select value={filters.age} onChange={(e) => set("age", e.target.value)} style={S.select}>
//           <option value="all">Any age</option>
//           <option value="7">Last 7 days</option>
//           <option value="30">Last 30 days</option>
//           <option value="90">Last 90 days</option>
//           <option value="180">Last 6 months</option>
//           <option value="365">Last year</option>
//         </select>
//         <select value={filters.comments} onChange={(e) => set("comments", e.target.value)} style={S.select}>
//           <option value="all">Any comments</option>
//           <option value="0">No comments</option>
//           <option value="1+">Has comments</option>
//           <option value="5+">5+ comments</option>
//         </select>
//       </div>

//       {/* Row 2: toggles + count */}
//       <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
//         <Toggle active={filters.goodFirst}      onClick={() => set("goodFirst",      !filters.goodFirst)}>Good first issue</Toggle>
//         <Toggle active={filters.helpWanted}     onClick={() => set("helpWanted",     !filters.helpWanted)}>Help wanted</Toggle>
//         <Toggle active={filters.triageAccepted} onClick={() => set("triageAccepted", !filters.triageAccepted)}>Triage accepted</Toggle>
//         <Toggle active={filters.noComments}     onClick={() => set("noComments",     !filters.noComments)}>No comments</Toggle>

//         <span style={{ marginLeft: "auto", fontSize: 12, color: "#8b949e" }}>
//           {filtered} <span style={{ color: "#484f58" }}>/ {total} issues</span>
//         </span>
//       </div>
//     </div>
//   );
// }
