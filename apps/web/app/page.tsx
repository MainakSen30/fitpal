import Link from "next/link";
import { PhoneMockup, WorkoutLoggingMockup } from "@/components/phone-mockup";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#090807] text-[#e6e4e2] antialiased selection:bg-brand-500 selection:text-white">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_700px_at_50%_30%,rgba(249,115,22,0.14),transparent_70%)]" />
        <div className="absolute top-1/4 -right-48 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 -left-48 w-96 h-96 bg-brand-600/10 rounded-full blur-[140px]" />
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
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="/features/workout-logging" className="hover:text-white transition-colors">Feature Pages</Link>
            <Link href="#download" className="hover:text-white transition-colors">Download</Link>
          </nav>
          <Link href="#download" className="px-4 py-1.5 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all">
            Get the App
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="pt-32 pb-24 md:pt-40 md:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-medium text-brand-400 mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                  <span>Mobile-First Workout Tracker</span>
                </div>
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-white leading-[1.05] mb-6">
                  Track Your Workouts.
                  <br />
                  <span className="text-stone-400">Own Your Progress.</span>
                </h1>
                <p className="text-lg text-stone-400 max-w-xl leading-relaxed mb-10">
                  The simplest way to log sets, reps, and weights. Build custom routines, track your history, and watch your strength grow with precision analytics.
                </p>
                <div className="flex flex-col sm:flex-row items-start gap-3">
                  <Link href="#download" className="px-6 py-2.5 rounded-full font-medium text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 transition-all shadow-glow-orange-sm">
                    Download FitPal
                  </Link>
                  <Link href="#features" className="px-6 py-2.5 rounded-full font-medium text-sm text-stone-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                    See Features
                  </Link>
                </div>
              </div>
              <div className="flex justify-center lg:justify-end">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-b from-brand-500/15 to-transparent rounded-[3rem] blur-2xl" />
                  <PhoneMockup>
                    <WorkoutLoggingMockup />
                  </PhoneMockup>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 sm:py-28 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">Everything you need</h2>
              <p className="text-lg text-stone-400">Built for the gym, designed for results. Explore detailed feature pages.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: "Quick Workout Logging", desc: "Start, log sets/reps/weight, and mark complete in seconds.", href: "/features/workout-logging" },
                { title: "Custom Routines", desc: "Build Push/Pull/Legs or any split with targets and ordering.", href: "/features/routines" },
                { title: "Complete Logbook", desc: "Browse history, view full details, edit or delete past workouts.", href: "/features/logbook" },
                { title: "Weekly Progress", desc: "Track workouts, sets, volume, and week-over-week trends.", href: "/features/progress" },
                { title: "Smart Rest Timer", desc: "Auto rest countdown with haptics to stay on track.", href: "/features/rest-timer" },
                { title: "Offline Ready", desc: "Log in the gym with poor signal, sync when connected.", href: "/features/offline-sync" },
              ].map((f, i) => (
                <Link key={i} href={f.href} className="group relative rounded-xl bg-white/[0.02] border border-white/5 p-6 hover:bg-white/[0.04] hover:border-white/10 transition-all">
                  <h3 className="text-lg font-medium text-white mb-2 group-hover:text-brand-400 transition-colors">{f.title}</h3>
                  <p className="text-sm text-stone-400 leading-relaxed mb-4">{f.desc}</p>
                  <div className="flex items-center text-xs text-stone-500 gap-1 group-hover:text-brand-400 transition-colors">
                    <span>Learn more</span>
                    <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="download" className="py-20 sm:py-28">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">Ready to start tracking?</h2>
            <p className="text-lg text-stone-400 mb-10">Download FitPal and take your training to the next level.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button className="px-6 py-2.5 rounded-full font-medium text-sm text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all">
                Download for iOS
              </button>
              <button className="px-6 py-2.5 rounded-full font-medium text-sm text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all">
                Download for Android
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.22 2.05c-.32-.23-.74-.23-1.06-.01C9.62 3.12 6.54 5.72 6.54 9.9c0 2.22.89 3.82 1.83 4.96.22.27.18.66-.08.88-.26.21-.65.18-.87-.09-1.12-1.35-2.08-3.21-2.08-5.75 0-.41-.42-.69-.8-.54C3.65 9.77 2 12.3 2 15.17 2 20.04 6.03 24 11 24c5.52 0 10-4.48 10-10 0-4.83-2.88-8.99-6.9-10.95-.38-.19-.83.05-.88.47-.11.96-.54 2.21-1.46 3.11-.27.26-.71.22-.92-.09-.2-.3-.15-.71.12-.96.9-1.03 1.26-2.31 1.26-3.53 0-.01 0 0 0 0z" />
                </svg>
              </div>
              <span className="text-base font-medium text-white">FitPal</span>
              <span className="text-sm text-stone-500">© 2026 FitPal Inc.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-stone-500">
              <Link href="#features" className="hover:text-white transition-colors">Features</Link>
              <Link href="/features/workout-logging" className="hover:text-white transition-colors">Feature Pages</Link>
              <Link href="#download" className="hover:text-white transition-colors">Download</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
