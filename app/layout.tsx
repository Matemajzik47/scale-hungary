import type { Metadata, Viewport } from "next";
import { Manrope, Sora, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import BottomNavBar from "@/components/BottomNavBar";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { PushPrompt } from "@/components/pwa/PushPrompt";
import { ProgressToast } from "@/components/progress/ProgressToast";
import { SITE_URL } from "@/lib/site";

// Törzsszöveg: modern, letisztult, jól olvasható (ő/ű miatt latin-ext)
const jakarta = Manrope({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
});

// Címsorok és számok: technikás, fiatalos karakter
const display = Sora({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Scale",
  description: "Magyar zenei rating platform",
  openGraph: { siteName: "Scale", locale: "hu_HU", type: "website" },
  twitter: { card: "summary_large_image" },
  applicationName: "Scale",
  appleWebApp: { capable: true, title: "Scale", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#111214",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hu"
      className={`${jakarta.variable} ${display.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-16 sm:pb-0">
        <NavBar />
        <PlayerProvider>{children}</PlayerProvider>
        <BottomNavBar />
        <PwaRegister />
        <PushPrompt />
        <ProgressToast />
      </body>
    </html>
  );
}
