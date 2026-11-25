import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { MotionProvider } from "@/components/motion-provider";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FitPal - Track Your Workouts. Own Your Progress.",
    template: "%s | FitPal",
  },
  description: "The precision gym log designed for serious lifters. Track sets, build routines, and witness strength surges.",
  applicationName: "FitPal",
  keywords: ["workout tracker", "gym log", "fitness app", "workout routine", "strength training", "progress tracker"],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} scroll-smooth dark`}>
      <body className="bg-wine-900 text-cream-100 antialiased selection:bg-wine-700 selection:text-cream-100">
        <noscript>
          <style>{`[data-motion-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <MotionProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-control focus:bg-cream-100 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-wine-950"
          >
            Skip to content
          </a>
          <Navbar />
          <main id="main-content" tabIndex={-1} className="relative focus:outline-none">
            {children}
          </main>
          <SiteFooter />
        </MotionProvider>
      </body>
    </html>
  );
}
