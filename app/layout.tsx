"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, FileText, FilePlus, FolderOpen, Users, BarChart3,
  CreditCard, ShoppingCart, Wallet, BookOpen, Truck, PlusCircle,
  List, ChevronDown, Receipt, Settings,
} from "lucide-react";
import { useState, ReactNode } from "react";

interface NavLeaf { kind: "leaf"; label: string; href: string; icon: ReactNode; }
interface NavGroup { kind: "group"; label: string; icon: ReactNode; children: NavLeaf[]; }
type NavEntry = NavLeaf | NavGroup;
interface NavSectionDef { section: string; entries: NavEntry[]; }

const NAV_STRUCTURE: NavSectionDef[] = [
  {
    section: "Overview",
    entries: [
      { kind: "leaf", label: "Dashboard",  href: "/dashboard", icon: <LayoutDashboard size={16} /> },
    ],
  },
  {
    section: "Billing",
    entries: [
      {
        kind: "group", label: "Invoices", icon: <FileText size={16} />,
        children: [
          { kind: "leaf", label: "New Invoice",   href: "/invoices/new",  icon: <FilePlus size={14} /> },
          { kind: "leaf", label: "Open Invoices", href: "/invoices/open", icon: <FolderOpen size={14} /> },
        ],
      },
      {
        kind: "group", label: "Proforma", icon: <Receipt size={16} />,
        children: [
          { kind: "leaf", label: "New Proforma",  href: "/proforma/new",  icon: <FilePlus size={14} /> },
          { kind: "leaf", label: "View Proforma", href: "/proforma/view", icon: <FolderOpen size={14} /> },
        ],
      },
      {
        kind: "group", label: "Challan", icon: <Truck size={16} />,
        children: [
          { kind: "leaf", label: "New Challan",   href: "/challan/new",  icon: <PlusCircle size={14} /> },
          { kind: "leaf", label: "View Challans", href: "/challan/view", icon: <List size={14} /> },
        ],
      },
    ],
  },
  {
    section: "CRM",
    entries: [
      { kind: "leaf", label: "Customers", href: "/customers", icon: <Users size={16} /> },
    ],
  },
  {
    section: "Accounts",
    entries: [
      {
        kind: "group", label: "Purchases", icon: <ShoppingCart size={16} />,
        children: [
          { kind: "leaf", label: "Add Purchase Bill",  href: "/account/purchase/new",  icon: <PlusCircle size={14} /> },
          { kind: "leaf", label: "View Purchase Bills", href: "/account/purchase/view", icon: <List size={14} /> },
        ],
      },
      {
        kind: "group", label: "Payments", icon: <Wallet size={16} />,
        children: [
          { kind: "leaf", label: "Add Sales Payment", href: "/account/payment", icon: <CreditCard size={14} /> },
          { kind: "leaf", label: "View Ledgers",      href: "/account/ledger",  icon: <BookOpen size={14} /> },
        ],
      },
    ],
  },
  {
    section: "Analytics",
    entries: [
      { kind: "leaf", label: "Reports", href: "/reports", icon: <BarChart3 size={16} /> },
    ],
  },
  {
    section: "System",
    entries: [
      { kind: "leaf", label: "Activity Logs", href: "/settings/logs", icon: <Settings size={16} /> },
    ],
  },
];

function SidebarGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const isChildActive = group.children.some((c) => pathname.startsWith(c.href));
  const [open, setOpen] = useState<boolean>(isChildActive);

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="nav-link" style={{ justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: isChildActive ? "#fff" : "inherit" }}>{group.icon}</span>
          {group.label}
        </span>
        <span style={{ opacity: 0.5, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <ChevronDown size={13} />
        </span>
      </button>
      {open && (
        <div style={{ paddingLeft: 14, marginTop: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          {group.children.map((child) => {
            const active = pathname.startsWith(child.href);
            return (
              <Link key={child.href} href={child.href} className={`nav-link${active ? " active" : ""}`}>
                {child.icon}{child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="sidebar-nav">
      {/* Brand */}
      <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <img src="/images/logo.png" alt="Kumar Enterprises Logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain", background: "rgba(255,255,255,0.9)" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#00000", lineHeight: 1.2 }}>KUMAR ENTERPRISES</div>
          <div style={{ fontSize: 10.5, color: "#93c5fd" }}>Billing & ERP</div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ padding: "10px 8px", flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
        {NAV_STRUCTURE.map((section) => (
          <div key={section.section}>
            <p className="nav-section-label">{section.section}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {section.entries.map((entry) => {
                if (entry.kind === "leaf") {
                  const active = pathname === entry.href || (entry.href !== "/" && pathname.startsWith(entry.href));
                  return (
                    <Link key={entry.href} href={entry.href} className={`nav-link${active ? " active" : ""}`}>
                      {entry.icon}{entry.label}
                    </Link>
                  );
                }
                return <SidebarGroup key={entry.label} group={entry} pathname={pathname} />;
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.12)", fontSize: 11, color: "#93c5fd", flexShrink: 0 }}>
        v2.0 · Local SQLite · Pune
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isRoot = pathname === "/";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>KUMAR ENTERPRISES</title>
        <link rel="icon" type="image/png" href="/images/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        {isRoot ? (
          <main>{children}</main>
        ) : (
          <>
            <Sidebar />
            <main className="main-content">{children}</main>
          </>
        )}
      </body>
    </html>
  );
}
