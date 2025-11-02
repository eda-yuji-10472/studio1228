import { AppContextProvider } from '@/contexts/app-context';
import { MainSidebar } from '@/components/shared/main-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppContextProvider>
      <SidebarProvider>
        <MainSidebar />
        <SidebarInset className="flex flex-col">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </AppContextProvider>
  );
}
