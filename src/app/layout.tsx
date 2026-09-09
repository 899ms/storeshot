import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const font = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "App Store Screenshots",
  description: "Design and export iPhone App Store screenshots.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions may set inline styles
    // (e.g. overscroll-behavior) on <html>/<body> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply stored/system color theme before paint to avoid a flash. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("screenshots-color-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={font.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
