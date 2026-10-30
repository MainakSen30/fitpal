"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PhoneMockup, ProgressMockup } from "@/components/phone-mockup";
import { ArrowLeft, CheckCircle2, TrendingUp } from "lucide-react";

export default function ProgressPage() {
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
          <div className="flex gap-4 text-sm">
            <Link href="/features/logbook" className="text-stone-300 hover:text-white">← Previous</Link>
            <Link href="/features/rest-timer" className="text-stone-300 hover:text-white">Next: Rest Timer →</Link>
          </div>
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
                  <TrendingUp className="w-4 h-4" />
                  <span>Feature</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mb-6">
                  Weekly Progress & Analytics
                </h1>
                <p className="text-xl text-stone-300 mb-8 leading-relaxed">
                  Visualize your gains with comprehensive weekly stats. Track volume, frequency, and see your strength trending up over time.
                </p>
                <div className="space-y-4">
                  {[
                    { title: "Weekly Overview", desc: "Workouts, sets, volume, and time at a glance" },
                    { title: "Week Comparison", desc: "See how this week stacks against last week" },
                    { title: "Top PRs", desc: "Your biggest lifts all in one place" },
                    { title: "Progress Trends", desc: "Data-driven insights to optimize your training" },
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
                  <ProgressMockup />
                </PhoneMockup>
              </motion.div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
