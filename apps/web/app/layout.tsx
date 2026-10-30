import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FitPal - Track Your Workouts. Own Your Progress.",
  description: "FitPal is your personal workout tracker. Build routines, log sets and reps, track your history, and measure your progress week by week.",
  keywords: ["workout tracker", "gym log", "fitness app", "workout routine", "strength training", "progress tracker"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${inter.variable} font-sans antialiased tracking-tight`}
      >
        {children}
      </body>
    </html>
  );
}
