"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Transition, Variants } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useEditorialMotion } from "@/lib/motion-system";

interface PhoneMockupProps {
  children: React.ReactNode;
  className?: string;
}

const heroSets = [
  { w: 225, r: 5, done: true },
  { w: 245, r: 5, done: true },
  { w: 255, r: 3, done: false },
];

const loggingSets = [
  { w: 225, r: 5, done: true },
  { w: 245, r: 5, done: true },
  { w: 255, r: 3, done: false },
];

const routines = ["Push Day A", "Pull Day B", "Legs Day"];

const records = [
  { date: "Oct 30", title: "Chest & Triceps" },
  { date: "Oct 28", title: "Back & Biceps" },
  { date: "Oct 26", title: "Legs" },
];

const progressStats = [
  { l: "Workouts", v: "5" },
  { l: "Sets", v: "48" },
  { l: "Volume", v: "24.2k" },
  { l: "Time", v: "6h 24m" },
];

const progressPrs = [
  { e: "Bench Press", v: "255 lbs" },
  { e: "Squat", v: "315 lbs" },
  { e: "Deadlift", v: "405 lbs" },
];

const offlineSets = [
  { w: 315, r: 5 },
  { w: 365, r: 3 },
  { w: 405, r: 1 },
];

const REST_INITIAL_SECONDS = 108;
const OFFLINE_SAVED = "Offline Mode - Saved Locally";
const OFFLINE_PENDING = "Will sync when connection restored";

function formatRestTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function completeNextSet(sets: boolean[], initial: boolean[]) {
  if (sets.every(Boolean)) return [...initial];
  const next = sets.indexOf(false);
  const updated = [...sets];
  updated[next] = true;
  return updated;
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
  const { item } = useEditorialMotion();
  return (
    <motion.div data-motion-reveal variants={item} className="mb-4 flex items-start justify-between gap-3 border-b border-divider pb-4">
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
    </motion.div>
  );
}

function SetToggle({
  index,
  done,
  onToggle,
  item,
  status,
  children,
}: {
  index: number;
  done: boolean;
  onToggle: () => void;
  item: Variants;
  status: Variants;
  children: ReactNode;
}) {
  return (
    <motion.button
      data-motion-reveal
      variants={item}
      type="button"
      aria-pressed={done}
      aria-label={`Set ${index + 1}`}
      onClick={onToggle}
      className="flex w-full items-center justify-between border-t border-divider py-2 text-left transition-colors first:border-t-0 hover:bg-wine-900/40"
    >
      {children}
      <motion.span data-motion-reveal variants={status} className="flex items-center" aria-hidden="true">
        <span
          className={`h-4 w-4 rounded-full transition-colors ${done ? "bg-accent-clay" : "border border-hairline-strong"}`}
        />
      </motion.span>
    </motion.button>
  );
}

