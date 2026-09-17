import type { Metadata } from 'next';
import { Roboto_Condensed } from 'next/font/google';
import ApolloWrapper from '../components/ApolloWrapper';
import Footer from '../components/Footer/Footer';
import Header from '../components/Header/Header';
import { SovereigntyAlertsProvider } from '../components/Sovereignty/SovereigntyAlertsProvider';
import './globals.css';

/*
 * The app's one family, replacing Shentox.
 *
 * Shentox is Emtype's retail face. It arrived here because eveonline.com uses
 * it, not with a licence of our own, and this repository is public — so every
 * visitor to GitHub could download the 5.9 MB of font files we were serving.
 * That is a third-party copyright question, and the EVE developer agreement
 * makes us warrant we do not raise one.
 *
 * Roboto Condensed won on measurement rather than taste. Against Shentox on
 * the nav's eight labels at 14px/500 it is 4.2% NARROWER, and 6% narrower on a
 * long alliance name — it gives the dense tables room back instead of taking
 * it. It has real 300/400/500/700, italics for the fourteen places that use
 * one, and tabular figures, which every leaderboard and ISK column depends on.
 *
 * What it lost to, and why each one failed: Titillium Web matched Shentox's
 * width to within 1% but has no 500, and `font-medium` is written in 296
 * places; Oswald is narrower still but has neither italics nor tabular
 * figures; Chakra Petch, Kanit, Bai Jamjuree and Tomorrow have no tabular
 * figures; Exo 2, Barlow and Anybody all passed but are wider. A monospace —
 * the Menlo idea — was measured too: +14% on the nav is survivable, +33% on an
 * alliance name is not.
 *
 * next/font self-hosts the file, so no request leaves the page and there is no
 * layout shift from a late webfont.
 */
const robotoCondensed = Roboto_Condensed({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-roboto-condensed',
  display: 'swap',
});

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
    <html
      lang="en"
      className={robotoCondensed.variable}
      suppressHydrationWarning
    >
      <body
        // Not pure black: with no shadows, the only thing telling a surface it
        // sits above the page is being a shade lighter than it. The ground is
        // EVE Online's own #101010, and `surface` clears it by 1.35:1 — on
        // black that step was 1.13 and a card barely separated.
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
