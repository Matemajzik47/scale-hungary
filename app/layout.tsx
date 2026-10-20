import type { Metadata, Viewport } from "next";
import { Manrope, Sora, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import BottomNavBar from "@/components/BottomNavBar";
import { PwaRegister } from "@/components/pwa/PwaRegister";

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
  title: "Scale",
  description: "Magyar zenei rating platform",
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
      <body className="min-h-full flex flex-col pb-16">
        <NavBar />
        {children}
        <BottomNavBar />
        <PwaRegister />
      </body>
    </html>
  );
}
