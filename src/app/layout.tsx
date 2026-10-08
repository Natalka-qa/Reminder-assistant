import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Both fonts are served from the app's own files (Fontsource packages,
// SIL Open Font License), not fetched from Google at build time: that
// fetch failed builds now and then ("next/font/google queries have
// exactly one entry", CI and Vercel, 2026-09-30 and 2026-10-07).

// Functional UI — body, buttons, nav, labels, forms, metadata. Inter's
// variable file covers the 400–700 weights used.
const inter = localFont({
  variable: "--font-sans",
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

// Editorial display only — greetings, page titles, large numerals. Weight
// 300 only, per the design handoff; never for buttons/metadata/nav.
const cormorantGaramond = localFont({
  variable: "--font-cormorant",
  src: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-300-normal.woff2",
  weight: "300",
  style: "normal",
  display: "swap",
});

// 2026-10-08 — the same face for digits only, at 88%: Cormorant's lining
// figures (globals.css) are as tall as capitals and looked too big next to
// the letters; old-style ones were the right size but uneven. First in
// --font-display, so every display line gets them; a face without a space
// isn't the line's primary font, so line height stays Cormorant's.
const cormorantDigits = localFont({
  variable: "--font-cormorant-digits",
  src: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-300-normal.woff2",
  weight: "300",
  style: "normal",
  display: "swap",
  adjustFontFallback: false,
  declarations: [
    { prop: "size-adjust", value: "88%" },
    { prop: "unicode-range", value: "U+0030-0039" },
  ],
});

export const metadata: Metadata = {
  title: "Reminder",
  description: "Personal scheduling assistant",
};

// viewport-fit=cover makes env(safe-area-inset-*) report the iPhone's
// insets instead of 0 — BottomNav pads itself by the bottom one
// (sprint-16-tasks.md S16-05).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorantGaramond.variable} ${cormorantDigits.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/* Forced light — the design handoff (design_handoff_reminder_assistant)
            only specifies a light palette; following the OS into dark mode
            would silently fall back to the old shadcn dark tokens instead of
            this design. Revisit once/if a dark variant is designed. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
