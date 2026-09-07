import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { HelpLink } from "@/components/help-link";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { ModeToggle } from "@/components/toggle-mode";
import { SignOut } from "../components/signout-button";
import Link from "next/link";
import { auth } from "@/auth";
import "./globals.css";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Self-Service API",
  description: "Deploy a REST API from a postgresql database easily",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

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
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <Link href="/" className="mr-auto text-base font-semibold">
              Self-Service API
            </Link>
            <ModeToggle />
            <HelpLink />
            {session && <SignOut />}
          </header>
          <main className="mx-auto w-full max-w-3xl flex-1 p-4">{children}</main>
          <footer className="border-t p-4 text-center text-sm">
            Self-Service API | JTEKT Corporation
          </footer>
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
