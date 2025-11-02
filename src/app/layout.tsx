import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { FirebaseProvider } from '@/firebase';


export const metadata: Metadata = {
  title: 'VEO Studio Pro',
  description: 'Generate stunning videos from text and images with VEO3.',
};

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseProvider>
          <FirebaseErrorListener />
          {children}
          <Toaster />
        </FirebaseProvider>
      </body>
    </html>
  );
}
