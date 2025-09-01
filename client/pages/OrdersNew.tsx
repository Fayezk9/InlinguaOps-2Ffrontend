import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

export default function OrdersNew() {
  const { t } = useI18n();
  const { toast } = useToast();

  const onNewOrders = () => {
    try { import("@/lib/history").then(({ logHistory }) => logHistory({ type: "orders_open", message: "Opened New Orders" })); } catch {}
    toast({ title: "New Orders", description: "Ready to create or fetch new orders." });
  };

  const onSearchOrders = async () => {
    const q = prompt("Search orders by ID or keyword:")?.trim();
    if (!q) return;
    try { import("@/lib/history").then(({ logHistory }) => logHistory({ type: "orders_search", message: `Searched orders: ${q}` })); } catch {}
  };

  const onExport = () => {
    const raw = localStorage.getItem("ordersGrouped");
    if (!raw) return;
    const grouped: Record<string, string[]> = JSON.parse(raw);
    const rows = Object.entries(grouped).flatMap(([date, ids]) => ids.map((id) => [date, id]));
    const csv = ["date,orderId", ...rows.map((r) => r.map((v) => JSON.stringify(v ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orders-${new Date().toISOString()}.csv`; a.click();
    URL.revokeObjectURL(url);
    try { import("@/lib/history").then(({ logHistory }) => logHistory({ type: "orders_export", message: "Exported orders CSV" })); } catch {}
  };

  const onOpenWebsite = () => {
    const envUrl = (import.meta as any).env?.VITE_ORDERS_WEBSITE as string | undefined;
    const stored = localStorage.getItem("ordersWebsiteUrl") || undefined;
    const url = stored || envUrl;
    if (!url) return;
    window.open(url, "_blank", "noreferrer");
    try { import("@/lib/history").then(({ logHistory }) => logHistory({ type: "orders_open_website", message: `Opened website: ${url}` })); } catch {}
  };

  const hasExportData = Boolean(localStorage.getItem("ordersGrouped"));
  const canOpenWebsite = Boolean((import.meta as any).env?.VITE_ORDERS_WEBSITE || localStorage.getItem("ordersWebsiteUrl"));

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader className="flex-col items-start gap-3">
          <CardTitle>{t('orders','Orders')}</CardTitle>
          <ul className="w-full space-y-2">
            <li><Button className="w-full sm:w-auto" onClick={onNewOrders}>{t('newOrders','New Orders')}</Button></li>
            <li><Button className="w-full sm:w-auto" variant="secondary" onClick={onSearchOrders}>{t('searchOrders','Search Orders')}</Button></li>
            <li><Button className="w-full sm:w-auto" variant="outline" onClick={onExport} disabled={!hasExportData}>{t('export','Export')}</Button></li>
            <li><Button className="w-full sm:w-auto" variant="outline" onClick={onOpenWebsite} disabled={!canOpenWebsite}>{t('openWebsite','Open Website')}</Button></li>
          </ul>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Placeholder for new orders UI.</p>
        </CardContent>
      </Card>
    </div>
  );
}
