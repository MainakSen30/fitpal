"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PhoneMockup, WorkoutLoggingMockup } from "@/components/phone-mockup";
import { ArrowLeft, CheckCircle2, Timer, Zap } from "lucide-react";

export default function WorkoutLoggingPage() {
  return (
    <div className="min-h-screen bg-[#090807] text-[#e6e4e2]">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_0%,rgba(249,115,22,0.12),transparent_70%)]" />
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#090807]/80 border-b border-brand-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-stone-300 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Home</span>
          </Link>
          <Link href="/features/routines" className="text-sm text-stone-300 hover:text-white">Next: Routines →</Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="pt-16 pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-sm mb-6">
                  <Zap className="w-4 h-4" />
                  <span>Feature</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mb-6">
                  Quick Workout Logging
                </h1>
                <p className="text-xl text-stone-300 mb-8 leading-relaxed">
                  Log sets, reps, and weights faster than ever. Start from scratch or from a routine, track your progress set by set, and hit new PRs with ease.
                </p>
                <div className="space-y-4">
                  {[
                    { title: "Instant Start", desc: "Begin an empty session or load a routine in one tap" },
                    { title: "Smart Auto-Fill", desc: "Previous weights and reps pre-populated for each exercise" },
                    { title: "PR Detection", desc: "Instantly celebrate when you hit a personal record" },
                    { title: "Seamless Flow", desc: "Log, rest, repeat - optimized for gym speed" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-brand-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-white">{item.title}</div>
                        <div className="text-stone-400">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex justify-center"
              >
                <PhoneMockup>
                  <WorkoutLoggingMockup />
                </PhoneMockup>
              </motion.div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
