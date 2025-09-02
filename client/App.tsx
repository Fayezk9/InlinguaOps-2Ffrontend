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
import Anmelde from "./pages/Anmelde";
import Teilnahme from "./pages/Teilnahme";
import Teilnehmer from "./pages/Teilnehmer";
import Pruefungen from "./pages/Pruefungen";
import NeedsAttention from "./pages/NeedsAttention";
import AddressPostList from "./pages/AddressPostList";
import { I18nProvider } from "@/lib/i18n";

const queryClient = new QueryClient();

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
