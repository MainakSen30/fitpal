import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-black/80 backdrop-blur-md border-b border-white/10 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                FitPal
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
              <a href="#showcase" className="text-gray-300 hover:text-white transition-colors">Showcase</a>
              <a href="#download" className="text-gray-300 hover:text-white transition-colors">Download</a>
            </div>
            <a href="#download" className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-2 rounded-full font-semibold hover:shadow-lg hover:shadow-orange-500/50 transition-all">
              Get the App
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Track Your Workouts.
            <br />
            <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              Own Your Progress.
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-10 max-w-3xl mx-auto">
            The simplest way to log sets, reps, and weights. Build custom routines, track your history, and watch your strength grow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#download" className="bg-gradient-to-r from-orange-500 to-red-500 px-8 py-4 rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-orange-500/50 transition-all">
              Download FitPal
            </a>
            <a href="#features" className="border border-white/20 px-8 py-4 rounded-full text-lg font-semibold hover:bg-white/10 transition-all">
              See Features
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Everything You Need</h2>
            <p className="text-xl text-gray-400">Built for the gym, designed for results</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Quick Workout Logging",
                description: "Start a workout in seconds. Add exercises, log sets with reps and weight, and mark them complete on the go.",
                icon: "💪"
              },
              {
                title: "Custom Routines",
                description: "Build your own Push/Pull/Legs or any routine you want. Set target sets, reps, and weights, then start with one tap.",
                icon: "📋"
              },
              {
                title: "Complete Logbook",
                description: "Every workout saved with full details. Browse your history, review past sessions, and track your training consistency.",
                icon: "📊"
              },
              {
                title: "Weekly Progress",
                description: "See your training at a glance. Track completed workouts, active days, total sets, and volume with week-over-week comparison.",
                icon: "📈"
              },
              {
                title: "Exercise History",
                description: "Type your own exercises and track your performance over time. See how your strength evolves with every session.",
                icon: "🎯"
              },
              {
                title: "Works Offline Ready",
                description: "Built mobile-first for the gym. Log your workouts without worrying about poor signal or connectivity.",
                icon: "⚡"
              }
            ].map((feature, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all hover:scale-105">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section id="showcase" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Simple. Fast. Focused.</h2>
            <p className="text-xl text-gray-400">No distractions. Just what you need to track your workouts.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center font-bold text-xl">1</div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Start Your Workout</h3>
                  <p className="text-gray-400">Begin from scratch or pick from your saved routines. Get started in one tap.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center font-bold text-xl">2</div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Log Every Set</h3>
                  <p className="text-gray-400">Add exercises, enter reps and weight for each set independently. Mark sets as you complete them.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center font-bold text-xl">3</div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Finish & Track</h3>
                  <p className="text-gray-400">Complete your workout and watch it appear in your logbook. See your progress build over time.</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-3xl p-8 border border-white/10">
                <div className="bg-black rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold">Bench Press</h4>
                    <span className="text-orange-500">+ Add Set</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { set: 1, reps: 10, weight: "40 kg", done: true },
                      { set: 2, reps: 9, weight: "40 kg", done: true },
                      { set: 3, reps: 8, weight: "42.5 kg", done: false },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                        <span className="text-gray-400">Set {s.set}</span>
                        <span>{s.reps} reps</span>
                        <span>{s.weight}</span>
                        <span className={s.done ? "text-green-500" : "text-gray-600"}>✓</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-900 to-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Start Tracking?</h2>
          <p className="text-xl text-gray-400 mb-10">
            FitPal is built mobile-first. Download the app and start logging your workouts today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button disabled className="flex items-center justify-center gap-3 bg-white/10 px-8 py-4 rounded-full text-lg font-semibold cursor-not-allowed opacity-50">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <div className="text-left">
                <div className="text-xs">Coming Soon on</div>
                <div className="text-lg">App Store</div>
              </div>
            </button>
            <button disabled className="flex items-center justify-center gap-3 bg-white/10 px-8 py-4 rounded-full text-lg font-semibold cursor-not-allowed opacity-50">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.92 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
              </svg>
              <div className="text-left">
                <div className="text-xs">Coming Soon on</div>
                <div className="text-lg">Google Play</div>
              </div>
            </button>
          </div>
          <p className="text-gray-500">Join the waitlist to be notified when we launch</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>&copy; 2026 FitPal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
