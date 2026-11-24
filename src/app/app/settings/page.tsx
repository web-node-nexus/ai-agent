"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  Download,
  LogOut,
  Moon,
  Sun,
  Trash2,
  MessageSquareOff,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);

  const isDark = (resolvedTheme ?? theme) !== "light";

  const logout = async () => {
    setBusy("logout");
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
    } catch {
      toast.error("Logout failed");
    } finally {
      setBusy(null);
    }
  };

  const deleteChatHistory = async () => {
    if (!confirm("Delete all chat history? This cannot be undone.")) return;
    setBusy("chats");
    try {
      const res = await fetch("/api/account/delete-chats", {
        method: "POST",
        credentials: "include",
      }).catch(() => null);

      if (!res || !res.ok) {
        // Fallback: wipe via supabase client if RLS allows
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");
        await supabase.from("messages").delete().eq("user_id", user.id);
        await supabase.from("conversations").delete().eq("user_id", user.id);
      }
      toast.success("Chat history deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete chats");
    } finally {
      setBusy(null);
    }
  };

  const exportData = async () => {
    setBusy("export");
    try {
      const res = await fetch("/api/account/export", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taraworld-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    if (
      !confirm(
        "Permanently delete your TaraWorld account and data? This cannot be undone."
      )
    ) {
      return;
    }
    const confirmText = prompt('Type DELETE to confirm account deletion');
    if (confirmText !== "DELETE") {
      toast.message("Account deletion cancelled");
      return;
    }
    setBusy("delete");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Delete failed");
      toast.success("Account deleted");
      router.replace("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-4 pb-4 pt-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Theme, data, and account controls.
        </p>
      </header>

      <div className="space-y-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Appearance</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {isDark ? "Dark plum" : "Light mist"}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTheme(isDark ? "light" : "dark")}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? "Light" : "Dark"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your data</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                variant="secondary"
                className="justify-start"
                disabled={busy === "chats"}
                onClick={() => void deleteChatHistory()}
              >
                <MessageSquareOff className="h-4 w-4" />
                Delete chat history
              </Button>
              <Button
                variant="secondary"
                className="justify-start"
                disabled={busy === "export"}
                onClick={() => void exportData()}
              >
                <Download className="h-4 w-4" />
                Export my data
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-danger/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-danger">
                <AlertTriangle className="h-4 w-4" />
                Danger zone
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                variant="danger"
                className="justify-start"
                disabled={busy === "delete"}
                onClick={() => void deleteAccount()}
              >
                <Trash2 className="h-4 w-4" />
                Delete account
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                disabled={busy === "logout"}
                onClick={() => void logout()}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

    </div>
  );
}
