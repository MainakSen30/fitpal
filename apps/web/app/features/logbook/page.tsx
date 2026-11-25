"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PhoneMockup, LogbookMockup } from "@/components/phone-mockup";
import { CometCard } from "@/components/ui/comet-card";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { CanvasText } from "@/components/ui/canvas-text";
import { CheckCircle2, BookOpen } from "lucide-react";

export default function LogbookPage() {
  return (
    <div className="min-h-screen bg-wine-900 text-cream-100 antialiased">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_0%,rgba(27,5,12,0.4),transparent_70%)]" />
      </div>

      <div className="relative z-10">
        <section className="pt-32 pb-16 md:pt-40 md:pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-clay/10 border border-accent-clay/20 text-xs font-medium text-accent-clay mb-8">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Feature</span>
                </div>
                <div className="mb-6 min-h-[80px] sm:min-h-[100px] lg:min-h-[120px]"><CanvasText text="Complete Logbook & PRs" className="font-semibold tracking-tight text-4xl sm:text-5xl lg:text-6xl" colors={["#D9BE8A", "#C9795A", "#EADFCB", "#A89279"]} animationDuration={4} lineWidth={1.2} lineGap={8} curveIntensity={40} /></div>
                <div className="text-lg text-cream-300 leading-relaxed mb-10">
                  <TextGenerateEffect
                    words="Every workout saved forever. Browse your complete history, review past sessions in detail with full exercise breakdowns, and track all your personal records as they happen."
                    className="max-w-xl"
                    duration={0.25}
                  />
                </div>
                <div className="space-y-6">
                  {[
                    { title: "Full History", desc: "Access every workout you've ever logged in one place" },
                    { title: "Detailed Breakdown", desc: "See all exercises, sets, weights, reps, and notes" },
                    { title: "Edit or Delete", desc: "Fix mistakes or remove old sessions anytime" },
                    { title: "Automatic PR Tracking", desc: "Personal records detected and celebrated automatically" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <CheckCircle2 className="w-5 h-5 text-accent-clay flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-cream-100 mb-1">{item.title}</div>
                        <div className="text-sm text-cream-300 leading-relaxed">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="flex justify-center">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-b from-wine-600/15 to-transparent rounded-[3rem] blur-2xl" />
                  <CometCard rotateDepth={16} translateDepth={16}>
                  <PhoneMockup><LogbookMockup /></PhoneMockup>
                  </CometCard>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 border-t border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-cream-100 mb-4">Ready to start your journey?</h2>
            <p className="text-lg text-cream-300 mb-10">Download FitPal and track every rep towards your goals.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/#download" className="px-6 py-2.5 rounded-full font-medium text-sm button-primary transition-colors">Download FitPal</Link>
              <Link href="/#features" className="px-6 py-2.5 rounded-full font-medium text-sm text-cream-200 hover:text-cream-100 button-secondary transition-colors">Back to Features</Link>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}
