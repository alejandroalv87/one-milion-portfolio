"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const NAV = [
  { key: "dashboard", label: "Portfolio", href: "/", icon: "▣" },
  { key: "allocation", label: "Cash & Allocation", href: "/allocation", icon: "◐" },
  { key: "history", label: "History", href: "/history", icon: "↗" },
  { key: "import", label: "Import holdings", href: "/?import=1", icon: "⇪" },
];

export default function AppShell({ active, children }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function go(e) {
    e.preventDefault();
    const sym = q.trim().toUpperCase().replace(/\s+/g, "");
    if (sym) {
      router.push(`/stock/${encodeURIComponent(sym)}`);
      setQ("");
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">◆</span> Portfolio Terminal
        </div>
        <div className="navlabel">Workspace</div>
        {NAV.map((n) => (
          <div
            key={n.key}
            className={"navitem" + (active === n.key ? " active" : "")}
            onClick={() => router.push(n.href)}
          >
            <span style={{ width: 16, display: "inline-block" }}>{n.icon}</span>
            {n.label}
          </div>
        ))}
      </aside>

      <div className="main">
        <div className="topbar">
          <form className="search" onSubmit={go}>
            <span className="muted">🔍</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a ticker (e.g. AAPL, GOOGL)…"
              aria-label="Search ticker"
            />
          </form>
          <div className="muted" style={{ fontSize: 12.5 }}>Live market data</div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
