"use client";

import { WifiOff } from "lucide-react";
import { MotionReveal } from "@/components/motion-reveal";
import { PhoneMockup, OfflineSyncMockup } from "@/components/phone-mockup";
import { FeatureIntro } from "@/components/feature-intro";
import { SiteCta } from "@/components/site-cta";

const points = [
  { title: "Full Offline Support", desc: "Log sets, reps, weights without internet connection" },
  { title: "Local First", desc: "Zero loading delays, works anywhere in the world" },
  { title: "Auto Sync", desc: "Seamlessly syncs when connection is restored" },
  { title: "Never Lose Data", desc: "Everything saved locally until synced to cloud" },
];

export default function OfflineSyncPage() {
  return (
    <div className="overflow-x-hidden text-cream-100 antialiased">
      <section className="container-editorial pb-16 pt-28 sm:pt-32 lg:pb-20 lg:pt-36">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
          <MotionReveal className="lg:order-2 lg:col-span-7">
            <FeatureIntro
              index="06"
              title="100% Offline Ready"
              body="Gym basement with no signal? No problem. Log your entire workout offline and it syncs automatically when you're back online. Never miss a rep."
            />
          </MotionReveal>

          <MotionReveal className="flex justify-center lg:order-1 lg:col-span-5 lg:justify-start" delay={0.06}>
            <div className="w-full max-w-[360px]">
              <div className="mb-5 flex items-center justify-between border-b border-hairline pb-3">
                <span className="type-label">Session</span>
                <span className="type-label">06 / 06</span>
              </div>
              <div className="flex justify-center lg:justify-start">
                <PhoneMockup>
                  <OfflineSyncMockup />
                </PhoneMockup>
              </div>
            </div>
          </MotionReveal>
        </div>
      </section>

      <section className="container-editorial pb-20 lg:pb-24">
        <MotionReveal inView className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-8">
            <div className="flex items-center gap-2.5">
              <WifiOff className="h-3.5 w-3.5 text-accent-clay" aria-hidden="true" />
              <span className="type-label tracking-[0.1em] text-cream-200">Offline Mode - Saved Locally</span>
            </div>
            <span className="type-label hidden sm:inline">Device</span>
          </div>
          <div className="grid gap-px bg-hairline sm:grid-cols-2">
            {points.map((point, index) => (
              <div key={point.title} className="bg-wine-900 p-6 sm:p-8 lg:p-10">
                <span className="type-label">0{index + 1}</span>
                <h2 className="type-title mt-5">{point.title}</h2>
                <p className="type-body mt-2">{point.desc}</p>
              </div>
            ))}
          </div>
        </MotionReveal>
      </section>

      <SiteCta
        actions={[
          { label: "Download FitPal", href: "/#download" },
          { label: "Back to Features", href: "/#features" },
        ]}
      />
    </div>
  );
}
