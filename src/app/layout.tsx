import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store/app-store";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "sonner";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-serif",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Own-ed — Founder Operating System",
  description: "Private founder OS for planning OWN Pilates studio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable} font-sans antialiased`}>
        <AppProvider>
          <AppShell>{children}</AppShell>
          <Toaster position="bottom-right" />
        </AppProvider>
      </body>
    </html>
  );
}
