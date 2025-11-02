'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Library, PlusCircle, Scissors, Bot } from 'lucide-react';

export function MainSidebar() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg whitespace-nowrap">VEO Studio Pro</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/create" passHref>
              <SidebarMenuButton
                isActive={isActive('/create')}
                tooltip="Create"
              >
                <PlusCircle />
                <span className="truncate">Create</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/library" passHref>
              <SidebarMenuButton
                isActive={isActive('/library')}
                tooltip="Library"
              >
                <Library />
                <span className="truncate">Library</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/editor" passHref>
              <SidebarMenuButton
                isActive={isActive('/editor')}
                tooltip="Editor"
              >
                <Scissors />
                <span className="truncate">Editor</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
