import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://salaryflow-two.vercel.app";

const description =
  "Manage employee loans, salary deductions, repayments and financial accounts from one simple platform.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "SalaryFlow",
  title: {
    default: "SalaryFlow | Salary-Based Employee Finance",
    template: "%s | SalaryFlow",
  },
  description,
  keywords: [
    "SalaryFlow",
    "employee finance",
    "salary loans",
    "payroll deductions",
    "salary advance",
    "loan management",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/brand/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SalaryFlow",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: "SalaryFlow",
    url: "/",
    title: "SalaryFlow | Salary-Based Employee Finance",
    description,
    images: [
      {
        url: "/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "SalaryFlow logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SalaryFlow | Salary-Based Employee Finance",
    description,
    images: ["/brand/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#102A43" },
    { media: "(prefers-color-scheme: dark)", color: "#071A2F" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
