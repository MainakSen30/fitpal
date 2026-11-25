"use client";

import Link from "next/link";
import { ArrowUpRight, Trophy } from "lucide-react";
import { MotionReveal } from "@/components/motion-reveal";
import { PhoneMockup, HeroSessionMockup } from "@/components/phone-mockup";
import { SiteCta } from "@/components/site-cta";

const glance = [
  { index: "01", value: "0.4s", label: "Set Logging" },
  { index: "02", value: "100%", label: "Offline Ready" },
  { index: "03", value: "Smart", label: "PR Tracking" },
];

const stats = [
  { value: "12.4M+", label: "Sets Logged" },
  { value: "99.8%", label: "Completion Rate" },
  { value: "180+", label: "Smart Routines" },
  { value: "Free", label: "No Ads" },
];

const features = [
  {
    title: "Workout Logging",
    description: "Log every exercise, set, rep, and weight without interrupting your workout.",
    href: "/features/workout-logging",
  },
  {
    title: "Routines",
    description: "Create and reuse your own workout routines to make every training session easier to start.",
    href: "/features/routines",
  },
  {
    title: "Logbook & PRs",
    description: "Look back at previous workouts and keep track of your personal records.",
    href: "/features/logbook",
  },
  {
    title: "Weekly Progress",
    description: "See your weekly training activity and understand how consistently you're progressing.",
    href: "/features/progress",
  },
  {
    title: "Rest Timer",
    description: "Keep your recovery on track with a built-in rest timer between sets.",
    href: "/features/rest-timer",
  },
  {
    title: "Offline Ready",
    description: "Keep logging your workouts even when you don't have an internet connection.",
    href: "/features/offline-sync",
  },
];

export default function Home() {
  return (
    <div className="overflow-x-hidden text-cream-100 antialiased">
      <section className="container-editorial pb-16 pt-28 sm:pt-32 lg:pb-20 lg:pt-36">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
          <MotionReveal className="lg:col-span-7">
            <div className="type-eyebrow">
              <span className="h-px w-6 bg-accent-clay" aria-hidden="true" />
              <span>Mobile-First Workout Tracker</span>
            </div>
            <h1 className="type-display mt-6 max-w-2xl">
              Track Your Workouts.
              <br />
              Own Your Progress.
            </h1>
            <p className="type-body-lg mt-6 max-w-xl">
              The simplest way to log every set, build your routines, and track your strength progress. Everything you
              need to stay consistent, all in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="#download" className="button-primary px-6 py-3 text-sm">
                Download FitPal Free
              </Link>
              <Link href="/features/workout-logging" className="text-link text-sm">
                Explore Features
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </MotionReveal>

          <MotionReveal className="lg:col-span-5 lg:pt-3" delay={0.06}>
            <div className="border-t border-hairline">
              {glance.map((item) => (
                <div key={item.label} className="flex items-baseline justify-between gap-6 border-b border-hairline py-5">
                  <div className="flex items-baseline gap-4">
                    <span className="type-label w-6 flex-shrink-0">{item.index}</span>
                    <span className="type-title">{item.label}</span>
                  </div>
                  <span className="type-metric text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </MotionReveal>
        </div>
      </section>

      <section className="container-editorial pb-16 lg:pb-24">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-clay" aria-hidden="true" />
              <span className="type-label text-cream-200">Active Session</span>
            </div>
            <span className="type-label hidden sm:inline">Workout Logging</span>
          </div>

          <div className="grid gap-10 px-5 py-10 sm:px-8 lg:grid-cols-12 lg:items-stretch lg:gap-12 lg:py-14">
            <div className="lg:col-span-4 lg:flex lg:flex-col lg:justify-between">
              <div className="border-t border-hairline">
                <div className="border-b border-hairline py-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="type-label text-cream-300">Weekly Volume</span>
                    <span className="type-label text-accent-clay">+14.2%</span>
                  </div>
                  <div className="type-metric mt-3">
                    14,850 <span className="type-label align-middle text-cream-400">lbs</span>
                  </div>
                </div>
                <div className="border-b border-hairline py-5">
                  <div className="flex items-center gap-2.5">
                    <Trophy className="h-3.5 w-3.5 text-accent-clay" aria-hidden="true" />
                    <span className="type-label text-cream-300">New PR</span>
                  </div>
                  <div className="type-title mt-3">Bench 255 lbs</div>
                </div>
              </div>
              <Link href="/features/workout-logging" className="text-link mt-6 text-sm">
                Learn more
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="flex justify-center lg:col-span-8 lg:justify-end">
              <PhoneMockup>
                <HeroSessionMockup />
              </PhoneMockup>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-hairline">
        <div className="container-editorial">
          <div className="grid grid-cols-2 gap-px bg-hairline lg:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={stat.label} className="bg-wine-900 px-5 py-8 lg:px-8 lg:py-10">
                <span className="type-label">0{index + 1}</span>
                <div className="type-metric mt-4">{stat.value}</div>
                <div className="type-small mt-2">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="container-editorial scroll-mt-24 py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <span className="type-label">Features</span>
            <h2 className="type-headline mt-4 max-w-md">Everything You Need to Own Your Progress.</h2>
            <p className="type-body-lg mt-5 max-w-sm">
              From logging every set to tracking personal records, FitPal keeps your training organised and your
              progress visible.
            </p>
          </div>

          <div className="lg:col-span-8">
            <div className="border-t border-hairline">
              {features.map((feature, index) => (
                <Link
                  key={feature.href}
                  href={feature.href}
                  className="group grid gap-2 border-b border-hairline py-6 transition-colors hover:bg-wine-800/30 sm:grid-cols-[2.5rem_1fr_auto] sm:items-baseline sm:gap-6 sm:px-3"
                >
                  <span className="type-label">0{index + 1}</span>
                  <div>
                    <h3 className="type-title">{feature.title}</h3>
                    <p className="type-body mt-1.5 max-w-lg">{feature.description}</p>
                  </div>
                  <span className="type-label flex items-center gap-2 text-cream-300 transition-colors group-hover:text-cream-100">
                    Learn more
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SiteCta
        id="download"
        actions={[
          { label: "Download for iOS", href: "#download" },
          { label: "Download for Android", href: "#download" },
        ]}
      />
    </div>
  );
}
