import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { FolderOpen, LogOut, User } from 'lucide-react';
import { ModeToggle } from './ModeToggle';

export const Layout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl text-primary">
              <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="hidden sm:inline">Data Room</span>
              <span className="sm:hidden">DR</span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              {user && (
                <>
                  <div className="hidden md:flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <span className="max-w-[150px] truncate">{user.name || user.email}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </>
              )}
              <ModeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 Data Room. Secure document management.
          </p>
        </div>
      </footer>
    </div>
  );
};

