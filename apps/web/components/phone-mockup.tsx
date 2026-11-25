"use client";

import { WifiOff } from "lucide-react";

interface PhoneMockupProps {
  children: React.ReactNode;
  className?: string;
}

export function PhoneMockup({ children, className = "" }: PhoneMockupProps) {
  return (
    <div className={`relative mx-auto w-[264px] sm:w-[300px] ${className}`}>
      <div className="rounded-[2.5rem] border border-hairline-strong bg-wine-800 p-2 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.85)]">
        <div className="absolute left-1/2 top-[1.15rem] z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-wine-950" aria-hidden="true" />
        <div className="relative h-[552px] overflow-hidden rounded-[2rem] border border-hairline bg-wine-950 sm:h-[600px]">
          <div className="h-full overflow-hidden pt-10">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ScreenHeader({ label, title, aside }: { label: string; title: string; aside?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 border-b border-divider pb-4">
      <div>
        <div className="type-label text-cream-400">{label}</div>
        <div className="font-display mt-1 text-[15px] font-semibold leading-tight tracking-tight text-cream-100">
          {title}
        </div>
      </div>
      {aside ? (
        <span className="rounded-full border border-hairline px-2.5 py-1 text-[10px] tabular-data text-cream-300">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

export function HeroSessionMockup() {
  return (
    <div className="flex h-full flex-col gap-3 px-4 pb-4">
      <ScreenHeader label="Active Session" title="Chest & Triceps" aside="00:42:15" />
      <div className="rounded-xl border border-hairline bg-wine-800/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[13px] font-medium text-cream-100">Barbell Bench Press</div>
          <div className="type-label whitespace-nowrap text-accent-clay">PR READY</div>
        </div>
        {[
          { w: 225, r: 5, d: true },
          { w: 245, r: 5, d: true },
          { w: 255, r: 3, d: false },
        ].map((set, index) => (
          <div key={index} className="flex items-center justify-between border-t border-divider py-2 first:border-t-0">
            <div className="flex items-center gap-2 text-[12px] tabular-data text-cream-100">
              <span className="text-cream-400">{index + 1}</span>
              <span>{set.w} lbs</span>
              <span className="text-cream-400">×</span>
              <span>{set.r}</span>
            </div>
            <div className={`h-4 w-4 rounded-full ${set.d ? "bg-accent-clay" : "border border-hairline-strong"}`} />
          </div>
        ))}
      </div>
      <div className="mt-auto">
        <button className="w-full rounded-full bg-cream-100 py-2.5 text-[13px] font-medium text-wine-950">
          Complete Set
        </button>
      </div>
    </div>
  );
}

export function WorkoutLoggingMockup() {
  return (
    <div className="flex h-full flex-col gap-3 px-4 pb-4">
      <ScreenHeader label="Current Session" title="Chest & Triceps" aside="00:42:15" />
      <div className="rounded-xl border border-hairline bg-wine-800/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[13px] font-medium text-cream-100">Barbell Bench Press</div>
          <div className="type-label whitespace-nowrap text-accent-clay">PR Ready</div>
        </div>
        {[
          { w: 225, r: 5, done: true },
          { w: 245, r: 5, done: true },
          { w: 255, r: 3, done: false },
        ].map((set, index) => (
          <div key={index} className="flex items-center justify-between border-t border-divider py-2 first:border-t-0">
            <div className="flex items-center gap-2 text-[12px] tabular-data text-cream-100">
              <span className="text-cream-400">{index + 1}</span>
              <span>{set.w} lbs × {set.r}</span>
            </div>
            <div className={`h-4 w-4 rounded-full ${set.done ? "bg-accent-clay" : "border border-hairline-strong"}`} />
          </div>
        ))}
      </div>
      <button className="mt-auto w-full rounded-full bg-cream-100 py-2.5 text-[13px] font-medium text-wine-950">
        Complete Set
      </button>
    </div>
  );
}

export function RoutinesMockup() {
  return (
    <div className="px-4">
      <ScreenHeader label="Training" title="My Routines" />
      {["Push Day A", "Pull Day B", "Legs Day"].map((routine, index) => (
        <div
          key={routine}
          className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-hairline bg-wine-800/60 p-3"
        >
          <div>
            <div className="text-[13px] font-medium text-cream-100">{routine}</div>
            <div className="mt-0.5 text-[11px] text-cream-400">{6 - index} exercises</div>
          </div>
          <button className="rounded-full border border-hairline-strong px-3 py-1 text-[11px] text-cream-100">
            Start
          </button>
        </div>
      ))}
      <button className="mt-3 w-full rounded-lg border border-dashed border-hairline-strong py-2.5 text-[12px] text-cream-300">
        + Create Routine
      </button>
    </div>
  );
}

export function LogbookMockup() {
  return (
    <div className="px-4">
      <ScreenHeader label="History" title="Logbook" />
      {["Oct 30", "Oct 28", "Oct 26"].map((date, index) => (
        <div key={date} className="mb-2.5 rounded-lg border border-hairline bg-wine-800/60 p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="text-[13px] font-medium text-cream-100">
              {index === 0 ? "Chest & Triceps" : index === 1 ? "Back & Biceps" : "Legs"}
            </div>
            <div className="text-[10px] text-cream-400">{date}</div>
          </div>
          <div className="text-[11px] text-cream-300">5 exercises • 16 sets • 8,450 lbs volume</div>
        </div>
      ))}
    </div>
  );
}

export function ProgressMockup() {
  return (
    <div className="px-4">
      <ScreenHeader label="This Week" title="Weekly Progress" />
      <div className="mb-3 grid grid-cols-2 gap-2">
        {[
          { l: "Workouts", v: "5" },
          { l: "Sets", v: "48" },
          { l: "Volume", v: "24.2k" },
          { l: "Time", v: "6h 24m" },
        ].map((stat) => (
          <div key={stat.l} className="rounded-lg border border-hairline bg-wine-800/60 p-3">
            <div className="font-display text-xl font-semibold leading-none tracking-tight text-cream-100">
              {stat.v}
            </div>
            <div className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-cream-400">{stat.l}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-hairline bg-wine-800/60 p-3">
        <div className="mb-1.5 type-label text-cream-400">Top PRs</div>
        {[
          { e: "Bench Press", v: "255 lbs" },
          { e: "Squat", v: "315 lbs" },
          { e: "Deadlift", v: "405 lbs" },
        ].map((pr) => (
          <div key={pr.e} className="flex items-center justify-between border-t border-divider py-2 text-[12px] first:border-t-0">
            <span className="text-cream-200">{pr.e}</span>
            <span className="tabular-data text-cream-100">{pr.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RestTimerMockup() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 pb-8">
      <div className="type-label text-cream-400">Rest Time</div>
      <div className="font-display my-3 text-[64px] font-semibold leading-none tracking-[-0.04em] text-cream-100 tabular-data">
        01:48
      </div>
      <div className="mb-10 text-[12px] text-cream-300">Next: Incline DB Press</div>
      <div className="flex w-full gap-2">
        <button className="flex-1 rounded-full border border-hairline-strong py-2.5 text-[12px] text-cream-100">-30s</button>
        <button className="flex-1 rounded-full border border-hairline-strong py-2.5 text-[12px] text-cream-100">Skip</button>
        <button className="flex-1 rounded-full bg-cream-100 py-2.5 text-[12px] font-medium text-wine-950">+30s</button>
      </div>
    </div>
  );
}

export function OfflineSyncMockup() {
  return (
    <div className="px-4">
      <ScreenHeader label="Session" title="Workout Session" />
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-hairline bg-wine-800/60 px-3 py-2">
        <WifiOff className="h-3.5 w-3.5 text-accent-clay" aria-hidden="true" />
        <span className="text-[11px] text-cream-200">Offline Mode - Saved Locally</span>
      </div>
      <div className="rounded-lg border border-hairline bg-wine-800/60 p-3">
        <div className="mb-1 text-[13px] font-medium text-cream-100">Deadlifts</div>
        {[
          { w: 315, r: 5 },
          { w: 365, r: 3 },
          { w: 405, r: 1 },
        ].map((set, index) => (
          <div key={index} className="flex items-center justify-between border-t border-divider py-2 first:border-t-0">
            <div className="flex items-center gap-2 text-[12px] tabular-data text-cream-100">
              <span className="text-cream-400">{index + 1}</span>
              <span>{set.w} lbs × {set.r}</span>
            </div>
            <div className="h-4 w-4 rounded-full bg-accent-clay" />
          </div>
        ))}
      </div>
      <div className="mt-3 text-center text-[11px] text-cream-400">Will sync when connection restored</div>
    </div>
  );
}
