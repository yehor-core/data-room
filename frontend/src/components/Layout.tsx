import React from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { FolderOpen, LogOut, User } from 'lucide-react';
import FileTree from './FileTree';

export const Layout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const showFileTree = params.id;

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="bg-card border-b border-border">
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
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {showFileTree && (
          <aside className="w-64 bg-card border-r border-border p-4 flex flex-col">
            <h2 className="text-lg font-semibold mb-4">Files</h2>
            <div className="overflow-y-auto flex-1">
              <FileTree />
            </div>
          </aside>
        )}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <footer className="bg-card border-t border-border">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 Data Room. Secure document management.
          </p>
        </div>
      </footer>
    </div>
  );
};

