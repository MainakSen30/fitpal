"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FitPalMark } from "@/components/fitpal-mark";

const footerLinks: Record<string, { label: string; href: string }[]> = {
  "/": [
    { label: "Features", href: "/features/workout-logging" },
    { label: "Download", href: "#download" },
  ],
  "/features/workout-logging": [{ label: "Next: Custom Routines →", href: "/features/routines" }],
  "/features/routines": [{ label: "Next: Complete Logbook →", href: "/features/logbook" }],
  "/features/logbook": [
    { label: "← Routines", href: "/features/routines" },
    { label: "Weekly Progress →", href: "/features/progress" },
  ],
  "/features/progress": [
    { label: "← Logbook", href: "/features/logbook" },
    { label: "Rest Timer →", href: "/features/rest-timer" },
  ],
  "/features/rest-timer": [
    { label: "← Progress", href: "/features/progress" },
    { label: "Offline Ready →", href: "/features/offline-sync" },
  ],
  "/features/offline-sync": [
    { label: "← Rest Timer", href: "/features/rest-timer" },
    { label: "Home →", href: "/" },
  ],
};

export function SiteFooter() {
  const pathname = usePathname();
  const links = footerLinks[pathname];

  if (!links) return null;

  return (
    <footer className="relative z-10 border-t border-divider bg-wine-900 py-10">
      <div className="mx-auto flex max-w-page flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
        <div className="flex items-center gap-2.5">
          <FitPalMark />
          <span className="text-sm font-medium text-cream-100">FitPal</span>
          <span className="text-xs text-cream-400">© 2026 FitPal Inc.</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-cream-400">
          {links.map(({ label, href }) => (
            <Link key={`${href}-${label}`} href={href} className="transition-colors hover:text-cream-100">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
