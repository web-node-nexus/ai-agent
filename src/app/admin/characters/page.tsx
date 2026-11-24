"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CharacterRow = {
  id: string;
  slug: string;
  name: string;
  gender: string;
  age: number;
  city: string;
  bio: string;
  speaking_style: string;
  is_active: boolean;
  sort_order: number;
  cover_url: string;
};

export default function AdminCharactersPage() {
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [editing, setEditing] = useState<Record<string, Partial<CharacterRow>>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/characters");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setCharacters(json.characters ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function draft(id: string): CharacterRow {
    const base = characters.find((c) => c.id === id)!;
    return { ...base, ...editing[id] };
  }

  async function save(id: string) {
    const d = draft(id);
    try {
      const res = await fetch("/api/admin/characters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          is_active: d.is_active,
          sort_order: Number(d.sort_order),
          bio: d.bio,
          name: d.name,
          city: d.city,
          speaking_style: d.speaking_style,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setCharacters((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...json.character } : c))
      );
      setEditing((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success("Character saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Characters</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toggle active, reorder, and edit bio basics. Replace art under{" "}
          <code className="text-rose-200">/public/characters/</code>.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading characters…</p>
      )}

      <div className="space-y-4">
        {characters.map((c) => {
          const d = draft(c.id);
          return (
            <Card key={c.id}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.cover_url}
                    alt=""
                    className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/15"
                  />
                  <div>
                    <CardTitle className="text-base">
                      {c.name}{" "}
                      <span className="font-sans text-xs font-normal text-muted-foreground">
                        /{c.slug}
                      </span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {c.gender} · {c.age} · {c.city}
                    </p>
                  </div>
                </div>
                {d.is_active ? (
                  <Badge variant="success">active</Badge>
                ) : (
                  <Badge variant="muted">inactive</Badge>
                )}
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input
                    value={d.name}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [c.id]: { ...prev[c.id], name: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">City</label>
                  <Input
                    value={d.city}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [c.id]: { ...prev[c.id], city: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs text-muted-foreground">Bio</label>
                  <textarea
                    className="min-h-[80px] w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm"
                    value={d.bio}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [c.id]: { ...prev[c.id], bio: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Speaking style
                  </label>
                  <Input
                    value={d.speaking_style}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [c.id]: {
                          ...prev[c.id],
                          speaking_style: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Sort order
                  </label>
                  <Input
                    type="number"
                    value={d.sort_order}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [c.id]: {
                          ...prev[c.id],
                          sort_order: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setEditing((prev) => ({
                        ...prev,
                        [c.id]: {
                          ...prev[c.id],
                          is_active: !d.is_active,
                        },
                      }))
                    }
                  >
                    {d.is_active ? "Set inactive" : "Set active"}
                  </Button>
                  <Button size="sm" onClick={() => void save(c.id)}>
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
