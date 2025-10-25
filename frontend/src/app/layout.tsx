import type { Metadata } from "next";
import ApolloWrapper from "../components/ApolloWrapper";
import Footer from "../components/Footer/Footer";
import Header from "../components/Header/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "KillReport",
  description: "EVE Online Killmail Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="flex flex-col min-h-screen antialiased bg-gray-50"
        suppressHydrationWarning
      >
        <ApolloWrapper>
          <Header />

          {/* Main Content */}
          <main className="flex-1 w-full px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
            {children}
          </main>

          <Footer />
        </ApolloWrapper>
      </body>
    </html>
  );
}
