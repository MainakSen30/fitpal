"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PhoneMockup, ProgressMockup } from "@/components/phone-mockup";
import { ArrowLeft, CheckCircle2, TrendingUp } from "lucide-react";

const features = [
  { name: "Workout Logging", href: "/features/workout-logging" },
  { name: "Custom Routines", href: "/features/routines" },
  { name: "Logbook & PRs", href: "/features/logbook" },
  { name: "Weekly Progress", href: "/features/progress" },
  { name: "Rest Timer", href: "/features/rest-timer" },
  { name: "Offline Ready", href: "/features/offline-sync" },
];

export default function ProgressPage() {
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
          <nav className="hidden md:flex items-center gap-8 text-sm text-stone-400">
            <div className="relative group">
              <button className="flex items-center gap-1 hover:text-white transition-colors">
                Features
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="w-56 rounded-xl bg-[#090807]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
                  <Link href="/features/workout-logging" className="block px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5"><div className="text-sm text-white">Workout Logging</div><div className="text-xs text-stone-500">Log sets, reps & weights</div></Link>
                  <Link href="/features/routines" className="block px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5"><div className="text-sm text-white">Custom Routines</div><div className="text-xs text-stone-500">Build your split</div></Link>
                  <Link href="/features/logbook" className="block px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5"><div className="text-sm text-white">Logbook & PRs</div><div className="text-xs text-stone-500">Track history & records</div></Link>
                  <Link href="/features/progress" className="block px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5"><div className="text-sm text-white">Weekly Progress</div><div className="text-xs text-stone-500">Analytics & insights</div></Link>
                  <Link href="/features/rest-timer" className="block px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5"><div className="text-sm text-white">Rest Timer</div><div className="text-xs text-stone-500">Smart rest countdown</div></Link>
                  <Link href="/features/offline-sync" className="block px-4 py-2.5 hover:bg-white/5 transition-colors"><div className="text-sm text-white">Offline Ready</div><div className="text-xs text-stone-500">Train anywhere</div></Link>
                </div>
              </div>
            </div>
            <Link href="/#download" className="hover:text-white transition-colors">Download</Link>
          </nav>
          <Link href="/#download" className="px-4 py-1.5 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all">Get the App</Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="pt-32 pb-16 md:pt-40 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-medium text-brand-400 mb-8">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Feature</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.05] mb-6">
                  Weekly Progress & Analytics
                </h1>
                <p className="text-lg text-stone-400 leading-relaxed mb-10">
                  Visualize your gains with comprehensive weekly stats. Track workouts, sets, volume, and time while comparing week-over-week to optimize your training.
                </p>
                <div className="space-y-6">
                  {[
                    { title: "Weekly Overview", desc: "Workouts, sets, volume, and time at a glance" },
                    { title: "Week Comparison", desc: "See how this week stacks against last week" },
                    { title: "Top PRs", desc: "Your biggest lifts all in one place" },
                    { title: "Progress Trends", desc: "Data-driven insights to optimize your training" },
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
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="flex justify-center">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-b from-brand-500/15 to-transparent rounded-[3rem] blur-2xl" />
                  <PhoneMockup><ProgressMockup /></PhoneMockup>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 border-t border-white/5">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">Ready to start your journey?</h2>
            <p className="text-lg text-stone-400 mb-10">Download FitPal and track every rep towards your goals.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/#download" className="px-6 py-2.5 rounded-full font-medium text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 transition-all shadow-glow-orange-sm">Download FitPal</Link>
              <Link href="/#features" className="px-6 py-2.5 rounded-full font-medium text-sm text-stone-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all">Back to Features</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.22 2.05c-.32-.23-.74-.23-1.06-.01C9.62 3.12 6.54 5.72 6.54 9.9c0 2.22.89 3.82 1.83 4.96.22.27.18.66-.08.88-.26.21-.65.18-.87-.09-1.12-1.35-2.08-3.21-2.08-5.75 0-.41-.42-.69-.8-.54C3.65 9.77 2 12.3 2 15.17 2 20.04 6.03 24 11 24c5.52 0 10-4.48 10-10 0-4.83-2.88-8.99-6.9-10.95-.38-.19-.83.05-.88.47-.11.96-.54 2.21-1.46 3.11-.27.26-.71.22-.92-.09-.2-.3-.15-.71.12-.96.9-1.03 1.26-2.31 1.26-3.53 0-.01 0 0 0 0z" /></svg>
              </div>
              <span className="text-sm font-medium text-white">FitPal</span>
              <span className="text-xs text-stone-500">© 2026 FitPal Inc.</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/features/logbook" className="text-stone-500 hover:text-white transition-colors">← Logbook</Link>
              <Link href="/features/rest-timer" className="text-stone-500 hover:text-white transition-colors">Rest Timer →</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
