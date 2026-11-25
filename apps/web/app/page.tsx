"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CometCard } from "@/components/ui/comet-card";
import { CanvasText } from "@/components/ui/canvas-text";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { GlareCard } from "@/components/ui/glare-card";

export default function Home() {
  return (
    <div className="overflow-x-hidden bg-wine-900 text-cream-100 antialiased selection:bg-wine-700 selection:text-cream-100">
      <section className="mx-auto max-w-content px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pb-24 lg:pt-36">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6 lg:col-span-7"
          >
            <div className="flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.08em] text-cream-400">
              <span className="h-px w-6 bg-accent-clay" />
              <span>Mobile-First Workout Tracker</span>
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-cream-100 sm:text-6xl xl:text-7xl">
                Track Your Workouts.<br />
                <span className="inline-block">
                  <CanvasText
                    text="Own Your Progress"
                    className="font-semibold tracking-tight"
                    colors={["#D9BE8A", "#C9795A", "#EADFCB", "#A89279"]}
                    animationDuration={4}
                    lineWidth={1.2}
                    lineGap={8}
                    curveIntensity={40}
                  />
                </span>
              </h1>
              <TextGenerateEffect
                words="The simplest way to log every set, build your routines, and track your strength progress. Everything you need to stay consistent, all in one place."
                className="max-w-2xl"
                duration={0.3}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="#download" className="button-primary px-6 py-3">
                Download FitPal Free
              </Link>
              <Link href="/features/workout-logging" className="button-secondary px-6 py-3">
                Explore Features
              </Link>
            </div>
            <div className="grid max-w-lg grid-cols-3 gap-4 border-t border-divider pt-6">
              <div>
                <div className="font-mono font-semibold text-accent-clay">0.4s</div>
                <div className="mt-1 text-xs text-cream-300">Set Logging</div>
              </div>
              <div>
                <div className="font-mono font-semibold text-accent-sand">100%</div>
                <div className="mt-1 text-xs text-cream-300">Offline Ready</div>
              </div>
              <div>
                <div className="font-mono font-semibold text-accent-clay">Smart</div>
                <div className="mt-1 text-xs text-cream-300">PR Tracking</div>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative flex justify-center lg:col-span-5 lg:pt-8"
          >
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-4 -top-6 z-40 hidden max-w-[190px] rounded-card border border-accent-clay/40 bg-wine-800 p-3 shadow-surface sm:block"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] text-cream-300">Weekly Volume</span>
                <span className="text-[10px] font-mono text-accent-clay">+14.2%</span>
              </div>
              <div className="font-mono text-base font-semibold text-cream-100">
                14,850 <span className="text-xs text-cream-300">lbs</span>
              </div>
            </motion.div>
            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2.4 }}
              className="absolute -bottom-6 -left-4 z-40 hidden items-center gap-2 rounded-card border border-accent-sand/50 bg-wine-800 p-2.5 shadow-surface sm:flex"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-wine-700 text-xs">🏆</div>
              <div>
                <div className="text-[10px] font-mono text-accent-sand">New PR</div>
                <div className="text-xs text-cream-100">Bench 255 lbs</div>
              </div>
            </motion.div>
            <CometCard rotateDepth={18} translateDepth={18} className="w-full max-w-[340px]">
              <div className="relative w-full max-w-[300px] rounded-[48px] border border-border bg-gradient-to-b from-wine-700 via-wine-900 to-wine-950 p-3 shadow-surface sm:max-w-[330px]">
                <div className="absolute left-1/2 top-5 z-10 h-4 w-24 -translate-x-1/2 rounded-full bg-wine-950" />
                <div className="h-[580px] overflow-hidden rounded-[40px] bg-wine-950 sm:h-[620px]">
                  <div className="flex h-full flex-col px-4 pb-4 pt-9">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-accent-clay">Active Session</div>
                        <div className="text-sm font-semibold text-cream-100">Chest & Triceps</div>
                      </div>
                      <div className="rounded-full bg-accent-clay/15 px-2 py-0.5 font-mono text-xs text-accent-sand">00:42:15</div>
                    </div>
                    <div className="mb-3 rounded-card border border-border bg-wine-800 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-medium text-cream-100">Barbell Bench Press</div>
                        <div className="font-mono text-[10px] text-accent-sand">PR READY</div>
                      </div>
                      {[{ w: 225, r: 5, d: true }, { w: 245, r: 5, d: true }, { w: 255, r: 3, d: false }].map((s, i) => (
                        <div key={i} className="flex items-center justify-between border-t border-divider py-2 first:border-0">
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span className="text-cream-400">{i + 1}</span>
                            <span className="text-cream-100">{s.w} lbs</span>
                            <span className="text-cream-400">×</span>
                            <span className="text-cream-100">{s.r}</span>
                          </div>
                          <div className={`h-5 w-5 rounded-full ${s.d ? "bg-accent-clay" : "border border-border"}`} />
                        </div>
                      ))}
                    </div>
                    <button className="mt-auto w-full rounded-xl bg-accent-clay py-2.5 text-sm font-medium text-wine-950">Complete Set</button>
                  </div>
                </div>
              </div>
            </CometCard>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-divider bg-wine-800/50">
        <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4">
            <div className="border-b border-divider px-2 py-5 text-center sm:px-4 md:border-b-0 md:border-r md:px-6">
              <div className="font-mono text-2xl font-semibold text-cream-100">12.4M+</div>
              <div className="mt-1 text-xs text-cream-300">Sets Logged</div>
            </div>
            <div className="border-b border-divider px-2 py-5 text-center sm:px-4 md:border-b-0 md:border-r md:px-6">
              <div className="font-mono text-2xl font-semibold text-accent-clay">99.8%</div>
              <div className="mt-1 text-xs text-cream-300">Completion Rate</div>
            </div>
            <div className="px-2 py-5 text-center sm:px-4 md:border-r md:px-6">
              <div className="font-mono text-2xl font-semibold text-accent-sand">180+</div>
              <div className="mt-1 text-xs text-cream-300">Smart Routines</div>
            </div>
            <div className="px-2 py-5 text-center sm:px-4 md:px-6">
              <div className="font-mono text-2xl font-semibold text-accent-clay">Free</div>
              <div className="mt-1 text-xs text-cream-300">No Ads</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-content px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 max-w-reading"
        >
          <h2 className="mb-4 text-4xl font-semibold leading-tight tracking-tight text-cream-100 sm:text-5xl">
            Everything You Need to Own Your Progress.
          </h2>
          <p className="max-w-2xl text-lg text-cream-300">
            From logging every set to tracking personal records, FitPal keeps your training organised and your progress visible.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="h-full lg:col-span-2"
          >
            <Link
              href="/features/workout-logging"
              className="block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <GlareCard className="h-full w-full">
                <div className="flex h-full flex-col justify-between gap-6 p-5 lg:flex-row lg:items-end lg:p-6">
                  <div>
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-clay/15 text-accent-clay">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 7h12M6 12h12M6 17h12" />
                      </svg>
                    </div>
                    <h3 className="mb-2 text-xl font-semibold tracking-tight text-cream-100">Workout Logging</h3>
                    <p className="text-sm leading-relaxed text-cream-300">Log every exercise, set, rep, and weight without interrupting your workout.</p>
                  </div>
                  <div className="text-xs text-accent-clay">Learn more</div>
                </div>
              </GlareCard>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="h-full"
          >
            <Link
              href="/features/routines"
              className="block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <GlareCard className="h-full w-full">
                <div className="flex h-full flex-col justify-between p-5">
                  <div>
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-clay/15 text-accent-clay">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="mb-2 text-xl font-semibold tracking-tight text-cream-100">Routines</h3>
                    <p className="text-sm leading-relaxed text-cream-300">Create and reuse your own workout routines to make every training session easier to start.</p>
                  </div>
                  <div className="mt-4 text-xs text-accent-clay">Learn more</div>
                </div>
              </GlareCard>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="h-full"
          >
            <Link
              href="/features/logbook"
              className="block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <GlareCard className="h-full w-full">
                <div className="flex h-full flex-col justify-between p-5">
                  <div>
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-clay/15 text-accent-clay">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <h3 className="mb-2 text-xl font-semibold tracking-tight text-cream-100">Logbook & PRs</h3>
                    <p className="text-sm leading-relaxed text-cream-300">Look back at previous workouts and keep track of your personal records.</p>
                  </div>
                  <div className="mt-4 text-xs text-accent-clay">Learn more</div>
                </div>
              </GlareCard>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="h-full"
          >
            <Link
              href="/features/progress"
              className="block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <GlareCard className="h-full w-full">
                <div className="flex h-full flex-col justify-between p-5">
                  <div>
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-clay/15 text-accent-clay">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <h3 className="mb-2 text-xl font-semibold tracking-tight text-cream-100">Weekly Progress</h3>
                    <p className="text-sm leading-relaxed text-cream-300">See your weekly training activity and understand how consistently you&apos;re progressing.</p>
                  </div>
                  <div className="mt-4 text-xs text-accent-clay">Learn more</div>
                </div>
              </GlareCard>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="h-full"
          >
            <Link
              href="/features/rest-timer"
              className="block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <GlareCard className="h-full w-full">
                <div className="flex h-full flex-col justify-between p-5">
                  <div>
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-clay/15 text-accent-clay">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="mb-2 text-xl font-semibold tracking-tight text-cream-100">Rest Timer</h3>
                    <p className="text-sm leading-relaxed text-cream-300">Keep your recovery on track with a built-in rest timer between sets.</p>
                  </div>
                  <div className="mt-4 text-xs text-accent-clay">Learn more</div>
                </div>
              </GlareCard>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="h-full lg:col-span-2"
          >
            <Link
              href="/features/offline-sync"
              className="block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <GlareCard className="h-full w-full">
                <div className="flex h-full flex-col justify-between gap-6 p-5 lg:flex-row lg:items-end lg:p-6">
                  <div>
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-clay/15 text-accent-clay">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                      </svg>
                    </div>
                    <h3 className="mb-2 text-xl font-semibold tracking-tight text-cream-100">Offline Ready</h3>
                    <p className="text-sm leading-relaxed text-cream-300">Keep logging your workouts even when you don&apos;t have an internet connection.</p>
                  </div>
                  <div className="text-xs text-accent-clay">Learn more</div>
                </div>
              </GlareCard>
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="border-t border-divider">
        <div className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
            <div className="max-w-reading">
              <h2 className="text-3xl font-semibold tracking-tight text-cream-100 sm:text-4xl">Ready to start your journey?</h2>
              <p className="mt-4 text-lg text-cream-300">Download FitPal and track every rep towards your goals.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <a href="#download" className="button-primary px-6 py-3 text-sm">Download for iOS</a>
              <a href="#download" className="button-secondary px-6 py-3 text-sm">Download for Android</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
