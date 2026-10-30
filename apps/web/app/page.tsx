"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CometCard } from "@/components/ui/comet-card";

export default function Home() {
  return (
    <div className="bg-dark-base text-gray-100 antialiased overflow-x-hidden selection:bg-brand-500 selection:text-white">
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-7xl">
        <div className="backdrop-blur-2xl bg-[#090807]/60 border border-white/10 rounded-full px-7 h-16 flex items-center justify-between shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
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
            <Link href="/features/workout-logging" className="hover:text-white transition-colors">Workout Logging</Link>
            <Link href="/features/routines" className="hover:text-white transition-colors">Routines</Link>
            <Link href="/features/logbook" className="hover:text-white transition-colors">Logbook & PRs</Link>
            <Link href="/features/progress" className="hover:text-white transition-colors">Weekly Progress</Link>
            <Link href="/features/rest-timer" className="hover:text-white transition-colors">Rest Timer</Link>
            <Link href="/features/offline-sync" className="hover:text-white transition-colors">Offline Ready</Link>
          </nav>
          <Link href="#download" className="px-4 py-1.5 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all">
            Get the App
          </Link>
        </div>
      </header>

      <main className="relative overflow-hidden radial-glow-hero grid-lines">
        <div className="pointer-events-none absolute -top-40 right-10 w-[600px] h-[600px] bg-brand-500/15 rounded-full blur-[140px] -z-10" />
        <div className="pointer-events-none absolute bottom-0 left-[-100px] w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[120px] -z-10" />
        
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 lg:pt-36 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="lg:col-span-7 space-y-7">
              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full glass-card border border-brand-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                <span className="text-xs font-medium text-amber-200/90">Mobile-First Workout Tracker</span>
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl sm:text-6xl xl:text-7xl font-semibold tracking-tight text-white leading-[1.05]">
                  Track Your Workouts.<br />
                  <span className="bg-gradient-to-r from-brand-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">Own Your Progress.</span>
                </h1>
                <p className="text-base sm:text-lg text-gray-300/90 max-w-2xl leading-relaxed">
                  The precision gym log designed for serious lifters. Log sets in seconds, build custom routines, and track your strength growth with clarity.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="#download" className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 text-white font-medium shadow-glow-orange hover:shadow-[0_0_35px_rgba(249,115,22,0.7)] transition-all">
                  Download FitPal Free
                </Link>
                <Link href="/features/workout-logging" className="px-6 py-3 rounded-xl glass-card text-gray-200 hover:text-white border border-white/10 hover:border-brand-500/40 transition-all">
                  Explore Features
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-md pt-2">
                <div className="px-3 py-2.5 rounded-xl glass-card border-white/5">
                  <div className="text-brand-400 font-semibold font-mono">0.4s</div>
                  <div className="text-xs text-gray-400">Set Logging</div>
                </div>
                <div className="px-3 py-2.5 rounded-xl glass-card border-white/5">
                  <div className="text-amber-400 font-semibold font-mono">100%</div>
                  <div className="text-xs text-gray-400">Offline Ready</div>
                </div>
                <div className="px-3 py-2.5 rounded-xl glass-card border-white/5">
                  <div className="text-emerald-400 font-semibold font-mono">Smart</div>
                  <div className="text-xs text-gray-400">PR Tracking</div>
                </div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="lg:col-span-5 relative flex justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-600/25 via-amber-500/20 to-transparent rounded-full blur-[80px] -z-10" />
              <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-6 -right-4 sm:-right-8 z-40 p-3 rounded-2xl bg-[#15120f] border border-brand-500/40 shadow-[0_20px_60px_rgba(249,115,22,0.25)] hidden sm:block max-w-[190px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-400">Weekly Volume</span>
                  <span className="text-[10px] text-emerald-400 font-mono">+14.2%</span>
                </div>
                <div className="text-base font-semibold text-white font-mono">14,850 <span className="text-xs text-gray-400">lbs</span></div>
              </motion.div>
              <motion.div animate={{ y: [0, -14, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2.4 }} className="absolute -bottom-6 -left-4 sm:-left-8 z-40 p-2.5 rounded-2xl bg-[#15120f] border border-amber-500/50 shadow-[0_20px_70px_rgba(251,191,36,0.18)] hidden sm:flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-brand-600 flex items-center justify-center text-xs">🏆</div>
                <div>
                  <div className="text-[10px] text-amber-400 font-mono">New PR</div>
                  <div className="text-xs text-white">Bench 255 lbs</div>
                </div>
              </motion.div>
              <CometCard rotateDepth={18} translateDepth={18} className="w-full max-w-[340px]">
                <div className="relative w-[300px] sm:w-[330px] rounded-[48px] p-3 bg-gradient-to-b from-gray-700 via-gray-900 to-black shadow-glow-phone border border-white/20">
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-4 bg-black rounded-full z-10" />
                  <div className="rounded-[40px] bg-[#090a0f] overflow-hidden h-[580px] sm:h-[620px]">
                    <div className="px-4 pt-9 pb-4 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-brand-400 font-mono">Active Session</div>
                          <div className="text-sm font-semibold text-white">Chest & Triceps</div>
                        </div>
                        <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono">00:42:15</div>
                      </div>
                      <div className="rounded-2xl bg-dark-card border border-white/10 p-3 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-white">Barbell Bench Press</div>
                          <div className="text-[10px] text-amber-400 font-mono">PR READY</div>
                        </div>
                        {[{w:225,r:5,d:true},{w:245,r:5,d:true},{w:255,r:3,d:false}].map((s,i)=>(
                          <div key={i} className="flex items-center justify-between py-2 border-t border-white/5 first:border-0">
                            <div className="flex items-center gap-2 text-xs font-mono">
                              <span className="text-gray-500">{i+1}</span>
                              <span className="text-white">{s.w} lbs</span>
                              <span className="text-gray-500">×</span>
                              <span className="text-white">{s.r}</span>
                            </div>
                            <div className={`w-5 h-5 rounded-full ${s.d ? 'bg-emerald-500' : 'border border-white/20'}`} />
                          </div>
                        ))}
                      </div>
                      <button className="mt-auto w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-amber-500 text-white text-sm font-medium">Complete Set</button>
                    </div>
                  </div>
                </div>
              </CometCard>
            </motion.div>
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-dark-card/50 backdrop-blur-md py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-white/5">
              <div className="pt-2 md:pt-0"><div className="text-xl sm:text-2xl font-semibold text-white font-mono">12.4M+</div><div className="text-xs text-gray-400 mt-1">Sets Logged</div></div>
              <div className="pt-2 md:pt-0"><div className="text-xl sm:text-2xl font-semibold text-brand-400 font-mono">99.8%</div><div className="text-xs text-gray-400 mt-1">Completion Rate</div></div>
              <div className="pt-2 md:pt-0"><div className="text-xl sm:text-2xl font-semibold text-amber-400 font-mono">180+</div><div className="text-xs text-gray-400 mt-1">Smart Routines</div></div>
              <div className="pt-2 md:pt-0"><div className="text-xl sm:text-2xl font-semibold text-emerald-400 font-mono">Free</div><div className="text-xs text-gray-400 mt-1">No Ads</div></div>
            </div>
          </div>
        </section>

        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="max-w-3xl mb-12">
            <div className="text-xs uppercase tracking-[0.3em] text-brand-400 font-mono mb-4">Built for your training</div>
            <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-4 leading-tight">
              Everything you need.<br />Nothing you don't.
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl">
              From your first set to your weekly progress, FitPal keeps your training organized and your goals in sight.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 lg:gap-5">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }} className="md:col-span-4">
              <Link href="/features/workout-logging">
                <div className="group relative overflow-hidden rounded-3xl h-[420px] border border-white/10 hover:border-brand-500/50 transition-all duration-500">
                  <div className="absolute inset-0">
                    <img src="/features/track-every-set.jpg" alt="Track every set" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>
                  <div className="relative h-full flex flex-col justify-end p-8">
                    <div className="text-xs uppercase tracking-widest text-brand-400 font-mono mb-3">Track</div>
                    <h3 className="text-3xl sm:text-4xl font-semibold text-white mb-3 tracking-tight">Track Every Set</h3>
                    <p className="text-base text-gray-300 max-w-md">Log every rep, every set, and every kilogram. Keep your training history accurate and organized.</p>
                    <div className="mt-6 flex items-center gap-2 text-sm text-brand-400 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                      <span>Explore workout logging</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} className="md:col-span-2">
              <Link href="/features/routines">
                <div className="group relative overflow-hidden rounded-3xl h-[420px] border border-white/10 hover:border-brand-500/50 transition-all duration-500">
                  <div className="absolute inset-0">
                    <img src="/features/build-routine.jpg" alt="Build your routine" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
                  </div>
                  <div className="relative h-full flex flex-col justify-end p-6">
                    <div className="text-xs uppercase tracking-widest text-brand-400 font-mono mb-3">Plan</div>
                    <h3 className="text-2xl font-semibold text-white mb-2 tracking-tight">Your Routine. Your Rules.</h3>
                    <p className="text-sm text-gray-300">Create personalized workout routines that fit your goals.</p>
                  </div>
                </div>
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }} className="md:col-span-3">
              <Link href="/features/progress">
                <div className="group relative overflow-hidden rounded-3xl h-[380px] border border-white/10 hover:border-brand-500/50 transition-all duration-500">
                  <div className="absolute inset-0">
                    <img src="/features/own-progress.jpg" alt="Own your progress" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-transparent" />
                  </div>
                  <div className="relative h-full flex flex-col justify-end p-7">
                    <div className="text-xs uppercase tracking-widest text-brand-400 font-mono mb-3">Measure</div>
                    <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-2 tracking-tight">Progress You Can See</h3>
                    <p className="text-sm text-gray-300 max-w-sm">Look back, compare performance, and see how your training evolves.</p>
                  </div>
                </div>
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.4 }} className="md:col-span-3">
              <Link href="/features/logbook">
                <div className="group relative overflow-hidden rounded-3xl h-[380px] border border-white/10 hover:border-brand-500/50 transition-all duration-500">
                  <div className="absolute inset-0">
                    <img src="/features/training-logbook.jpg" alt="Training logbook" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-transparent" />
                  </div>
                  <div className="relative h-full flex flex-col justify-end p-7">
                    <div className="text-xs uppercase tracking-widest text-brand-400 font-mono mb-3">Record</div>
                    <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-2 tracking-tight">Every Workout Counts</h3>
                    <p className="text-sm text-gray-300 max-w-sm">Keep every session in one place and revisit your training history anytime.</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>
        </section>

        <section className="py-16 sm:py-20 border-t border-white/[0.07]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">Ready to start your journey?</h2>
            <p className="text-lg text-gray-400 mb-10">Download FitPal and track every rep towards your goals.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="#download" className="px-6 py-2.5 rounded-full font-medium text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 transition-all shadow-glow-orange-sm hover:shadow-glow-orange">Download for iOS</a>
              <a href="#download" className="px-6 py-2.5 rounded-full font-medium text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 transition-all shadow-glow-orange-sm hover:shadow-glow-orange">Download for Android</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.22 2.05c-.32-.23-.74-.23-1.06-.01C9.62 3.12 6.54 5.72 6.54 9.9c0 2.22.89 3.82 1.83 4.96.22.27.18.66-.08.88-.26.21-.65.18-.87-.09-1.12-1.35-2.08-3.21-2.08-5.75 0-.41-.42-.69-.8-.54C3.65 9.77 2 12.3 2 15.17 2 20.04 6.03 24 11 24c5.52 0 10-4.48 10-10 0-4.83-2.88-8.99-6.9-10.95-.38-.19-.83.05-.88.47-.11.96-.54 2.21-1.46 3.11-.27.26-.71.22-.92-.09-.2-.3-.15-.71.12-.96.9-1.03 1.26-2.31 1.26-3.53 0-.01 0 0 0 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-white">FitPal</span>
            <span className="text-xs text-gray-500">© 2026 FitPal Inc.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/features/workout-logging" className="hover:text-white transition-colors">Features</Link>
            <Link href="#download" className="hover:text-white transition-colors">Download</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
