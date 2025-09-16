import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  fetchOrdersHandler,
  fetchRecentOrdersHandler,
  searchOrdersHandler,
  fetchRecentOrdersDetailedHandler,
  fetchOldOrdersDetailedHandler,
} from "./routes/orders";
import {
  sheetsStatus,
  sheetsConfig,
  sheetsPreview,
  sheetsTabs,
  sheetsValues,
  sheetsAppend,
  sheetsFormatRow,
} from "./routes/sheets";
import {
  executeRegistrationPdfAction,
  executeParticipationPdfAction,
  executePostAddressListAction,
  getJavaBackendStatus,
} from "./routes/java-actions";
import {
  sendRegistrationConfirmationHandler,
  sendParticipationConfirmationHandler,
  testEmailConnectionHandler,
} from "./routes/emails";
import {
  saveWooConfigHandler,
  getWooConfigHandler,
  testWooConfigHandler,
} from "./routes/woocommerce-config";
import { getSetupStatus, initializeSetup } from "./routes/setup";
import {
  addExamsHandler,
  listExamsHandler,
  removeExamsHandler,
  getCertConfig,
  setCertConfig,
  syncExamsFromWoo,
  debugWooProducts,
  debugWooProduct,
} from "./routes/exams";

import { initDB } from "./db/sqlite";
import {
  uploadRegistrationPdfTemplate,
  getRegistrationPdfTemplateStatus,
  validateRegistrationPdfTemplate,
  generateRegistrationPdf,
} from "./routes/pdf-templates";

export function createServer() {
  // Kick off DB initialization (async)
  initDB().catch((e) => console.error("DB init failed", e));

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));
  const largeJson = express.json({ limit: "100mb" });

  // Health & demo
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // WooCommerce Orders
  app.post("/api/orders/fetch", fetchOrdersHandler);
  app.post("/api/orders/recent", fetchRecentOrdersHandler);
  app.post("/api/orders/search", searchOrdersHandler);
  app.post("/api/orders/recent-detailed", fetchRecentOrdersDetailedHandler);
  app.post("/api/orders/old-detailed", fetchOldOrdersDetailedHandler);
  app.post("/api/orders/by-exam", (req, res) =>
    import("./routes/orders-by-exam").then((m) =>
      m.filterOrdersByExamHandler(req as any, res as any),
    ),
  );
  app.get("/api/orders/by-exam/ids", (_req, res) =>
    import("./routes/orders-by-exam").then((m) =>
      m.listOrderIdsHandler(_req as any, res as any),
    ),
  );
  app.post("/api/orders/by-exam/check", (req, res) =>
    import("./routes/orders-by-exam").then((m) =>
      m.checkOrderMatchHandler(req as any, res as any),
    ),
  );

  // Email Services
  app.post(
    "/api/emails/send-registration-confirmation",
    sendRegistrationConfirmationHandler,
  );
  app.post(
    "/api/emails/send-participation-confirmation",
    sendParticipationConfirmationHandler,
  );
  app.get("/api/emails/test-connection", testEmailConnectionHandler);

  // WooCommerce Configuration
  app.post("/api/woocommerce/config", saveWooConfigHandler);
  app.get("/api/woocommerce/config", getWooConfigHandler);
  app.get("/api/woocommerce/test-connection", testWooConfigHandler);

  // Initial Setup
  app.get("/api/setup/status", getSetupStatus);
  app.post("/api/setup/initialize", initializeSetup);

  // Google Sheets private access
  app.get("/api/sheets/status", sheetsStatus);
  app.post("/api/sheets/config", sheetsConfig);
  app.get("/api/sheets/preview", sheetsPreview);
  app.get("/api/sheets/tabs", sheetsTabs);
  app.get("/api/sheets/values", sheetsValues);
  app.post("/api/sheets/append", sheetsAppend);
  app.post("/api/sheets/format-row", sheetsFormatRow);

  // Java actions (PDF generation and exports)
  app.get("/api/java-actions/status", getJavaBackendStatus);
  app.post(
    "/api/java-actions/make-registration-pdf",
    executeRegistrationPdfAction,
  );
  app.post(
    "/api/java-actions/make-participation-pdf",
    executeParticipationPdfAction,
  );
  app.post(
    "/api/java-actions/make-post-address-list",
    executePostAddressListAction,
  );

  // PDF templates
  app.post(
    "/api/docs/upload-registration-pdf-template",
    largeJson,
    uploadRegistrationPdfTemplate,
  );
  app.get(
    "/api/docs/registration-pdf-template/status",
    getRegistrationPdfTemplateStatus,
  );
  app.get(
    "/api/docs/registration-pdf-template/validate",
    validateRegistrationPdfTemplate,
  );
  app.post("/api/docs/generate-registration-pdf", generateRegistrationPdf);

  // DB-managed templates
  app.post("/api/docs/templates/upload", largeJson, (req, res) =>
    import("./routes/pdf-templates").then((m) =>
      m.uploadPdfTemplateToDb(req as any, res as any),
    ),
  );
  app.get("/api/docs/templates/status", (req, res) =>
    import("./routes/pdf-templates").then((m) =>
      m.getPdfTemplateStatus(req as any, res as any),
    ),
  );
  app.get("/api/docs/templates/validate", (req, res) =>
    import("./routes/pdf-templates").then((m) =>
      m.validatePdfTemplateFromDb(req as any, res as any),
    ),
  );

  // Order info for preview
  app.post("/api/docs/registration-data", largeJson, (req, res) =>
    import("./routes/order-info").then((m) =>
      m.getRegistrationOrderInfo(req as any, res as any),
    ),
  );

  // Exams
  app.get("/api/exams", listExamsHandler);
  app.post("/api/exams/add", addExamsHandler);
  app.post("/api/exams/remove", removeExamsHandler);
  app.get("/api/exams/config", getCertConfig);
  app.post("/api/exams/config", setCertConfig);
  app.post("/api/exams/sync-from-woo", syncExamsFromWoo);
  app.get("/api/exams/debug-woo-products", debugWooProducts);
  app.get("/api/exams/debug-woo-product", debugWooProduct);

  // School settings
  app.get("/api/school/address", (req, res) =>
    import("./routes/school").then((m) => m.getSchoolAddress(req as any, res as any)),
  );
  app.post("/api/school/address", (req, res) =>
    import("./routes/school").then((m) => m.saveSchoolAddress(req as any, res as any)),
  );
  app.get("/api/school/logo", (req, res) =>
    import("./routes/school").then((m) => m.getSchoolLogo(req as any, res as any)),
  );
  app.post("/api/school/logo", (req, res) =>
    import("./routes/school").then((m) => m.saveSchoolLogo(req as any, res as any)),
  );

  // Fallback error handler that always returns JSON (prevents HTML error pages that break Vite overlay)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    try {
      console.error(
        "Unhandled server error:",
        err && err.stack ? err.stack : err,
      );
    } catch (e) {
      console.error("Error while logging error", e);
    }
    if (res.headersSent) return;
    const status =
      err && err.status && Number.isFinite(err.status) ? err.status : 500;
    const message =
      err && err.message ? err.message : String(err || "Internal Server Error");
    res.status(status).json({ message });
  });

  return app;
}
