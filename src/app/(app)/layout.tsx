'use client';

import { AppContextProvider } from '@/contexts/app-context';
import { MainSidebar } from '@/components/shared/main-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppContextProvider>
      <AuthGuard>
        <SidebarProvider>
          <MainSidebar />
          <SidebarInset className="flex flex-col">
            {children}
          </SidebarInset>
        </SidebarProvider>
      </AuthGuard>
    </AppContextProvider>
  );
}
