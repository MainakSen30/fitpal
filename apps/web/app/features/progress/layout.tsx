import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Weekly Progress",
  description: "Track weekly workouts, sets, volume, and time while comparing week-over-week to optimize your training.",
};

export default function ProgressLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
