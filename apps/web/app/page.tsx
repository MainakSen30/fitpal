import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#090807] text-[#e6e4e2] font-sans antialiased selection:bg-brand-500 selection:text-white">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_600px_at_50%_30%,rgba(249,115,22,0.16),transparent_70%)]" />
        <div className="absolute top-1/4 -right-48 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 -left-48 w-96 h-96 bg-brand-600/10 rounded-full blur-[140px]" />
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#090807]/80 border-b border-brand-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow-orange-sm">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.22 2.05c-.32-.23-.74-.23-1.06-.01C9.62 3.12 6.54 5.72 6.54 9.9c0 2.22.89 3.82 1.83 4.96.22.27.18.66-.08.88-.26.21-.65.18-.87-.09-1.12-1.35-2.08-3.21-2.08-5.75 0-.41-.42-.69-.8-.54C3.65 9.77 2 12.3 2 15.17 2 20.04 6.03 24 11 24c5.52 0 10-4.48 10-10 0-4.83-2.88-8.99-6.9-10.95-.38-.19-.83.05-.88.47-.11.96-.54 2.21-1.46 3.11-.27.26-.71.22-.92-.09-.2-.3-.15-.71.12-.96.9-1.03 1.26-2.31 1.26-3.53 0-.01 0 0 0 0z" />
              </svg>
            </div>
            <span className="text-2xl font-black tracking-tight text-white">
              Fit<span className="text-brand-500">Pal</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-300">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#showcase" className="hover:text-white transition-colors">Showcase</Link>
            <Link href="/features/workout-logging" className="hover:text-white transition-colors">Feature Pages</Link>
            <Link href="#download" className="hover:text-white transition-colors">Download</Link>
          </nav>
          <Link href="#download" className="px-5 py-2.5 rounded-full font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-700 shadow-glow-orange-sm hover:shadow-glow-orange transition-all">
            Get the App
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        <section className="pt-12 pb-24 md:pt-20 md:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-xs sm:text-sm font-semibold text-brand-400 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
              <span>Mobile-First Workout Tracker</span>
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.08]">
              Track Your Workouts. <br />
              <span className="bg-gradient-to-r from-orange-400 via-brand-500 to-amber-400 bg-clip-text text-transparent">
                Own Your Progress.
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-stone-300 max-w-2xl mx-auto">
              The simplest way to log sets, reps, and weights. Build custom routines, track your history, and watch your strength grow with precision analytics.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="#download" className="w-full sm:w-auto px-8 py-4 rounded-full font-bold text-base text-white bg-gradient-to-r from-brand-600 to-brand-500 shadow-glow-orange hover:shadow-[0_0_45px_-3px_rgba(249,115,22,0.65)] transition-all">
                Download FitPal
              </Link>
              <Link href="#features" className="w-full sm:w-auto px-8 py-4 rounded-full font-semibold text-base text-stone-200 bg-brand-surface border border-stone-800 hover:border-brand-500/40 transition-all">
                See Features
              </Link>
            </div>
          </div>
        </section>

        <section id="features" className="py-24 sm:py-32 bg-[#0c0b09] border-y border-stone-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-brand-500 font-bold uppercase tracking-widest text-xs sm:text-sm">Power & Performance</span>
              <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight mt-2">Everything You Need</h2>
              <p className="text-stone-400 text-lg sm:text-xl mt-3">Built for the gym, designed for results. Explore detailed feature pages below.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "Quick Workout Logging", desc: "Start, log sets/reps/weight, and mark complete in seconds.", href: "/features/workout-logging", icon: "💪" },
                { title: "Custom Routines", desc: "Build Push/Pull/Legs or any split with targets and ordering.", href: "/features/routines", icon: "📋" },
                { title: "Complete Logbook", desc: "Browse history, view full details, edit or delete past workouts.", href: "/features/logbook", icon: "📊" },
                { title: "Weekly Progress", desc: "Track workouts, sets, volume, and week-over-week trends.", href: "/features/progress", icon: "📈" },
                { title: "Smart Rest Timer", desc: "Auto rest countdown with haptics to stay on track.", href: "/features/rest-timer", icon: "⏱️" },
                { title: "Offline Ready", desc: "Log in the gym with poor signal, sync when connected.", href: "/features/offline-sync", icon: "⚡" },
              ].map((f, i) => (
                <Link key={i} href={f.href} className="group relative rounded-2xl bg-brand-surface border border-stone-800 p-8 hover:border-brand-500/50 transition-all hover:shadow-glow-orange-sm">
                  <div className="text-4xl mb-4">{f.icon}</div>
                  <h3 className="text-xl font-bold text-white group-hover:text-brand-400 transition-colors">{f.title}</h3>
                  <p className="mt-3 text-stone-400 text-sm leading-relaxed">{f.desc}</p>
                  <div className="mt-6 flex items-center text-xs font-semibold text-brand-400 gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Learn more</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 bg-[#060504] border-t border-brand-border/60 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-stone-400 text-sm">
          <p>© 2026 FitPal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
