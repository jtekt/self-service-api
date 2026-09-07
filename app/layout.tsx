import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { HelpLink } from "@/components/help-link";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { ModeToggle } from "@/components/toggle-mode";
import { SignOut } from "../components/signout-button";
import Link from "next/link";
import "./globals.css";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Self-service API",
  description: "Deploy a REST API from a postgresql database easily",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "flex min-h-screen flex-col font-sans antialiased",
          fontSans.variable,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <header className="fixed top-0 right-0 left-0 z-50 flex h-12 items-center gap-2 border-b bg-background px-4">
            <Link href="/" className="mr-auto text-2xl">
              Self-service API
            </Link>
            <ModeToggle />
            <HelpLink />
            <SignOut />
          </header>
          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-4 pt-12">
            {children}
          </main>
          <footer className="border-t p-4 text-center text-sm">
            Self-service API | JTEKT Corporation
          </footer>
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
