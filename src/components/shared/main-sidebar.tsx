'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Library, PlusCircle, Scissors, Bot, User as UserIcon, LogOut, Beaker } from 'lucide-react';
import { useAuth, useUser } from '@/firebase/auth/use-user';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Skeleton } from '../ui/skeleton';

function UserMenu() {
    const { user, isUserLoading } = useUser();
    const auth = useAuth();
    const router = useRouter();

    const handleSignOut = async () => {
        await auth.signOut();
        router.push('/login');
    };

    if (isUserLoading) {
        return (
            <div className="flex items-center gap-2 p-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
            </div>
        );
    }
    
    if (!user) {
        return (
             <Link href="/login" passHref>
                <Button variant="ghost" className="w-full justify-start">
                    <UserIcon className="mr-2" />
                    Sign In
                </Button>
            </Link>
        )
    }

    const getInitials = (email?: string | null) => {
        return email ? email.substring(0, 2).toUpperCase() : '..';
    }


    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 p-2 h-auto">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start truncate">
                        <span className="text-sm font-medium truncate">{user.displayName || 'User'}</span>
                        <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
                <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={handleSignOut}
                >
                    <LogOut className="mr-2" />
                    Sign Out
                </Button>
            </PopoverContent>
        </Popover>
    )

}

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
           {process.env.NODE_ENV === 'development' && (
            <SidebarMenuItem>
              <Link href="/test-storage" passHref>
                <SidebarMenuButton
                  isActive={isActive('/test-storage')}
                  tooltip="Storage Test"
                  variant="ghost"
                >
                  <Beaker />
                  <span className="truncate">Storage Test</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
