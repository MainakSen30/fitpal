import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rest Timer",
  description: "Use automatic rest countdowns and haptic alerts between sets so you stay on track and ready for your next set.",
};

export default function RestTimerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
