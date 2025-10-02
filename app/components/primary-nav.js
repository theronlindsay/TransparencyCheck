"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "Recent", href: "/" },
  { label: "Bills", href: "/#bills" },
  { label: "Hierarchy", href: "/#hierarchy" },
  { label: "Chat", href: "/#chat" },
];

function isActive(pathname, hash, href) {
  if (href === "#") return false;
  if (href === "/") {
    return pathname === "/" && (!hash || hash === "#" || hash === "#recent");
  }
  if (href.startsWith("/#")) {
    const targetHash = href.slice(href.indexOf("#"));
    return pathname === "/" && hash === targetHash;
  }
  return pathname.startsWith(href);
}

export default function PrimaryNav() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const updateHash = () => {
      setHash(window.location.hash || "");
    };
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  return (
    <nav className="fixed top-6 right-6 z-50 flex items-center gap-1 rounded-full border border-neutral-700/80 bg-neutral-900/95 px-2 py-2 shadow-lg shadow-black/30 backdrop-blur">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, hash, item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${
              active
                ? "bg-red-600 text-white shadow shadow-red-600/40"
                : "text-neutral-200 hover:bg-neutral-800/70"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
