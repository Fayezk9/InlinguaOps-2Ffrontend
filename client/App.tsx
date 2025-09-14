import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Telc from "./pages/Telc";
import OrdersNew from "./pages/OrdersNew";
import NewOrdersWindow from "./pages/NewOrdersWindow";
import Anmelde from "./pages/Anmelde";
import Teilnahme from "./pages/Teilnahme";
import Teilnehmer from "./pages/Teilnehmer";
import Pruefungen from "./pages/Pruefungen";
import NeedsAttention from "./pages/NeedsAttention";
import AddressPostList from "./pages/AddressPostList";
import { I18nProvider } from "@/lib/i18n";

const queryClient = new QueryClient();

// Global safety handlers: normalize non-Error exceptions and unhandled rejections
if (typeof window !== 'undefined') {
  window.addEventListener('error', (evt) => {
    try {
      // Some errors come without .error or with non-Error payloads; normalize to Error
      const e = (evt as any).error;
      if (!e || typeof e.stack === 'undefined') {
        const msg = (evt as any).message || String(evt);
        const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        // Attach source info if available
        try { (err as any).stack = `${(evt as any).filename || ''}:${(evt as any).lineno || ''}:${(evt as any).colno || ''}`; } catch {}
        console.error('Normalized non-Error window error:', err);
        // Prevent Vite overlay from crashing by stopping default handling of this malformed error
        try { (evt as any).preventDefault && (evt as any).preventDefault(); } catch (_) {}
      }
    } catch (e) {
      // don't let handler throw
      console.error('Error in global error handler', e);
    }
  });
  window.addEventListener('unhandledrejection', (evt) => {
    try {
      const r = (evt as any).reason;
      if (!r || typeof r.stack === 'undefined') {
        const err = new Error(typeof r === 'string' ? r : JSON.stringify(r));
        console.error('Normalized unhandled rejection:', err);
        // Prevent Vite overlay from crashing on malformed rejection
        try { (evt as any).preventDefault && (evt as any).preventDefault(); } catch (_) {}
      }
    } catch (e) {
      console.error('Error in rejection handler', e);
    }
  });
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <I18nProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/telc" element={<Telc />} />
              <Route path="/orders-new" element={<OrdersNew />} />
              <Route path="/orders-new/list" element={<NewOrdersWindow />} />
              <Route path="/anmelde" element={<Anmelde />} />
              <Route path="/teilnahme" element={<Teilnahme />} />
              <Route path="/teilnehmer" element={<Teilnehmer />} />
              <Route path="/pruefungen" element={<Pruefungen />} />
              <Route path="/needs-attention" element={<NeedsAttention />} />
              <Route path="/address-post-list" element={<AddressPostList />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </I18nProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
