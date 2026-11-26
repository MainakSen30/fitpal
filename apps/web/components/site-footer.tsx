"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { FitPalMark } from "@/components/fitpal-mark";
import { useEditorialMotion } from "@/lib/motion-system";

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
  const { section, viewport } = useEditorialMotion();

  if (!links) return null;

  return (
    <motion.footer
      key={pathname}
      data-motion-reveal
      variants={section}
      initial="hidden"
      whileInView="visible"
      viewport={viewport}
      className="border-t border-hairline bg-wine-950"
    >
      <div className="container-editorial py-10 lg:py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <FitPalMark className="h-7 w-7 rounded-[6px]" />
            <span className="font-display text-sm font-semibold tracking-tight text-cream-100">FitPal</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-7 gap-y-3 text-[13px] text-cream-300">
            {links.map(({ label, href }) => (
              <Link key={`${href}-${label}`} href={href} className="transition-colors hover:text-cream-100">
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 border-t border-divider pt-5">
          <p className="type-label text-cream-400">© 2026 FitPal Inc.</p>
        </div>
      </div>
    </motion.footer>
  );
}
