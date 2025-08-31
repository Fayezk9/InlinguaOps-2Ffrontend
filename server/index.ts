import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { fetchOrdersHandler } from "./routes/orders";
import { sheetsStatus, sheetsConfig, sheetsPreview, sheetsTabs, sheetsValues, sheetsAppend } from "./routes/sheets";

// Import the new Java action handlers
import { 
  executeRegistrationPdfAction, 
  executeParticipationPdfAction, 
  executePostAddressListAction,
  getJavaBackendStatus 
} from "./routes/java-actions";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Health & demo
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // WooCommerce Orders
  app.post("/api/orders/fetch", fetchOrdersHandler);

  // Google Sheets private access
  app.get("/api/sheets/status", sheetsStatus);
  app.post("/api/sheets/config", sheetsConfig);
  app.get("/api/sheets/preview", sheetsPreview);
  app.get("/api/sheets/tabs", sheetsTabs);
  app.get("/api/sheets/values", sheetsValues);
  app.post("/api/sheets/append", sheetsAppend);

  // === JAVA BACKEND ACTION ROUTES ===
  
  // Check if Java backend is available and configured
  app.get("/api/java-actions/status", getJavaBackendStatus);
  
  // Action 1: Generate Registration Confirmation PDF (Anmeldebestätigung)
  app.post("/api/java-actions/make-registration-pdf", executeRegistrationPdfAction);
  
  // Action 2: Generate Participation Certificate PDF (Teilnahmebestätigung) 
  app.post("/api/java-actions/make-participation-pdf", executeParticipationPdfAction);
  
  // Action 3: Generate and Export Address/Orders List
  app.post("/api/java-actions/make-post-address-list", executePostAddressListAction);

  return app;
}
