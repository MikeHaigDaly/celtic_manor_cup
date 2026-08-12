"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const items = [
  { href: "/",        label: "Leaderboard" },
  { href: "/score",   label: "Score"       },
  { href: "/players", label: "Players"     },
  { href: "/teams",   label: "Teams"       },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-ink/10 bg-cream/90 backdrop-blur md:hidden">
      <ul className="grid grid-cols-4">
        {items.map((it) => {
          const active = path === it.href || (it.href !== "/" && path.startsWith(it.href));
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={clsx(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[11px] tracking-wider uppercase",
                  active ? "text-ink font-semibold" : "text-ink/60",
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopNav() {
  const path = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-6 text-sm">
      {items.map((it) => {
        const active = path === it.href || (it.href !== "/" && path.startsWith(it.href));
        return (
          <Link key={it.href} href={it.href}
            className={clsx("uppercase tracking-widest",
              active ? "text-ink font-semibold" : "text-ink/60 hover:text-ink")}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

