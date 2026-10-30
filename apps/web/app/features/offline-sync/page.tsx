"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PhoneMockup, OfflineSyncMockup } from "@/components/phone-mockup";
import { ArrowLeft, CheckCircle2, WifiOff } from "lucide-react";

export default function OfflineSyncPage() {
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
            <Link href="/features/rest-timer" className="text-stone-300 hover:text-white">← Previous</Link>
            <Link href="/" className="text-stone-300 hover:text-white">Back to Home →</Link>
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
                  <WifiOff className="w-4 h-4" />
                  <span>Feature</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mb-6">
                  100% Offline Ready
                </h1>
                <p className="text-xl text-stone-300 mb-8 leading-relaxed">
                  Gym basement with no signal? No problem. Log your entire workout offline and it syncs automatically when you're back online.
                </p>
                <div className="space-y-4">
                  {[
                    { title: "Full Offline Support", desc: "Log sets, reps, weights without internet connection" },
                    { title: "Local First", desc: "Zero loading delays, works anywhere" },
                    { title: "Auto Sync", desc: "Seamlessly syncs when connection is restored" },
                    { title: "Never Lose Data", desc: "Everything saved locally until synced" },
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
                  <OfflineSyncMockup />
                </PhoneMockup>
              </motion.div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
