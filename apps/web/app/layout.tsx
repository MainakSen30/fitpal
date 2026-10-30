import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitPal - Track Your Workouts. Own Your Progress.",
  description: "The precision gym log designed for serious lifters. Track sets, build routines, and witness strength surges.",
  keywords: ["workout tracker", "gym log", "fitness app", "workout routine", "strength training", "progress tracker"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth dark">
      <body className="bg-dark-base text-gray-100 antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