function DetailShift({
  active,
  children,
  className,
  transition,
  reduce,
}: {
  active: boolean;
  children: ReactNode;
  className: string;
  transition: Transition;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ y: active ? [3, 0] : 0 }}
      transition={reduce ? { duration: 0 } : transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function HeroSessionMockup() {
  const { item, stagger, status, viewport } = useEditorialMotion();
  const [sets, setSets] = useState(() => heroSets.map((set) => set.done));

  return (
    <motion.div data-preview="hero-session" variants={stagger} initial="hidden" whileInView="visible" viewport={viewport} className="flex h-full flex-col gap-3 px-4 pb-4">
      <ScreenHeader label="Active Session" title="Chest & Triceps" aside="00:42:15" />
      <div className="rounded-xl border border-hairline bg-wine-800/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[13px] font-medium text-cream-100">Barbell Bench Press</div>
          <div className="type-label whitespace-nowrap text-accent-clay">PR READY</div>
        </div>
        {heroSets.map((set, index) => (
          <SetToggle
            key={index}
            index={index}
            done={sets[index]}
            onToggle={() => setSets((current) => current.map((done, itemIndex) => (itemIndex === index ? !done : done)))}
            item={item}
            status={status}
          >
            <div className="flex items-center gap-2 text-[12px] tabular-data text-cream-100">
              <span className="text-cream-400">{index + 1}</span>
              <span>{set.w} lbs</span>
              <span className="text-cream-400">×</span>
              <span>{set.r}</span>
            </div>
          </SetToggle>
        ))}
      </div>
      <div className="mt-auto">
        <button
          type="button"
          onClick={() => setSets((current) => completeNextSet(current, heroSets.map((set) => set.done)))}
          className="preview-control preview-control-primary w-full rounded-full bg-cream-100 py-2.5 text-[13px] font-medium text-wine-950"
        >
          Complete Set
        </button>
      </div>
    </motion.div>
  );
}

export function WorkoutLoggingMockup() {
  const { item, stagger, status, viewport } = useEditorialMotion();
  const [sets, setSets] = useState(() => loggingSets.map((set) => set.done));

  return (
    <motion.div data-preview="workout-logging" variants={stagger} initial="hidden" whileInView="visible" viewport={viewport} className="flex h-full flex-col gap-3 px-4 pb-4">
      <ScreenHeader label="Current Session" title="Chest & Triceps" aside="00:42:15" />
      <div className="rounded-xl border border-hairline bg-wine-800/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[13px] font-medium text-cream-100">Barbell Bench Press</div>
          <div className="type-label whitespace-nowrap text-accent-clay">PR Ready</div>
        </div>
        {loggingSets.map((set, index) => (
          <SetToggle
            key={index}
            index={index}
            done={sets[index]}
            onToggle={() => setSets((current) => current.map((done, itemIndex) => (itemIndex === index ? !done : done)))}
            item={item}
            status={status}
          >
            <div className="flex items-center gap-2 text-[12px] tabular-data text-cream-100">
              <span className="text-cream-400">{index + 1}</span>
              <span>{set.w} lbs × {set.r}</span>
            </div>
          </SetToggle>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setSets((current) => completeNextSet(current, loggingSets.map((set) => set.done)))}
        className="preview-control preview-control-primary mt-auto w-full rounded-full bg-cream-100 py-2.5 text-[13px] font-medium text-wine-950"
      >
        Complete Set
      </button>
    </motion.div>
  );
}

export function RoutinesMockup() {
  const { item, stagger, viewport, reduce, transition } = useEditorialMotion();
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <motion.div data-preview="routines" variants={stagger} initial="hidden" whileInView="visible" viewport={viewport} className="px-4">
      <ScreenHeader label="Training" title="My Routines" />
      {routines.map((routine, index) => {
        const active = selected === index;
        return (
          <motion.div
            data-motion-reveal
            variants={item}
            key={routine}
            data-preview-active={active || undefined}
            className={`mb-2 flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${
              active ? "border-accent-clay bg-wine-700/35" : "border-hairline bg-wine-800/60"
            }`}
          >
            <div>
              <div className="text-[13px] font-medium text-cream-100">{routine}</div>
              <DetailShift
                active={active}
                className="mt-0.5 text-[11px] text-cream-400"
                transition={transition}
                reduce={reduce}
              >
                {6 - index} exercises
              </DetailShift>
            </div>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(active ? null : index)}
              className={`preview-control rounded-full border px-3 py-1 text-[11px] text-cream-100 ${
                active ? "border-accent-clay bg-wine-700/40" : "border-hairline-strong"
              }`}
            >
              Start
            </button>
          </motion.div>
        );
      })}
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="preview-control mt-3 w-full rounded-lg border border-dashed border-hairline-strong py-2.5 text-[12px] text-cream-300"
      >
        + Create Routine
      </button>
    </motion.div>
  );
}

export function LogbookMockup() {
  const { item, stagger, viewport, reduce, transition } = useEditorialMotion();
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <motion.div data-preview="logbook" variants={stagger} initial="hidden" whileInView="visible" viewport={viewport} className="px-4">
      <ScreenHeader label="History" title="Logbook" />
      {records.map((record, index) => {
        const active = selected === index;
        return (
          <motion.button
            data-motion-reveal
            variants={item}
            data-preview-active={active || undefined}
            aria-pressed={active}
            type="button"
            key={record.date}
            onClick={() => setSelected(active ? null : index)}
            className={`mb-2.5 w-full rounded-lg border p-3 text-left transition-colors ${
              active ? "border-accent-clay bg-wine-700/35" : "border-hairline bg-wine-800/60"
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="text-[13px] font-medium text-cream-100">{record.title}</div>
              <div className="text-[10px] text-cream-400">{record.date}</div>
            </div>
            <DetailShift
              active={active}
              className="text-[11px] text-cream-300"
              transition={transition}
              reduce={reduce}
            >
              5 exercises • 16 sets • 8,450 lbs volume
            </DetailShift>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

export function ProgressMockup() {
  const { item, stagger, viewport, reduce, transition } = useEditorialMotion();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <motion.div data-preview="progress" variants={stagger} initial="hidden" whileInView="visible" viewport={viewport} className="px-4">
      <ScreenHeader label="This Week" title="Weekly Progress" />
      <div className="mb-3 grid grid-cols-2 gap-2">
        {progressStats.map((stat) => {
          const active = selected === stat.l;
          return (
            <motion.button
              data-motion-reveal
              variants={item}
              data-preview-active={active || undefined}
              aria-pressed={active}
              type="button"
              key={stat.l}
              onClick={() => setSelected(active ? null : stat.l)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                active ? "border-accent-clay bg-wine-700/35" : "border-hairline bg-wine-800/60"
              }`}
            >
              <DetailShift
                active={active}
                className="font-display text-xl font-semibold leading-none tracking-tight text-cream-100"
                transition={transition}
                reduce={reduce}
              >
                {stat.v}
              </DetailShift>
              <div className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-cream-400">{stat.l}</div>
            </motion.button>
          );
        })}
      </div>
      <div className="rounded-lg border border-hairline bg-wine-800/60 p-3">
        <div className="mb-1.5 type-label text-cream-400">Top PRs</div>
        {progressPrs.map((pr) => (
          <motion.div data-motion-reveal variants={item} key={pr.e} className="flex items-center justify-between border-t border-divider py-2 text-[12px] first:border-t-0">
            <span className="text-cream-200">{pr.e}</span>
            <span className="tabular-data text-cream-100">{pr.v}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function RestTimerMockup() {
  const { item, stagger, viewport, reduce, transition } = useEditorialMotion();
  const [seconds, setSeconds] = useState(REST_INITIAL_SECONDS);

  return (
    <motion.div data-preview="rest-timer" variants={stagger} initial="hidden" whileInView="visible" viewport={viewport} className="flex h-full flex-col items-center justify-center px-4 pb-8">
      <motion.div data-motion-reveal variants={item} className="type-label text-cream-400">Rest Time</motion.div>
      <motion.div data-motion-reveal variants={item} className="font-display my-3 text-[64px] font-semibold leading-none tracking-[-0.04em] text-cream-100 tabular-data">
        <motion.span
          key={seconds}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : transition}
          data-preview-value
          className="inline-block"
        >
          {formatRestTime(seconds)}
        </motion.span>
      </motion.div>
      <motion.div data-motion-reveal variants={item} className="mb-10 text-[12px] text-cream-300">Next: Incline DB Press</motion.div>
      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={() => setSeconds((current) => Math.max(0, current - 30))}
          className="preview-control flex-1 rounded-full border border-hairline-strong py-2.5 text-[12px] text-cream-100"
        >
          -30s
        </button>
        <button
          type="button"
          onClick={() => setSeconds(0)}
          className="preview-control flex-1 rounded-full border border-hairline-strong py-2.5 text-[12px] text-cream-100"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => setSeconds((current) => current + 30)}
          className="preview-control preview-control-primary flex-1 rounded-full bg-cream-100 py-2.5 text-[12px] font-medium text-wine-950"
        >
          +30s
        </button>
      </div>
    </motion.div>
  );
}

export function OfflineSyncMockup() {
  const { item, stagger, status, viewport, reduce, transition } = useEditorialMotion();
  const [pending, setPending] = useState(false);

  return (
    <motion.div data-preview="offline-sync" variants={stagger} initial="hidden" whileInView="visible" viewport={viewport} className="px-4">
      <ScreenHeader label="Session" title="Workout Session" />
      <motion.div data-motion-reveal variants={item} className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${pending ? "border-accent-clay bg-wine-700/30" : "border-hairline bg-wine-800/60"}`}>
        <button
          type="button"
          aria-pressed={pending}
          onClick={() => setPending((current) => !current)}
          className="flex w-full items-center gap-2 text-left"
        >
          <motion.span data-motion-reveal variants={status} className="flex items-center" aria-hidden="true">
            <motion.span
              initial={false}
              animate={{ opacity: pending ? 0.6 : 1, scale: pending ? 0.94 : 1 }}
              transition={reduce ? { duration: 0 } : transition}
              className="flex items-center"
            >
              <WifiOff className="h-3.5 w-3.5 text-accent-clay" aria-hidden="true" />
            </motion.span>
          </motion.span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={pending ? "pending" : "saved"}
              initial={reduce ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 1 } : { opacity: 0, y: -3 }}
              transition={reduce ? { duration: 0 } : transition}
              data-preview-banner
              className="inline-block text-[11px] text-cream-200"
            >
              {pending ? OFFLINE_PENDING : OFFLINE_SAVED}
            </motion.span>
          </AnimatePresence>
        </button>
      </motion.div>
      <div className="rounded-lg border border-hairline bg-wine-800/60 p-3">
        <div className="mb-1 text-[13px] font-medium text-cream-100">Deadlifts</div>
        {offlineSets.map((set, index) => (
          <motion.div data-motion-reveal variants={item} key={index} className="flex items-center justify-between border-t border-divider py-2 first:border-t-0">
            <div className="flex items-center gap-2 text-[12px] tabular-data text-cream-100">
              <span className="text-cream-400">{index + 1}</span>
              <span>{set.w} lbs × {set.r}</span>
            </div>
            <motion.div data-motion-reveal variants={status} className="h-4 w-4 rounded-full bg-accent-clay" />
          </motion.div>
        ))}
      </div>
      <motion.div data-motion-reveal variants={item} className="mt-3 text-center text-[11px] text-cream-400">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={pending ? "saved" : "pending"}
            initial={reduce ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, y: -3 }}
            transition={reduce ? { duration: 0 } : transition}
            data-preview-note
            className="inline-block"
          >
            {pending ? OFFLINE_SAVED : OFFLINE_PENDING}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
