import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Ensure we have a valid recovery session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated", description: "You can now log in with your new password." });
      window.location.href = "/login";
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Open this page from the email reset link.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Set new password</CardTitle>
          <CardDescription>Enter a strong password you can remember.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input type="password" placeholder="••••••••" value={password} onChange={(e)=>setPassword(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Updating…' : 'Update password'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
