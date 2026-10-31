import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Chess Yoda" },
      { name: "description", content: "Sign in or create your Chess Yoda training account." },
      { property: "og:title", content: "Sign in — Chess Yoda" },
      { property: "og:description", content: "Sign in or create your Chess Yoda training account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rating, setRating] = useState("1400");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/play" });
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/play", data: { display_name: name, rating } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/play" });
        else setSent("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setSent("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-soft">
        <Link to="/" className="text-sm font-semibold uppercase tracking-widest text-primary">
          Chess Yoda
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{mode === "in" ? "Welcome back" : mode === "up" ? "Create account" : "Reset password"}</h1>
        {sent ? (
          <p className="mt-4 text-sm text-muted-foreground">{sent}</p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "up" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rating">Your current rating</Label>
                  <Input id="rating" type="number" min={400} max={3000} value={rating} onChange={(e) => setRating(e.target.value)} required />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
            </Button>
          </form>
        )}
        <div className="mt-4 flex flex-col gap-1 text-sm">
          {mode !== "in" && (
            <button className="text-left text-primary" onClick={() => { setMode("in"); setSent(null); }}>
              Have an account? Sign in
            </button>
          )}
          {mode !== "up" && (
            <button className="text-left text-primary" onClick={() => { setMode("up"); setSent(null); }}>
              New here? Create an account
            </button>
          )}
          {mode === "in" && (
            <button className="text-left text-muted-foreground" onClick={() => { setMode("forgot"); setSent(null); }}>
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
