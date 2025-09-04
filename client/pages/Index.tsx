import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { FetchOrdersResponse, OrderFetchResult } from "@shared/api";
import { FeatureLink } from "./components";
import {
  Home,
  PlusCircle,
  CheckCircle2,
  BadgeCheck,
  FileText,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const parseOrderNumbers = (text: string): string[] => {
  const ids = Array.from(text.matchAll(/[0-9]{2,}/g)).map((m) => m[0]);
  return Array.from(new Set(ids));
};

const requestSchema = z.object({
  orderIds: z.array(z.union([z.string(), z.number()])).min(1),
});

export default function Index() {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [orders, setOrders] = useState<OrderFetchResult[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const ids = useMemo(() => parseOrderNumbers(input), [input]);

  const mutation = useMutation({
    mutationFn: async (ids: (string | number)[]) => {
      const body = requestSchema.parse({ orderIds: ids });
      const res = await fetch("/api/orders/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `Request failed (${res.status})`);
      }
      return (await res.json()) as FetchOrdersResponse;
    },
    onSuccess: (data) => {
      setOrders(data.results);
      toast({
        title: "Fetch complete",
        description: `${data.okCount} succeeded, ${data.errorCount} failed.`,
      });
    },
    onError: (e: any) =>
      toast({
        title: "Failed to fetch orders",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      }),
  });

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const text = await file.text();
    setInput((prev) => prev + (prev ? "\n" : "") + text);
  };

  const onFilePick = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    setInput((prev) => prev + (prev ? "\n" : "") + text);
  };

  const exportCsv = () => {
    if (!orders) return;
    const headers = [
      "id",
      "number",
      "status",
      "total",
      "currency",
      "customerName",
      "email",
      "phone",
      "createdAt",
      "paymentMethod",
      "link",
    ];
    const rows = orders
      .map((r) => (r.ok ? r.order : null))
      .filter(Boolean)
      .map((o) =>
        headers.map((h) => JSON.stringify((o as any)[h] ?? "")),
      ) as string[][];
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-10">
        <div className="relative">
          <div className="rounded-xl border border-border bg-card shadow-2xl text-card-foreground dark:bg-black dark:text-white dark:border-neutral-800 shadow-orange-100/50 dark:shadow-orange-900/30 backdrop-blur-sm overflow-hidden" style={{ backgroundImage: 'url("https://cdn.builder.io/api/v1/image/assets%2Fd5ceaaf188a440b69293546711d11d26%2F78c31fddfd514fa987cf6810b3105651?format=webp&width=3000")', backgroundSize: 'cover', backgroundPosition: 'left center', backgroundRepeat: 'no-repeat' }}>
            <div className="grid gap-6 md:grid-cols-[300px_1fr] p-4 md:p-6">
              <aside
                className="relative overflow-hidden"
              >
                <nav className="p-2 pt-28 pl-10 pr-3 mr-0 relative flex flex-col gap-3">
                  <SidebarItem
                    to="/telc"
                    label={t("telcArea", "Telc Area")}
                    icon="home"
                  />
                  <SidebarItem
                    to="/orders-new"
                    label={t("orders", "Orders")}
                    icon="plus"
                  />
                  <SidebarItem
                    to="/teilnehmer"
                    label={t("manageParticipants", "Manage Participants")}
                    icon="check"
                  />
                  <SidebarItem
                    to="/pruefungen"
                    label={t("exams", "Exams")}
                    icon="file"
                  />
                </nav>
              </aside>
              <main>
                <div className="relative overflow-hidden aspect-[16/9] bg-transparent">
                                  </div>
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({
  to,
  label,
  icon,
  active,
}: {
  to: string;
  label: string;
  icon: "home" | "plus" | "check" | "badge" | "file";
  active?: boolean;
}) {
  const Icon =
    icon === "home"
      ? Home
      : icon === "plus"
        ? PlusCircle
        : icon === "check"
          ? CheckCircle2
          : icon === "badge"
            ? BadgeCheck
            : FileText;
  return (
    <Link
      to={to}
      className={cn(
        "w-full flex items-center gap-3 rounded-md px-3 py-2 transition-colors backdrop-blur-sm",
        active
          ? "bg-white/90 text-black font-bold shadow-sm dark:bg-white/10 dark:text-white"
          : "bg-white/70 hover:bg-white/80 text-black font-semibold dark:bg-black/50 dark:hover:bg-black/60 dark:text-white"
      )}
    >
      <Icon className="h-4 w-4 text-current" />
      <span className="text-sm">{label}</span>
    </Link>
  );
}

function ResultsTable({
  results,
  onExport,
}: {
  results: OrderFetchResult[];
  onExport: () => void;
}) {
  const ok = results.filter((r) => r.ok) as Extract<
    OrderFetchResult,
    { ok: true }
  >[];
  const failed = results.filter((r) => !r.ok) as Extract<
      OrderFetchResult,
      { ok: false }
    >[],
    total = results.length;
  return (
    <Card className="border border-border bg-card text-card-foreground">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {ok.length} succeeded, {failed.length} failed, {total} total
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onExport}
            disabled={ok.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b">
              <th className="py-2 pr-3">ID</th>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Total</th>
              <th className="py-2 pr-3">Created</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ok.map(({ order }) => (
              <tr key={order.id} className="border-b last:border-b-0">
                <td className="py-2 pr-3 font-mono">{order.number}</td>
                <td className="py-2 pr-3">
                  {order.customerName || (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <Badge className="uppercase">{order.status}</Badge>
                </td>
                <td className="py-2 pr-3">
                  {order.total} {order.currency}
                </td>
                <td className="py-2 pr-3">
                  {new Date(order.createdAt).toLocaleString()}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex gap-2">
                    <a href={order.link} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        Open in Woo
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        navigator.clipboard.writeText(order.number.toString())
                      }
                    >
                      Copy ID
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {failed.map((r) => (
              <tr
                key={`err-${r.id}`}
                className="border-b last:border-b-0 bg-destructive/5"
              >
                <td className="py-2 pr-3 font-mono">{r.id}</td>
                <td className="py-2 pr-3" colSpan={3}>
                  <span className="text-destructive">Failed</span> — {r.error}
                </td>
                <td className="py-2 pr-3" colSpan={2}>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigator.clipboard.writeText(r.id.toString())
                      }
                    >
                      Copy ID
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
