import { Button } from "@/components/ui/button";
import { formatDateDDMMYYYY } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SearchOrdersDialog,
  SearchOrdersForm,
} from "@/components/SearchOrdersDialog";

export default function OrdersNew() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const onNewOrders = () => {
    try {
      import("@/lib/history").then(({ logHistory }) =>
        logHistory({ type: "orders_open", message: "Opened New Orders list window" }),
      );
    } catch {}
    const url = "/orders-new/list";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onSearchOrders = () => {
    setShowSearchDialog(true);
  };

  const handleSearch = async (criteria: SearchOrdersForm) => {
    setIsSearching(true);
    setHasSearched(false);

    try {
      // Call the new combined WooCommerce + Google Sheets search endpoint
      const res = await fetch("/api/orders/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchCriteria: criteria }),
      });

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);

        toast({
          title: t("searchResults", "Search Results"),
          description: `Found ${data.results?.length || 0} matching orders.`,
        });
      } else {
        throw new Error("Search failed");
      }

      try {
        import("@/lib/history").then(({ logHistory }) =>
          logHistory({
            type: "orders_search",
            message: `Searched orders with criteria: ${JSON.stringify(criteria)}`,
          }),
        );
      } catch {}
    } catch (error: any) {
      toast({
        title: "Search Failed",
        description: error?.message ?? "Could not search orders",
        variant: "destructive",
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  const handleDialogClose = () => {
    setShowSearchDialog(false);
    // Reset search state when dialog closes
    setSearchResults([]);
    setHasSearched(false);
    setIsSearching(false);
  };

  const onExport = () => {
    const raw = localStorage.getItem("ordersGrouped");
    if (!raw) return;
    const grouped: Record<string, string[]> = JSON.parse(raw);
    const rows = Object.entries(grouped).flatMap(([date, ids]) =>
      ids.map((id) => [date, id]),
    );
    const csv = [
      "date,orderId",
      ...rows.map((r) => r.map((v) => JSON.stringify(v ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    try {
      import("@/lib/history").then(({ logHistory }) =>
        logHistory({ type: "orders_export", message: "Exported orders CSV" }),
      );
    } catch {}
  };

  const onOpenWebsite = () => {
    const envUrl = (import.meta as any).env?.VITE_ORDERS_WEBSITE as
      | string
      | undefined;
    const stored = localStorage.getItem("ordersWebsiteUrl") || undefined;
    const url = stored || envUrl;
    if (!url) return;
    window.open(url, "_blank", "noreferrer");
    try {
      import("@/lib/history").then(({ logHistory }) =>
        logHistory({
          type: "orders_open_website",
          message: `Opened website: ${url}`,
        }),
      );
    } catch {}
  };

  const hasExportData = Boolean(localStorage.getItem("ordersGrouped"));
  const canOpenWebsite = Boolean(
    (import.meta as any).env?.VITE_ORDERS_WEBSITE ||
      localStorage.getItem("ordersWebsiteUrl"),
  );

  // Check for new orders on component mount and set up hourly interval
  useEffect(() => {
    // Initial check
    checkForNewOrders();

    // Set up hourly automatic updates (every 60 minutes)
    const interval = setInterval(
      () => {
        checkForNewOrders();
      },
      60 * 60 * 1000,
    ); // 60 minutes in milliseconds

    // Load last updated timestamp from localStorage
    const storedLastCheck = localStorage.getItem("lastOrdersCheck");
    if (storedLastCheck) {
      setLastUpdated(new Date(storedLastCheck));
    }

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  const checkForNewOrders = async () => {
    if (isChecking) return;
    setIsChecking(true);

    try {
      // Get last check timestamp
      const lastCheck = localStorage.getItem("lastOrdersCheck");
      const lastCheckTime = lastCheck
        ? new Date(lastCheck)
        : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24h ago

      // Fetch recent orders from WooCommerce
      const res = await fetch("/api/orders/recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since: lastCheckTime.toISOString() }),
      });

      if (res.ok) {
        const data = await res.json();
        const newCount = data.count || 0;
        setNewOrdersCount(newCount);

        // Update last check timestamp
        const now = new Date();
        localStorage.setItem("lastOrdersCheck", now.toISOString());
        setLastUpdated(now);

        if (newCount > 0) {
          toast({
            title: t("newOrdersFound", "New Orders Found"),
            description: `Found ${newCount} new orders since last check.`,
          });
        }

        try {
          import("@/lib/history").then(({ logHistory }) =>
            logHistory({
              type: "orders_check",
              message: `Checked for new orders: ${newCount} found`,
            }),
          );
        } catch {}
      }
    } catch (error: any) {
      console.warn("Failed to check for new orders:", error);
      // Don't show error toast on auto-check, only manual refresh
    }

    setIsChecking(false);
  };

  const manualRefresh = async () => {
    try {
      await checkForNewOrders();
      toast({
        title: t("ordersRefreshed", "Refreshed"),
        description: "Checked for new orders.",
      });
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error?.message ?? "Could not check for new orders",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader className="flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <CardTitle>{t("orders", "Orders")}</CardTitle>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={manualRefresh}
                    disabled={isChecking}
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t("refreshOrders", "Refresh Orders")}
                </TooltipContent>
              </Tooltip>
              <div className="text-xs text-muted-foreground">
                <div>{t("lastUpdated", "Last Updated")}:</div>
                <div>
                  {lastUpdated ? formatDateDDMMYYYY(lastUpdated) : t("never", "Never")}
                </div>
              </div>
            </div>
          </div>
          <ul className="w-full max-w-xs mx-auto space-y-2">
            <li className="relative">
              <Button
                className="w-full"
                variant="secondary"
                onClick={onNewOrders}
              >
                {t("newOrders", "New Orders")}
              </Button>
              {newOrdersCount > 0 && (
                <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                  {newOrdersCount > 99 ? "99+" : newOrdersCount}
                </span>
              )}
            </li>
            <li>
              <Button
                className="w-full"
                variant="secondary"
                onClick={onSearchOrders}
              >
                {t("searchOrders", "Search Orders")}
              </Button>
            </li>
            <li>
              <Button
                className="w-full"
                variant="secondary"
                onClick={onExport}
                disabled={!hasExportData}
              >
                {t("export", "Export")}
              </Button>
            </li>
            <li>
              <Button
                className="w-full"
                variant="secondary"
                onClick={onOpenWebsite}
                disabled={!canOpenWebsite}
              >
                {t("openWebsite", "Open Website")}
              </Button>
            </li>
          </ul>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Placeholder for new orders UI.
          </p>
        </CardContent>
      </Card>

      <SearchOrdersDialog
        open={showSearchDialog}
        onOpenChange={handleDialogClose}
        onSearch={handleSearch}
        searchResults={searchResults}
        isLoading={isSearching}
        hasSearched={hasSearched}
      />
    </div>
  );
}
