import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  ClipboardList, 
  FileText,
  LogOut,
  School,
  Mail
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const adminNavItems = [
    {
      name: "Dashboard",
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      name: "Users",
      href: "/admin/users",
      icon: Users,
    },
    {
      name: "Classes",
      href: "/admin/classes", 
      icon: BookOpen,
    },
    {
      name: "Assignments",
      href: "/admin/assignments",
      icon: ClipboardList,
    },
    {
      name: "Quizzes",
      href: "/admin/quizzes",
      icon: FileText,
    },
    {
      name: "Contact",
      href: "/admin/contact",
      icon: Mail,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <School className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
                  <p className="text-sm text-muted-foreground">System Administration</p>
                </div>
              </div>
              
              {/* Admin Navigation */}
              <nav className="hidden md:flex items-center gap-1 ml-8">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  
                  return (
                    <Link key={item.name} to={item.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className="gap-2"
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Button>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{user?.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <nav className="flex md:hidden items-center gap-1 mt-4 overflow-x-auto pb-2">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <Link key={item.name} to={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}