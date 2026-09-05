import type { Metadata } from 'next';
import ApolloWrapper from '../components/ApolloWrapper';
import Footer from '../components/Footer/Footer';
import Header from '../components/Header/Header';
import { SovereigntyAlertsProvider } from '../components/Sovereignty/SovereigntyAlertsProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'KillReport',
  description: 'EVE Online Killmail Tracker',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        // Not pure black: with no shadows, the only thing telling a surface it
        // sits above the page is being a shade lighter than it. On black, a
        // gray-900 card barely separated.
        className="flex flex-col font-sans antialiased text-white bg-ground"
        suppressHydrationWarning
      >
        <ApolloWrapper>
          <SovereigntyAlertsProvider>
            <Header />

            {/* Main Content */}
            <main className="flex-1 w-full px-6 py-8 mx-auto text-gray-100 lg:px-8 xl:px-12 2xl:px-16 max-w-480">
              {children}
            </main>

            <Footer />
          </SovereigntyAlertsProvider>
        </ApolloWrapper>
      </body>
    </html>
  );
}
