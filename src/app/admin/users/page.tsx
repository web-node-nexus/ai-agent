"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatPaise } from "@/lib/admin-format";

type AdminUser = {
  id: string;
  name: string | null;
  phone: string | null;
  gender: string | null;
  role: string;
  is_banned: boolean;
  is_suspicious: boolean;
  trial_started_at: string | null;
  created_at: string;
  wallet_balance_paise: number;
};

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [walletUserId, setWalletUserId] = useState<string | null>(null);
  const [amountInr, setAmountInr] = useState("10");
  const [note, setNote] = useState("Admin adjustment");

  const search = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const term = (query ?? q).trim();
      if (term) params.set("q", term);
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      setUsers(json.users ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [q]);

  async function patchUser(
    userId: string,
    patch: { is_banned?: boolean; is_suspicious?: boolean }
  ) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...json.user } : u))
      );
      toast.success("User updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function adjustWallet(userId: string) {
    const inr = Number(amountInr);
    if (!Number.isFinite(inr) || inr === 0) {
      toast.error("Enter a non-zero INR amount");
      return;
    }
    const amountPaise = Math.round(inr * 100);
    try {
      const res = await fetch("/api/admin/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amountPaise, note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Wallet adjust failed");
      toast.success("Wallet adjusted");
      setWalletUserId(null);
      await search();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wallet adjust failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search by name, phone, email, or user id. Ban, flag, or adjust wallet.
        </p>
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, phone, email, or UUID…"
          className="sm:max-w-md"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => {
            setQ("");
            void search("");
          }}
        >
          Recent
        </Button>
      </form>

      <div className="space-y-3">
        {users.map((u) => (
          <Card key={u.id}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">
                  {u.name ?? "Unnamed"}{" "}
                  <span className="font-sans text-xs font-normal text-muted-foreground">
                    {u.id.slice(0, 8)}…
                  </span>
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {u.phone ?? "No phone"} · {u.gender ?? "—"} · joined{" "}
                  {formatDate(u.created_at)}
                </p>
                <p className="mt-1 text-sm tabular-nums">
                  Wallet {formatPaise(u.wallet_balance_paise)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {u.role === "admin" && <Badge variant="gold">admin</Badge>}
                {u.is_banned && <Badge className="bg-red-500/20 text-red-200">banned</Badge>}
                {u.is_suspicious && <Badge variant="ai">suspicious</Badge>}
                {u.trial_started_at && <Badge variant="success">trial</Badge>}
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={u.is_banned ? "secondary" : "danger"}
                onClick={() =>
                  void patchUser(u.id, { is_banned: !u.is_banned })
                }
              >
                {u.is_banned ? "Unban" : "Ban"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void patchUser(u.id, { is_suspicious: !u.is_suspicious })
                }
              >
                {u.is_suspicious ? "Clear suspicious" : "Mark suspicious"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setWalletUserId(walletUserId === u.id ? null : u.id)
                }
              >
                Adjust wallet
              </Button>
            </CardContent>
            {walletUserId === u.id && (
              <CardContent className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Amount (INR, negative to debit)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amountInr}
                    onChange={(e) => setAmountInr(e.target.value)}
                  />
                </div>
                <div className="flex-[2] space-y-1">
                  <label className="text-xs text-muted-foreground">Note</label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={() => void adjustWallet(u.id)}>
                  Apply
                </Button>
              </CardContent>
            )}
          </Card>
        ))}
        {!loading && users.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No users yet — search or load recent.
          </p>
        )}
      </div>
    </div>
  );
}
