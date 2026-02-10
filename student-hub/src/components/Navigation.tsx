import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GraduationCap, LayoutDashboard, BookOpen, FileText, Brain, LogOut, Menu, X, Shield, Mail, User } from "lucide-react";
import { useState } from "react";

export const Navigation = () => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getInitials = (username?: string) => {
    if (!username) return 'U';
    return username
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const links = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/classes", icon: BookOpen, label: "Classes" },
    { to: "/assignments", icon: FileText, label: "Assignments" },
    { to: "/quizzes", icon: Brain, label: "Quizzes" },
    { to: "/messages", icon: Mail, label: "Messages" },
    ...(user?.role === "admin" ? [{ to: "/admin", icon: Shield, label: "Admin" }] : []),
  ];

  const infoLinks = [
    { to: "/about", label: "About" },
    { to: "/services", label: "Services" },
    { to: "/contact", label: "Contact" },
  ];

  return (
    <nav className="border-b bg-card shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">ReanHub</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-4">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeClassName="bg-muted text-foreground"
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            ))}
            <div className="border-l pl-4 ml-2 flex gap-2">
              {infoLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  activeClassName="bg-muted text-foreground"
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* User Info & Logout */}
          <div className="hidden md:flex md:items-center md:gap-4">
            <NavLink
              to="/profile"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeClassName="bg-muted text-foreground"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage 
                  src={(user as any)?.avatar_url ? `http://localhost:5000${(user as any).avatar_url}` : undefined} 
                  alt={user?.username} 
                />
                <AvatarFallback className="text-xs">
                  {getInitials(user?.username)}
                </AvatarFallback>
              </Avatar>
              Profile
            </NavLink>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user?.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden rounded-lg p-2 text-foreground hover:bg-muted"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t py-4 md:hidden">
            <div className="space-y-2">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  activeClassName="bg-muted text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              ))}
              <div className="border-t my-2 pt-2">
                {infoLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    activeClassName="bg-muted text-foreground"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>
            </div>
            <div className="mt-4 border-t pt-4">
              <div className="mb-3 px-3">
                <p className="text-sm font-medium text-foreground">{user?.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <Button
                onClick={logout}
                variant="outline"
                size="sm"
                className="w-full gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
