import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function SetupDialog() {
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");

  const { data } = useQuery({
    queryKey: ["setup-status"],
    queryFn: async () => {
      const res = await fetch("/api/setup/status");
      if (!res.ok) throw new Error("Failed to load setup status");
      return (await res.json()) as { needsSetup: boolean };
    },
  });

  useEffect(() => {
    if (data?.needsSetup) setOpen(true);
  }, [data]);

  const canSubmit = useMemo(
    () => baseUrl.trim().length > 0 && consumerKey && consumerSecret,
    [baseUrl, consumerKey, consumerSecret],
  );

  const init = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), consumerKey, consumerSecret }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || "Initialization failed");
      return body as { success: true; imported: number };
    },
    onSuccess: () => {
      setOpen(false);
    },
  });

  if (!data?.needsSetup) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set up your local database</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We will create a local database and import your WooCommerce orders.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium">WooCommerce Store URL</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="https://yourstore.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Consumer Key</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Consumer Secret</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
            />
          </div>
          {init.isError && (
            <div className="text-sm text-red-600">{(init.error as any)?.message || "Error"}</div>
          )}
          {init.isSuccess && (
            <div className="text-sm text-green-700">
              Imported {init.data.imported} orders successfully.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => init.mutate()} disabled={!canSubmit || init.isPending}>
              {init.isPending ? "Importing…" : "Create & Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
