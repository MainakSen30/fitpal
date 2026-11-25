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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-hairline bg-wine-900/90 backdrop-blur-md">
      <div className="container-editorial flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="FitPal home" className="flex flex-shrink-0 items-center gap-2.5">
          <FitPalMark className="h-7 w-7 rounded-[6px]" />
          <span className="font-display text-[17px] font-semibold tracking-tight text-cream-100">FitPal</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-5 text-[13px] text-cream-300 lg:flex xl:gap-7">
          {features.map(({ name, href }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative py-2 transition-colors hover:text-cream-100 ${
                  active ? "text-cream-100" : ""
                }`}
              >
                {name}
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-px bg-accent-clay" aria-hidden="true" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <Link
          href={downloadHref}
          className="button-primary hidden px-4 py-2.5 text-[13px] lg:inline-flex"
        >
          Get the App
        </Link>

        <button
          ref={triggerRef}
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-control text-cream-100 transition-colors hover:bg-wine-800 active:bg-wine-700 lg:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      <div
        id="mobile-navigation"
        aria-hidden={!open}
        className={`absolute inset-x-0 top-full border-b border-hairline bg-wine-900 transition-[opacity,transform] duration-150 lg:hidden ${
          open ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible -translate-y-2 opacity-0"
        }`}
      >
        <nav aria-label="Mobile primary" className="container-editorial flex flex-col py-3">
          {features.map(({ name, href }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center border-b border-divider text-sm transition-colors last:border-b-0 hover:text-cream-100 ${
                  active ? "text-cream-100" : "text-cream-300"
                }`}
              >
                {name}
              </Link>
            );
          })}
          <Link
            href={downloadHref}
            onClick={() => setOpen(false)}
            className="button-primary mt-4 min-h-11 px-4 py-3 text-sm"
          >
            Get the App
          </Link>
        </nav>
      </div>
    </header>
  );
}
