"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { FitPalMark } from "@/components/fitpal-mark";

const features = [
  { name: "Workout Logging", href: "/features/workout-logging" },
  { name: "Routines", href: "/features/routines" },
  { name: "Logbook & PRs", href: "/features/logbook" },
  { name: "Weekly Progress", href: "/features/progress" },
  { name: "Rest Timer", href: "/features/rest-timer" },
  { name: "Offline Ready", href: "/features/offline-sync" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const downloadHref = pathname === "/" ? "#download" : "/#download";

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="fixed top-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-page -translate-x-1/2">
      <div className="flex h-16 items-center justify-between rounded-full border border-border bg-wine-900 px-4 shadow-surface sm:px-6 lg:px-7">
        <Link href="/" aria-label="FitPal home" className="flex items-center gap-2.5">
          <FitPalMark />
          <span className="text-lg font-semibold tracking-tight text-cream-100">
            Fit<span className="text-accent-clay">Pal</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-5 text-sm text-cream-300 lg:flex xl:gap-6">
          {features.map(({ name, href }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`transition-colors hover:text-cream-100 ${active ? "text-cream-100" : ""}`}
              >
                {name}
              </Link>
            );
          })}
        </nav>

        <Link href={downloadHref} className="button-secondary hidden px-4 py-1.5 text-sm lg:inline-flex">
          Get the App
        </Link>

        <button
          ref={triggerRef}
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-control text-cream-100 transition-colors hover:bg-wine-800 lg:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      <div
        id="mobile-navigation"
        aria-hidden={!open}
        className={`absolute left-0 right-0 top-full z-50 mt-2 rounded-card border border-border bg-wine-900 p-2 shadow-surface transition-[opacity,transform] duration-150 lg:hidden ${
          open ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible -translate-y-2 opacity-0"
        }`}
      >
        <nav aria-label="Mobile primary" className="flex flex-col gap-1">
          {features.map(({ name, href }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center rounded-control px-3 text-sm transition-colors hover:bg-wine-800 hover:text-cream-100 ${
                  active ? "bg-wine-800 text-cream-100" : "text-cream-300"
                }`}
              >
                {name}
              </Link>
            );
          })}
          <Link
            href={downloadHref}
            onClick={() => setOpen(false)}
            className="button-secondary mt-2 min-h-11 px-4 py-3 text-sm"
          >
            Get the App
          </Link>
        </nav>
      </div>
    </header>
  );
}
