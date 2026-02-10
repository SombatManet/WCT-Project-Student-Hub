import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, Mail, Info } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold">ReanHub</span>
            </div>
            <nav className="hidden md:flex gap-6">
              <Link to="/about" className="text-sm font-medium hover:text-primary transition-colors">About</Link>
              <Link to="/services" className="text-sm font-medium hover:text-primary transition-colors">Services</Link>
              <Link to="/contact" className="text-sm font-medium hover:text-primary transition-colors">Contact</Link>
            </nav>
            <div className="flex gap-2">
              <Button variant="ghost" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              Welcome to <span className="text-primary">ReanHub</span>
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              A modern learning management platform for students and teachers to collaborate, manage classes, assignments, and quizzes.
            </p>
          </div>

          <div className="flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/register">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/about">Learn More</Link>
            </Button>
          </div>

          {/* Quick Links */}
          <div className="grid gap-6 sm:grid-cols-3 max-w-3xl mx-auto pt-12">
            <Link to="/about" className="group p-6 rounded-lg border bg-card hover:shadow-lg transition-all">
              <Info className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">About Us</h3>
              <p className="text-sm text-muted-foreground">Learn about our mission and values</p>
            </Link>
            <Link to="/services" className="group p-6 rounded-lg border bg-card hover:shadow-lg transition-all">
              <BookOpen className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Services</h3>
              <p className="text-sm text-muted-foreground">Discover what we offer</p>
            </Link>
            <Link to="/contact" className="group p-6 rounded-lg border bg-card hover:shadow-lg transition-all">
              <Mail className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Contact</h3>
              <p className="text-sm text-muted-foreground">Get in touch with us</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
