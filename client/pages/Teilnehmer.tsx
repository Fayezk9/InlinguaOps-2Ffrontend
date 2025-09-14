import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";

type Section = "none" | "anmelde" | "teilnahme" | "address";

const parseOrderNumbers = (text: string): string[] => {
  const ids = Array.from(text.matchAll(/[0-9]{2,}/g)).map((m) => m[0]);
  return Array.from(new Set(ids));
};

export default function Teilnehmer() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState<Section>("none");
  const [input, setInput] = useState("");
  const ids = useMemo(() => parseOrderNumbers(input), [input]);
  const [loading, setLoading] = useState(false);

  async function callApi(path: string) {
    if (ids.length === 0) {
      toast({
        title: "No order numbers",
        description: "Enter one or more order numbers first.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumbers: ids }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          j?.error || j?.message || `Request failed (${res.status})`,
        );
      toast({
        title: "Done",
        description: j?.message || "Operation completed",
      });
      try {
        import("@/lib/history").then(({ logHistory }) => {
          const user = localStorage.getItem("currentUserName") || "User";
          logHistory({
            type: "participants_action",
            message: `${user} ran ${path} for ${ids.length} orders`,
          });
        });
      } catch {}
    } catch (e: any) {
      toast({
        title: "Failed",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
    setLoading(false);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>
            {t("manageParticipants", "Manage Participants")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="w-full max-w-xs mx-auto space-y-2">
            <li>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() =>
                  setOpen((v) => (v === "anmelde" ? "none" : "anmelde"))
                }
              >
                {t("registrationConfirmation", "Registration Confirmation")}
              </Button>
            </li>
            <li>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() =>
                  setOpen((v) => (v === "teilnahme" ? "none" : "teilnahme"))
                }
              >
                {t("participationConfirmation", "Participation Confirmation")}
              </Button>
            </li>
            <li>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() =>
                  setOpen((v) => (v === "address" ? "none" : "address"))
                }
              >
                {t("addressPostList", "Address Post List")}
              </Button>
            </li>
          </ul>

          {open !== "none" && (
            <div className="mt-4 rounded-md border border-border p-3">
              {open === "anmelde" && (
                <div className="flex flex-col md:flex-row gap-3 items-stretch">
                  <Textarea
                    placeholder={
                      t("orderNumber", "Order Number") +
                      "… (one per line or mixed text)"
                    }
                    className="min-h-[220px] flex-1"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <div className="flex md:flex-col gap-2 md:w-60">
                    <div className="text-xs text-muted-foreground md:order-last">
                      Parsed: {ids.length}
                    </div>
                    <Button
                      disabled={loading}
                      onClick={() =>
                        callApi("/api/java-actions/make-registration-pdf")
                      }
                    >
                      {t(
                        "makeRegistrationConfirmation",
                        "Make Registration Confirmation",
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={async () => {
                        if (ids.length === 0) {
                          toast({ title: "No order numbers", description: "Enter one or more order numbers first.", variant: "destructive" });
                          return;
                        }
                        setLoading(true);
                        try {
                          const res = await fetch('/api/docs/generate-registration', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderNumbers: ids })
                          });
                          if (!res.ok) {
                            const j = await res.json().catch(() => ({}));
                            const detail = Array.isArray(j?.details) && j.details.length > 0 ? j.details[0] : null;
                            const tagInfo = detail?.xtag ? ` Tag: ${detail.xtag}.` : '';
                            const expl = detail?.explanation ? ` ${detail.explanation}` : '';
                            throw new Error((j?.message || `Request failed (${res.status})`) + tagInfo + expl);
                          }
                          const blob = await res.blob();
                          const a = document.createElement('a');
                          const url = URL.createObjectURL(blob);
                          a.href = url;
                          a.download = `registration-${ids[0]}.docx`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                          toast({ title: 'Done', description: `DOCX generated for ${ids[0]}` });
                        } catch (e: any) {
                          toast({ title: 'Failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
                        }
                        setLoading(false);
                      }}
                    >
                      Generate DOCX
                    </Button>
                  </div>
                </div>
              )}
              {open === "teilnahme" && (
                <div className="flex flex-col md:flex-row gap-3 items-stretch">
                  <Textarea
                    placeholder={
                      t("orderNumber", "Order Number") +
                      "… (one per line or mixed text)"
                    }
                    className="min-h-[220px] flex-1"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <div className="flex md:flex-col gap-2 md:w-60">
                    <div className="text-xs text-muted-foreground md:order-last">
                      Parsed: {ids.length}
                    </div>
                    <Button
                      disabled={loading}
                      onClick={() =>
                        callApi("/api/java-actions/make-participation-pdf")
                      }
                    >
                      {t(
                        "makeParticipationConfirmation",
                        "Make Participation Confirmation",
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {open === "address" && (
                <div className="flex flex-col md:flex-row gap-3 items-stretch">
                  <Textarea
                    placeholder={
                      t("orderNumber", "Order Number") +
                      "… (one per line or mixed text)"
                    }
                    className="min-h-[220px] flex-1"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <div className="flex md:flex-col gap-2 md:w-60">
                    <div className="text-xs text-muted-foreground md:order-last">
                      Parsed: {ids.length}
                    </div>
                    <Button
                      disabled={loading}
                      onClick={async () => {
                        if (ids.length === 0) {
                          toast({
                            title: "No order numbers",
                            description:
                              "Enter one or more order numbers first.",
                            variant: "destructive",
                          });
                          return;
                        }
                        setLoading(true);
                        try {
                          const res = await fetch("/api/orders/fetch", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ orderIds: ids }),
                          });
                          const data = await res.json();
                          if (!res.ok)
                            throw new Error(
                              data?.message || `Request failed (${res.status})`,
                            );
                          const toNum = (s: any) => {
                            const n = Number(String(s || "").replace(",", "."));
                            return Math.round((isNaN(n) ? NaN : n) * 100) / 100;
                          };
                          const allowed = new Set([178.1, 197.0, 187.0, 169.1]);
                          const filtered = (data.results || [])
                            .filter((r: any) => r.ok)
                            .filter((r: any) =>
                              allowed.has(toNum(r.order?.total)),
                            )
                            .map((r: any) => String(r.order?.number || r.id));
                          if (filtered.length === 0) {
                            toast({
                              title: "No matches",
                              description:
                                "No orders match the required prices.",
                              variant: "destructive",
                            });
                            setLoading(false);
                            return;
                          }
                          const jres = await fetch(
                            "/api/java-actions/make-post-address-list",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ orderNumbers: filtered }),
                            },
                          );
                          const j = await jres.json().catch(() => ({}));
                          if (!jres.ok)
                            throw new Error(
                              j?.error ||
                                j?.message ||
                                `Request failed (${jres.status})`,
                            );
                          toast({
                            title: "Done",
                            description:
                              j?.message ||
                              `Generated list for ${filtered.length} orders`,
                          });
                        } catch (e: any) {
                          toast({
                            title: "Failed",
                            description: e?.message ?? "Unknown error",
                            variant: "destructive",
                          });
                        }
                        setLoading(false);
                      }}
                    >
                      {t("makeAddressPostList", "Make Address Post List")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
