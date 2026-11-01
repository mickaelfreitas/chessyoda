import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Set a new password — Chess Yoda" },
      { name: "description", content: "Choose a new password for your Chess Yoda account." },
      { property: "og:title", content: "Set a new password — Chess Yoda" },
      { property: "og:description", content: "Choose a new password for your Chess Yoda account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/play" });
  }
  return (
    <main className="account-screen flex min-h-screen items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border-t border-border py-8">
        <Link to="/" className="text-sm font-semibold">chessyoda.com</Link>
        <h1 className="text-2xl font-bold">New password</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Password</Label>
          <PasswordInput id="pw" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button className="w-full" disabled={busy}>Save password</Button>
      </form>
    </main>
  );
}
