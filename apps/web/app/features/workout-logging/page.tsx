"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PhoneMockup, WorkoutLoggingMockup } from "@/components/phone-mockup";
import { ArrowLeft, CheckCircle2, Zap } from "lucide-react";

export default function WorkoutLoggingPage() {
  return (
    <div className="min-h-screen bg-[#090807] text-[#e6e4e2] antialiased">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_0%,rgba(249,115,22,0.1),transparent_70%)]" />
      </div>

      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-6xl">
        <div className="backdrop-blur-xl bg-[#090807]/70 border border-white/5 rounded-full px-6 h-14 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.22 2.05c-.32-.23-.74-.23-1.06-.01C9.62 3.12 6.54 5.72 6.54 9.9c0 2.22.89 3.82 1.83 4.96.22.27.18.66-.08.88-.26.21-.65.18-.87-.09-1.12-1.35-2.08-3.21-2.08-5.75 0-.41-.42-.69-.8-.54C3.65 9.77 2 12.3 2 15.17 2 20.04 6.03 24 11 24c5.52 0 10-4.48 10-10 0-4.83-2.88-8.99-6.9-10.95-.38-.19-.83.05-.88.47-.11.96-.54 2.21-1.46 3.11-.27.26-.71.22-.92-.09-.2-.3-.15-.71.12-.96.9-1.03 1.26-2.31 1.26-3.53 0-.01 0 0 0 0z" />
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">
              Fit<span className="text-brand-500">Pal</span>
            </span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-stone-400">
            <Link href="/features/workout-logging" className="text-white">Workout Logging</Link>
            <Link href="/features/routines" className="hover:text-white transition-colors">Routines</Link>
            <Link href="/features/logbook" className="hover:text-white transition-colors">Logbook & PRs</Link>
            <Link href="/features/progress" className="hover:text-white transition-colors">Weekly Progress</Link>
            <Link href="/features/rest-timer" className="hover:text-white transition-colors">Rest Timer</Link>
            <Link href="/features/offline-sync" className="hover:text-white transition-colors">Offline Ready</Link>
          </nav>
          <Link href="/#download" className="px-4 py-1.5 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all">
            Get the App
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="pt-32 pb-20 md:pt-40 md:pb-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-medium text-brand-400 mb-8">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Feature</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.05] mb-6">
                  Quick Workout Logging
                </h1>
                <p className="text-lg text-stone-400 leading-relaxed mb-10">
                  Log sets, reps, and weights faster than ever. Start from scratch or from a routine, track your progress set by set, and hit new PRs with intelligent auto-fill and instant PR detection.
                </p>
                <div className="space-y-6">
                  {[
                    { title: "Instant Start", desc: "Begin an empty session or load a routine in one tap" },
                    { title: "Smart Auto-Fill", desc: "Previous weights and reps pre-populated for each exercise automatically" },
                    { title: "PR Detection", desc: "Instantly celebrate when you hit a personal record" },
                    { title: "Optimized for Speed", desc: "Designed for one-handed use between sets in the gym" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <CheckCircle2 className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-white mb-1">{item.title}</div>
                        <div className="text-sm text-stone-400 leading-relaxed">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex justify-center"
              >
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-b from-brand-500/15 to-transparent rounded-[3rem] blur-2xl" />
                  <PhoneMockup>
                    <WorkoutLoggingMockup />
                  </PhoneMockup>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.22 2.05c-.32-.23-.74-.23-1.06-.01C9.62 3.12 6.54 5.72 6.54 9.9c0 2.22.89 3.82 1.83 4.96.22.27.18.66-.08.88-.26.21-.65.18-.87-.09-1.12-1.35-2.08-3.21-2.08-5.75 0-.41-.42-.69-.8-.54C3.65 9.77 2 12.3 2 15.17 2 20.04 6.03 24 11 24c5.52 0 10-4.48 10-10 0-4.83-2.88-8.99-6.9-10.95-.38-.19-.83.05-.88.47-.11.96-.54 2.21-1.46 3.11-.27.26-.71.22-.92-.09-.2-.3-.15-.71.12-.96.9-1.03 1.26-2.31 1.26-3.53 0-.01 0 0 0 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-white">FitPal</span>
              <span className="text-xs text-stone-500">© 2026 FitPal Inc.</span>
            </div>
            <Link href="/features/routines" className="text-sm text-stone-500 hover:text-white transition-colors">
              Next: Custom Routines →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
