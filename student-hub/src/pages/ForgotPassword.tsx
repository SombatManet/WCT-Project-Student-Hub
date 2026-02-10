import { useState } from "react";
import { supabase, ensureSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast({ title: "Invalid email", description: "Please enter a valid email address." , variant: "destructive"});
      return;
    }
    setLoading(true);
    try {
      ensureSupabaseConfigured();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // To avoid account enumeration, always show a neutral success message
      if (error) console.warn('resetPasswordForEmail error:', error.message);
      toast({ title: "If an account exists, you'll get an email", description: "Check your inbox for the reset link." });
    } catch (err: any) {
      console.error('forgot-password fatal error:', err);
      toast({ title: "Setup issue", description: err.message || "Unable to send reset link.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Forgot your password?</CardTitle>
          <CardDescription>Enter your email to receive a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input type="email" placeholder="you@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
