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
        className="flex flex-col font-sans antialiased text-white bg-black"
        suppressHydrationWarning
      >
        <ApolloWrapper>
          <Header />

          {/* Main Content */}
          <main className="flex-1 w-full px-6 py-8 mx-auto text-gray-100 lg:px-8 xl:px-12 2xl:px-16 max-w-480">
            {children}
          </main>

          <Footer />
        </ApolloWrapper>
      </body>
    </html>
  );
}
