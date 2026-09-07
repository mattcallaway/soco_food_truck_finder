import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { APP_CONFIG } from '@/config/app-config';
import { AuthProvider } from '@/context/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: `${APP_CONFIG.productName} | Discover Mobile Food Vendors in Sonoma County`,
  description:
    'Find scheduled food trucks, pop-ups, taco stands, mobile pizza ovens, and carts appearing today in Sonoma County, California.',
  openGraph: {
    title: APP_CONFIG.productName,
    description: 'Find food trucks appearing in Santa Rosa, Petaluma, Sebastopol, Healdsburg, and Sonoma today.',
    siteName: APP_CONFIG.productName,
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 flex flex-col min-h-screen`}>
        <AuthProvider>
          <Header />
          <main className="flex-1 flex flex-col">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
