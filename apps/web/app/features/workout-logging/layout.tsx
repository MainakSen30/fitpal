import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workout Logging",
  description: "Log sets, reps, and weights faster. Start from scratch or from a routine and track your progress set by set.",
};

export default function WorkoutLoggingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
