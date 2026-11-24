"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/admin-format";

type SettingRow = {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
};

const NUMBER_KEYS = new Set([
  "trial_chat_seconds",
  "trial_free_images",
  "video_paise_per_min",
  "video_min_balance_paise",
  "image_price_paise",
  "sub_daily_message_cap",
  "max_call_seconds",
  "data_retention_days",
  "gst_rate_bps",
]);

const BOOL_KEYS = new Set(["require_phone_verification"]);

export default function AdminSettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      const list: SettingRow[] = json.rows ?? [];
      setRows(list);
      const next: Record<string, string> = {};
      for (const row of list) {
        next[row.key] =
          typeof row.value === "string"
            ? row.value
            : JSON.stringify(row.value, null, 2);
      }
      setDrafts(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(key: string) {
    const raw = drafts[key] ?? "";
    let value: unknown = raw;
    try {
      if (NUMBER_KEYS.has(key)) {
        value = Number(raw);
        if (!Number.isFinite(value as number)) throw new Error("Not a number");
      } else if (BOOL_KEYS.has(key)) {
        const t = raw.trim().toLowerCase();
        if (t === "true" || t === "1") value = true;
        else if (t === "false" || t === "0") value = false;
        else value = JSON.parse(raw);
      } else {
        value = JSON.parse(raw);
      }
    } catch {
      toast.error(`Invalid value for ${key}`);
      return;
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      toast.success(`Saved ${key}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit <code className="text-rose-200">app_settings</code> keys. Numbers
          and booleans use simple forms; objects/arrays use JSON.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      )}

      <div className="space-y-4">
        {rows.map((row) => {
          const isJson = !NUMBER_KEYS.has(row.key) && !BOOL_KEYS.has(row.key);
          return (
            <Card key={row.key}>
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-sm">{row.key}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Updated {formatDate(row.updated_at)}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {isJson ? (
                  <textarea
                    className="min-h-[140px] w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 font-mono text-xs"
                    value={drafts[row.key] ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.key]: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <Input
                    value={drafts[row.key] ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.key]: e.target.value,
                      }))
                    }
                    placeholder={
                      BOOL_KEYS.has(row.key) ? "true / false" : "number"
                    }
                  />
                )}
                <Button size="sm" onClick={() => void save(row.key)}>
                  Save
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
