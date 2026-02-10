import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import axios from 'axios';

export default function Contact() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !message) {
      toast({ 
        title: "Error", 
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    if (!email.includes('@')) {
      toast({ 
        title: "Error", 
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await axios.post('http://localhost:5000/api/contact', {
        name,
        email,
        message
      });
      
      if (response.data.status === 'success') {
        setName(""); 
        setEmail(""); 
        setMessage("");
        toast({ 
          title: "Success!", 
          description: "Your message has been sent. We'll get back to you soon." 
        });
      }
    } catch (error: any) {
      console.error('Contact form error:', error);
      toast({ 
        title: "Error", 
        description: error.response?.data?.message || "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h1 className="text-4xl font-bold">Contact</h1>
        <p className="mt-3 text-muted-foreground">We usually respond within 1-2 business days.</p>
      </header>
      <main className="mx-auto max-w-xl px-6 pb-24">
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium">Message</label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder="How can we help?" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Sending…' : 'Send Message'}</Button>
        </form>
      </main>
    </div>
  );
}
