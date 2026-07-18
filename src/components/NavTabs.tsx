"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/projet", label: "Projet & Modèle" },
  { href: "/notes", label: "Notes rapides" },
  { href: "/chapitres", label: "Chapitres" },
  { href: "/idees", label: "Boîte à idées" },
  { href: "/references", label: "Références" },
  { href: "/journal", label: "Journal de bord" },
  { href: "/today", label: "Aujourd'hui" },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 overflow-x-auto">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tab-btn ${active ? "tab-active" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
