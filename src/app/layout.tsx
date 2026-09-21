import type { Metadata } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Functional UI — body, buttons, nav, labels, forms, metadata.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Editorial display only — greetings, page titles, large numerals. Weight
// 300 only, per the design handoff; never for buttons/metadata/nav.
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300"],
});

export const metadata: Metadata = {
  title: "Reminder",
  description: "Personal scheduling assistant",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorantGaramond.variable} h-full antialiased`}
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
