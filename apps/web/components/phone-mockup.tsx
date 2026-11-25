"use client";

interface PhoneMockupProps {
  children: React.ReactNode;
  className?: string;
}

export function PhoneMockup({ children, className = "" }: PhoneMockupProps) {
  return (
    <div className={`relative mx-auto w-[280px] sm:w-[320px] ${className}`}>
      <div className="absolute -inset-2 bg-gradient-to-b from-wine-600/20 to-transparent rounded-[3rem] blur-xl" />
      <div className="relative rounded-[2.5rem] bg-gradient-to-b from-wine-700 to-wine-950 p-2 shadow-surface">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-wine-950 rounded-b-3xl z-10" />
        <div className="relative rounded-[2rem] bg-wine-950 overflow-hidden h-[580px] sm:h-[640px]">
          <div className="absolute top-0 w-full h-12 flex items-end justify-center pb-1 z-10">
            <div className="w-24 h-1 bg-cream-100/20 rounded-full" />
          </div>
          <div className="pt-12 h-full overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function WorkoutLoggingMockup() {
  return (
    <div className="h-full bg-wine-950 text-cream-100 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-cream-300">Current Session</div>
          <div className="text-lg font-bold">Chest & Triceps</div>
        </div>
        <div className="text-xs px-2 py-1 rounded-full bg-accent-clay/15 text-accent-sand">00:42:15</div>
      </div>
      <div className="bg-wine-800 rounded-xl p-3 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Barbell Bench Press</div>
          <div className="text-xs text-accent-clay">PR Ready</div>
        </div>
        {[{ w: 225, r: 5, done: true }, { w: 245, r: 5, done: true }, { w: 255, r: 3, done: false }].map((s, i) => (
          <div key={i} className={`flex items-center justify-between py-2 ${i < 2 ? "border-b border-divider" : ""}`}>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-cream-400">{i + 1}</span>
              <span>{s.w} lbs × {s.r}</span>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 ${s.done ? "bg-accent-clay border-accent-clay" : "border-border"}`} />
          </div>
        ))}
      </div>
      <button className="mt-auto w-full py-3 rounded-xl bg-accent-clay text-wine-950 font-semibold">Complete Set</button>
    </div>
  );
}

export function RoutinesMockup() {
  return (
    <div className="h-full bg-wine-950 text-cream-100 p-4">
      <div className="text-lg font-bold mb-4">My Routines</div>
      {["Push Day A", "Pull Day B", "Legs Day"].map((r, i) => (
        <div key={i} className="mb-2 p-3 rounded-xl bg-wine-800 border border-border flex items-center justify-between">
          <div>
            <div className="font-semibold">{r}</div>
            <div className="text-xs text-cream-300">{6 - i} exercises</div>
          </div>
          <button className="px-3 py-1 rounded-lg bg-accent-clay/20 text-accent-sand text-sm">Start</button>
        </div>
      ))}
      <button className="w-full mt-4 py-2 rounded-xl border border-dashed border-border text-cream-300">+ Create Routine</button>
    </div>
  );
}

export function LogbookMockup() {
  return (
    <div className="h-full bg-wine-950 text-cream-100 p-4">
      <div className="text-lg font-bold mb-4">Logbook</div>
      {["Oct 30", "Oct 28", "Oct 26"].map((d, i) => (
        <div key={i} className="mb-3 p-3 rounded-xl bg-wine-800 border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">{i === 0 ? "Chest & Triceps" : i === 1 ? "Back & Biceps" : "Legs"}</div>
            <div className="text-xs text-cream-300">{d}</div>
          </div>
          <div className="text-xs text-cream-300">5 exercises • 16 sets • 8,450 lbs volume</div>
        </div>
      ))}
    </div>
  );
}

export function ProgressMockup() {
  return (
    <div className="h-full bg-wine-950 text-cream-100 p-4">
      <div className="text-lg font-bold mb-4">Weekly Progress</div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[{ l: "Workouts", v: "5" }, { l: "Sets", v: "48" }, { l: "Volume", v: "24.2k" }, { l: "Time", v: "6h 24m" }].map((s, i) => (
          <div key={i} className="p-3 rounded-xl bg-wine-800 border border-border text-center">
            <div className="text-xl font-bold text-accent-clay">{s.v}</div>
            <div className="text-xs text-cream-300">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="bg-wine-800 rounded-xl p-3 border border-border">
        <div className="text-sm font-semibold mb-2">Top PRs</div>
        {[{ e: "Bench Press", v: "255 lbs" }, { e: "Squat", v: "315 lbs" }, { e: "Deadlift", v: "405 lbs" }].map((p, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-divider last:border-0">
            <span className="text-sm">{p.e}</span>
            <span className="text-accent-clay font-semibold">{p.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RestTimerMockup() {
  return (
    <div className="h-full bg-wine-950 text-cream-100 p-4 flex flex-col items-center justify-center">
      <div className="text-sm text-cream-300 mb-2">Rest Time</div>
      <div className="text-6xl font-black text-accent-clay mb-2">01:48</div>
      <div className="text-cream-300 mb-8">Next: Incline DB Press</div>
      <div className="flex gap-3">
        <button className="px-6 py-2 rounded-lg bg-wine-700">-30s</button>
        <button className="px-6 py-2 rounded-lg bg-wine-700">Skip</button>
        <button className="px-6 py-2 rounded-lg bg-accent-clay text-wine-950">+30s</button>
      </div>
    </div>
  );
}

export function OfflineSyncMockup() {
  return (
    <div className="h-full bg-wine-950 text-cream-100 p-4">
      <div className="text-lg font-bold mb-4">Workout Session</div>
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-accent-sand/10 border border-accent-sand/30">
        <span className="text-accent-sand">⚡</span>
        <span className="text-sm text-accent-sand">Offline Mode - Saved Locally</span>
      </div>
      <div className="bg-wine-800 rounded-xl p-3 border border-border">
        <div className="font-semibold mb-2">Deadlifts</div>
        {[{ w: 315, r: 5 }, { w: 365, r: 3 }, { w: 405, r: 1 }].map((s, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-divider last:border-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-cream-400">{i + 1}</span>
              <span>{s.w} lbs × {s.r}</span>
            </div>
            <div className="w-5 h-5 rounded-full bg-accent-clay" />
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs text-cream-300 text-center">Will sync when connection restored</div>
    </div>
  );
}
