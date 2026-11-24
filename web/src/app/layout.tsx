import type { Metadata } from "next";
import { Cairo, Tajawal } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { themeInitScript } from "@/components/layout/ThemeToggle";
import { TopBar } from "@/components/layout/TopBar";
import { fetchCurrentUser, fetchUnreadCount } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import "./globals.css";

// Body: Tajawal. Display (headings, numbers, the emblem): Cairo. Both from the reference.
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "واثق",
  description: "منصة للمبادرات المدنية والفعاليات التطوعية والحالات الإنسانية في سوريا.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getSessionToken();
  const [user, unread] = await Promise.all([fetchCurrentUser(token), fetchUnreadCount(token)]);
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} ${cairo.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <AppShell
          sidebar={<Sidebar user={user} unread={unread} />}
          topbar={<TopBar user={user} unread={unread} />}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
