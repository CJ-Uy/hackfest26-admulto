import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { BackgroundScrollDriver } from "@/components/shared/BackgroundScrollDriver";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schrollar — Turn Your Schroll Into Research",
  description:
    "Research you already know how to scroll. Every minute produces something useful.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <BackgroundScrollDriver />
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
