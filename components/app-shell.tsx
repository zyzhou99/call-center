"use client";

import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LogOut, User, Bell, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>
      {children}
    </div>
  );
}

export function AppHeader() {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh-Hant' : 'en');
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <header className="h-16 bg-white flex items-center justify-end px-6" style={{ borderBottom: '1px solid var(--divider)' }}>
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-gray-100"
        >
          <Bell className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLanguage}
          className="hover:bg-gray-100"
        >
          <Languages className="w-4 h-4 mr-1.5" style={{ color: 'var(--text-secondary)' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {language === 'en' ? 'EN' : '繁'}
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center space-x-2 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors focus:outline-none">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium" style={{ backgroundColor: 'var(--avatar-bg)', color: 'var(--accent)' }}>
              {initials}
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.name}</span>
            <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
