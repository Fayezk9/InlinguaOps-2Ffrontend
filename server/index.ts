import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { fetchOrdersHandler } from "./routes/orders";
import { sheetsStatus, sheetsConfig, sheetsPreview, sheetsTabs, sheetsValues } from "./routes/sheets";

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
  app.get("/api/sheets/values", require("./routes/sheets").sheetsValues);

  return app;
}
