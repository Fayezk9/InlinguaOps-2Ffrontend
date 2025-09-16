import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

type Section =
  | "none"
  | "sheets"
  | "sprache"
  | "emails"
  | "background"
  | "orders"
  | "database"
  | "templates"
  | "school";

function DatabaseSetupPanel() {
  const [baseUrl, setBaseUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Try to load existing config to prefill
    fetch("/api/woocommerce/config")
      .then(async (r) => {
        if (!r.ok) return null;
        const j = await r.json();
        return j?.config as {
          baseUrl: string;
          consumerKey: string;
          consumerSecret: string;
        };
      })
      .then((cfg) => {
        if (cfg) {
          setBaseUrl(cfg.baseUrl);
          setConsumerKey(cfg.consumerKey);
          setConsumerSecret(cfg.consumerSecret);
        }
      })
      .catch(() => {});
  }, []);

  const onSubmit = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/setup/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          consumerKey,
          consumerSecret,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || "Initialization failed");
      setStatus(
        `Imported ${body.imported} orders successfully.` +
          (body.importedExams ? ` Imported ${body.importedExams} exams.` : ""),
      );
      try {
        const raw = localStorage.getItem("notifications") || "[]";
        const list = JSON.parse(raw);
        const updated = Array.isArray(list)
          ? list.map((n: any) =>
              n.id === "setup-db" ? { ...n, read: true } : n,
            )
          : list;
        localStorage.setItem("notifications", JSON.stringify(updated));
      } catch {}
    } catch (e: any) {
      setStatus(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const onReconnect = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const save = await fetch("/api/woocommerce/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          consumerKey,
          consumerSecret,
        }),
      });
      const sj = await save.json().catch(() => ({}));
      if (!save.ok)
        throw new Error(
          sj?.message || `Failed to save config (${save.status})`,
        );
      const test = await fetch("/api/woocommerce/test-connection");
      const tj = await test.json().catch(() => ({}));
      if (!test.ok)
        throw new Error(tj?.message || `Test failed (${test.status})`);
      setStatus("Reconnected and test succeeded.");
    } catch (e: any) {
      setStatus(e?.message || "Reconnect failed");
    } finally {
      setLoading(false);
    }
  };

  const onTest = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const r = await fetch("/api/woocommerce/test-connection");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || `Test failed (${r.status})`);
      setStatus("Test succeeded.");
    } catch (e: any) {
      setStatus(e?.message || "Test failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-3">
      <div>
        <label className="text-sm font-medium mb-2 block">
          WooCommerce Store URL
        </label>
        <Input
          placeholder="https://yourstore.com"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Consumer Key</label>
        <Input
          value={consumerKey}
          onChange={(e) => setConsumerKey(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">
          Consumer Secret
        </label>
        <Input
          value={consumerSecret}
          onChange={(e) => setConsumerSecret(e.target.value)}
        />
      </div>
      {status && <div className="text-sm">{status}</div>}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={onSubmit}
          disabled={loading || !baseUrl || !consumerKey || !consumerSecret}
        >
          {loading ? "Importing…" : "Create & Import"}
        </Button>
        <Button
          variant="outline"
          onClick={onReconnect}
          disabled={loading || !baseUrl || !consumerKey || !consumerSecret}
        >
          Reconnect
        </Button>
        <Button variant="secondary" onClick={onTest} disabled={loading}>
          Test Connection
        </Button>
      </div>
    </div>
  );
}

function TemplateUploader({
  title,
  type,
}: {
  title: string;
  type: "registration" | "participation";
}) {
  const { toast } = useToast();
  const [exists, setExists] = useState<boolean | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const st = await fetch(`/api/docs/templates/status?type=${type}`);
      const sj = await st.json().catch(() => ({}));
      setExists(!!sj?.exists);
      setSize(sj?.size || null);
      if (sj?.exists) {
        const vr = await fetch(`/api/docs/templates/validate?type=${type}`);
        const vj = await vr.json().catch(() => ({}));
        setValid(!!vj?.ok);
      } else {
        setValid(null);
      }
    } catch {
      setExists(null);
      setValid(null);
      setSize(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUpload = async (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast({
        title: "Invalid file",
        description: "Please select a .pdf file",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(f);
      });
      const up = await fetch("/api/docs/templates/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, contentBase64: dataUrl }),
      });
      if (!up.ok) {
        const j = await up.json().catch(() => ({}));
        throw new Error(j?.message || `Upload failed (${up.status})`);
      }
      toast({ title: "Template saved", description: `${title} uploaded` });
      await refresh();
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err?.message ?? "Upload error",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">
            {exists === null ? "—" : exists ? "Uploaded" : "Not uploaded"}
            {size ? ` • ${Math.round(size / 1024)} KB` : ""}
            {valid != null ? ` • ${valid ? "Valid" : "Needs fields"}` : ""}
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border cursor-pointer hover:bg-accent">
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await onUpload(f);
              e.currentTarget.value = "";
            }}
          />
          Upload PDF
        </label>
      </div>
    </div>
  );
}

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const [current, setCurrent] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("none");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if ((location as any)?.state?.openSection === "database") {
      setSection("database");
    }
  }, [location]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCurrent(localStorage.getItem("telcSheetUrl"));
  }, []);

  useEffect(() => {
    if (section === "none") return;
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSection("none");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [section]);

  const [showForm, setShowForm] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [saEmail, setSaEmail] = useState("");
  const [saKey, setSaKey] = useState("");
  const [showEmailTemplateDialog, setShowEmailTemplateDialog] = useState(false);
  const [emailTemplateSubject, setEmailTemplateSubject] = useState(
    "Anmeldebestätigung Bestellnummer ",
  );
  const [emailTemplateBody, setEmailTemplateBody] = useState("");
  type SavedSheet = { url: string; saEmail?: string };
  const [savedList, setSavedList] = useState<SavedSheet[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("telcSheets");
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        const normalized: SavedSheet[] = arr
          .map((it: any) =>
            typeof it === "string"
              ? { url: it }
              : { url: String(it.url || ""), saEmail: it.saEmail || undefined },
          )
          .filter((it: SavedSheet) => it.url);
        setSavedList(normalized);
      }
      const storedEmail = localStorage.getItem("telcSaEmail");
      if (storedEmail && !saEmail) setSaEmail(storedEmail);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistSaved = (list: SavedSheet[]) => {
    setSavedList(list);
    localStorage.setItem("telcSheets", JSON.stringify(list));
  };

  const setOrChange = () => {
    if (section !== "sheets") setSection("sheets");
    setSheetUrl(current ?? "");
    setShowForm(true);
  };

  const openInApp = () => {
    if (!current) return setOrChange();
    navigate("/telc");
  };

  const openExternal = () => {
    if (!current) return setOrChange();
    if (typeof window !== "undefined")
      window.open(current, "_blank", "noopener,noreferrer");
  };

  const parseSheetId = (input: string) => {
    try {
      const u = new URL(input);
      const p = u.pathname.split("/");
      const dIdx = p.indexOf("d");
      return dIdx >= 0 ? p[dIdx + 1] : input;
    } catch {
      return input;
    }
  };

  const saveInline = async () => {
    const url = sheetUrl.trim();
    if (url) {
      localStorage.setItem("telcSheetUrl", url);
      setCurrent(url);
      const next = [...savedList];
      const idx = next.findIndex((s) => s.url === url);
      if (idx >= 0)
        next[idx] = { url, saEmail: saEmail.trim() || next[idx].saEmail };
      else next.push({ url, saEmail: saEmail.trim() || undefined });
      persistSaved(next);
    }
    if (saEmail) localStorage.setItem("telcSaEmail", saEmail.trim());
    if (saEmail && saKey) {
      await fetch("/api/sheets/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_email: saEmail.trim(),
          private_key: saKey,
        }),
      }).catch(() => {});
    }
    setShowForm(false);
    setSaKey("");
  };

  const clear = () => {
    localStorage.removeItem("telcSheetUrl");
    setCurrent(null);
  };

  const handleSaveEmailTemplate = () => {
    // Save email template to localStorage or backend
    localStorage.setItem(
      "emailTemplate_registrationConfirmation_subject",
      emailTemplateSubject,
    );
    localStorage.setItem(
      "emailTemplate_registrationConfirmation_body",
      emailTemplateBody,
    );

    toast({
      title: t("save", "Save"),
      description: "Email template saved successfully",
    });

    setShowEmailTemplateDialog(false);
  };

  const handleOpenEmailTemplateDialog = () => {
    // Load existing template from storage
    const savedSubject = localStorage.getItem(
      "emailTemplate_registrationConfirmation_subject",
    );
    const savedBody = localStorage.getItem(
      "emailTemplate_registrationConfirmation_body",
    );

    if (savedSubject) setEmailTemplateSubject(savedSubject);
    if (savedBody) setEmailTemplateBody(savedBody);

    setShowEmailTemplateDialog(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <Card className="border border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>{t("settings", "Settings")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center">
            <nav className="w-full max-w-sm p-2 space-y-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setSection("sprache")}
              >
                {t("language", "Language")}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setSection("sheets")}
              >
                {t("googleSheets", "Google Sheets")}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setSection("database")}
              >
                Database
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setSection("emails")}
              >
                {t("emails", "Emails")}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setSection("background")}
              >
                {t("backgroundPhoto", "Background Photo")}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setSection("templates")}
              >
                Templates
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setSection("school")}
              >
                School
              </Button>
            </nav>
          </div>
        </CardContent>
      </Card>

      {section !== "none" && (
        <div ref={panelRef}>
          <Card className="mt-4 border border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle>
                {section === "sheets"
                  ? t("googleSheets", "Google Sheets")
                  : section === "sprache"
                    ? t("language", "Language")
                    : section === "emails"
                      ? t("emails", "Emails")
                      : section === "orders"
                        ? t("orders", "Orders")
                        : section === "database"
                          ? "Database"
                          : section === "templates"
                            ? "Templates"
                            : t("backgroundPhoto", "Background Photo")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {section === "sheets" ? (
                <div className="w-full max-w-3xl mx-auto space-y-3">
                  <ul className="w-full max-w-xs mx-auto space-y-2">
                    <li>
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={setOrChange}
                      >
                        {t("setChangeGoogleSheet", "Set / Change Google Sheet")}
                      </Button>
                    </li>
                    <li>
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={openInApp}
                        disabled={!current}
                      >
                        {t("openInTelc", "Open in telc area")}
                      </Button>
                    </li>
                    <li>
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={openExternal}
                        disabled={!current}
                      >
                        {t("openGoogleSheet", "Open Google Sheet")}
                      </Button>
                    </li>
                    <li>
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={clear}
                        disabled={!current}
                      >
                        {t("clearGoogleSheet", "Clear Google Sheet")}
                      </Button>
                    </li>
                    <li>
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={() => setShowSaved((v) => !v)}
                      >
                        {showSaved
                          ? t("hideSaved", "Hide Saved")
                          : t("savedGoogleSheets", "Saved Google Sheets")}
                      </Button>
                    </li>
                  </ul>
                  {current && (
                    <div className="text-sm text-muted-foreground truncate text-center">
                      {current}
                    </div>
                  )}
                  {showSaved && (
                    <div className="mt-3 rounded-md border border-border p-3 space-y-2">
                      {savedList.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center">
                          {t("noSavedSheetsYet", "No saved sheets yet.")}
                        </div>
                      ) : (
                        savedList.map((s) => (
                          <div key={s.url} className="flex items-center gap-2">
                            <div className="flex-1 truncate text-sm">
                              {s.url}
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                localStorage.setItem("telcSheetUrl", s.url);
                                setCurrent(s.url);
                              }}
                            >
                              {t("use", "Use")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSheetUrl(s.url);
                                setSaEmail(
                                  s.saEmail ||
                                    localStorage.getItem("telcSaEmail") ||
                                    "",
                                );
                                setShowForm(true);
                              }}
                            >
                              {t("edit", "Edit")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const next = savedList.filter(
                                  (x) => x.url !== s.url,
                                );
                                persistSaved(next);
                                if (current === s.url) {
                                  localStorage.removeItem("telcSheetUrl");
                                  setCurrent(null);
                                }
                              }}
                            >
                              {t("delete", "Delete")}
                            </Button>
                          </div>
                        ))
                      )}
                      <p className="text-xs text-muted-foreground">
                        For security, the private key isn’t stored or shown.
                        Re-enter it when changing credentials.
                      </p>
                    </div>
                  )}
                  {showForm && (
                    <div className="mt-2 rounded-md border border-border bg-card/50 p-4 space-y-3">
                      <div className="grid gap-2">
                        <Input
                          placeholder="Google Sheet URL or ID"
                          value={sheetUrl}
                          onChange={(e) => setSheetUrl(e.target.value)}
                        />
                        <Input
                          placeholder="Service account email"
                          value={saEmail}
                          onChange={(e) => setSaEmail(e.target.value)}
                        />
                        <Textarea
                          placeholder="Service account private key (BEGIN PRIVATE KEY ... END PRIVATE KEY) — not stored, re-enter to update"
                          value={saKey}
                          onChange={(e) => setSaKey(e.target.value)}
                          className="min-h-[120px]"
                        />
                        <p className="text-xs text-muted-foreground text-center">
                          Grant the service account email view access to the
                          sheet in Google Drive.
                        </p>
                      </div>
                      <div className="flex justify-center gap-2">
                        <Button onClick={saveInline}>
                          {t("save", "Save")}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowForm(false)}
                        >
                          {t("cancel", "Cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : section === "orders" ? (
                <OrdersPanel current={current} />
              ) : section === "database" ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <DatabaseSetupPanel />
                </div>
              ) : section === "sprache" ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex gap-2">
                    <Button
                      variant={lang === "de" ? "default" : "outline"}
                      onClick={() => setLang("de")}
                    >
                      {t("german", "German")}
                    </Button>
                    <Button
                      variant={lang === "en" ? "default" : "outline"}
                      onClick={() => setLang("en")}
                    >
                      {t("english", "English")}
                    </Button>
                  </div>
                </div>
              ) : section === "emails" ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-full max-w-md space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        E-Mail Server Settings
                      </label>
                      <Input
                        placeholder="SMTP Server (e.g., smtp.gmail.com)"
                        className="mb-2"
                      />
                      <Input placeholder="Port (e.g., 587)" className="mb-2" />
                      <Input placeholder="Username/Email" className="mb-2" />
                      <Input
                        type="password"
                        placeholder="Password/App Password"
                        className="mb-2"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Default Templates
                      </label>
                      <Textarea
                        placeholder="Welcome email template..."
                        className="mb-2 min-h-[80px]"
                      />
                      <Textarea
                        placeholder="Exam reminder template..."
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button>Save Settings</Button>
                      <Button variant="outline">Test Connection</Button>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Email Templates
                      </label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={handleOpenEmailTemplateDialog}
                        >
                          {t(
                            "registrationConfirmation",
                            "Registration Confirmation",
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : section === "background" ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-full max-w-md space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Background Image
                      </label>
                      <Input type="file" accept="image/*" className="mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Upload a custom background image for the main page
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Background Options
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm">
                          Default Gradient
                        </Button>
                        <Button variant="outline" size="sm">
                          Solid Color
                        </Button>
                        <Button variant="outline" size="sm">
                          Custom Image
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Opacity
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        defaultValue="80"
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Adjust background opacity (0-100%)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button>Apply Changes</Button>
                      <Button variant="outline">Reset to Default</Button>
                    </div>
                  </div>
                </div>
              ) : section === "templates" ? (
                <div className="flex flex-col items-center gap-4 py-4 w-full">
                  <div className="w-full max-w-md space-y-4">
                    <TemplateUploader
                      title="Registration Template (PDF)"
                      type="registration"
                    />
                    <TemplateUploader
                      title="Participation Template (PDF)"
                      type="participation"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-6">
                  Select a setting category above.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Email Template Configuration Dialog */}
      <Dialog
        open={showEmailTemplateDialog}
        onOpenChange={setShowEmailTemplateDialog}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("configureEmailTemplate", "Configure Email Template")} -{" "}
              {t("registrationConfirmation", "Registration Confirmation")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailSubject">
                {t("emailSubject", "Email Subject")}
              </Label>
              <Input
                id="emailSubject"
                value={emailTemplateSubject}
                onChange={(e) => setEmailTemplateSubject(e.target.value)}
                placeholder="Anmeldebestätigung Bestellnummer [ORDERNUMBER]"
              />
              <p className="text-xs text-muted-foreground">
                Use [ORDERNUMBER] to automatically insert the order number
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailBody">{t("emailBody", "Email Body")}</Label>
              <Textarea
                id="emailBody"
                value={emailTemplateBody}
                onChange={(e) => setEmailTemplateBody(e.target.value)}
                placeholder="Enter your email template here...\n\nAvailable placeholders:\n[FIRSTNAME], [LASTNAME], [EXAMTYPE], [EXAMDATE], [ORDERNUMBER]"
                className="min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Available placeholders: [FIRSTNAME], [LASTNAME], [EXAMTYPE],
                [EXAMDATE], [ORDERNUMBER]
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmailTemplateDialog(false)}
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={handleSaveEmailTemplate}>
              {t("save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helpers and Orders panel
function normalizeHeader(h: string) {
  return String(h || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseFlexibleToDDMMYYYY(input: string): string | null {
  const s = String(input || "").trim();
  const m1 = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (m1) {
    const dd = Math.max(1, Math.min(31, Number(m1[1])));
    const mm = Math.max(1, Math.min(12, Number(m1[2])));
    const yyyy = Number(m1[3]);
    const d = new Date(yyyy, mm - 1, dd);
    if (
      d.getFullYear() === yyyy &&
      d.getMonth() === mm - 1 &&
      d.getDate() === dd
    )
      return `${String(dd).padStart(2, "0")}.${String(mm).padStart(2, "0")}.${yyyy}`;
    return null;
  }
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length === 8) {
    const dd = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    const yyyy = Number(digits.slice(4));
    const d = new Date(yyyy, mm - 1, dd);
    if (
      d.getFullYear() === yyyy &&
      d.getMonth() === mm - 1 &&
      d.getDate() === dd
    )
      return `${String(dd).padStart(2, "0")}.${String(mm).padStart(2, "0")}.${yyyy}`;
  }
  return null;
}

function onlyDigits(s: string) {
  return String(s || "").replace(/\D+/g, "");
}

function colIndexToA1(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function createSimplePdf(lines: string[]): Blob {
  const header = `%PDF-1.4\n`;
  const content = lines.map((l) => l.replace(/\r|\n/g, "")).join("\n");
  const stream = `BT /F1 10 Tf 50 780 Td 12 TL (${content.replace(/([()\\])/g, "\\$1")}) Tj ET`;
  const streamBytes = new TextEncoder().encode(stream).length;
  const objects = [
    `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n`,
    `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n`,
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n`,
    `4 0 obj << /Length ${streamBytes} >> stream\n${stream}\nendstream endobj\n`,
    `5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`,
  ];
  let xref: number[] = [];
  let body = header;
  let offset = header.length;
  for (const obj of objects) {
    xref.push(offset);
    body += obj;
    offset = body.length;
  }
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of xref) body += `${String(off).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([body], { type: "application/pdf" });
}

function OrdersPanel({ current }: { current: string | null }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grouped, setGrouped] = useState<Record<string, string[]>>({});
  const [showWooConfig, setShowWooConfig] = useState(false);
  const [wooBaseUrl, setWooBaseUrl] = useState("");
  const [wooConsumerKey, setWooConsumerKey] = useState("");
  const [wooConsumerSecret, setWooConsumerSecret] = useState("");
  const [wooTestResult, setWooTestResult] = useState<string | null>(null);

  const parseSheetId = (input: string) => {
    try {
      const u = new URL(input);
      const p = u.pathname.split("/");
      const dIdx = p.indexOf("d");
      return dIdx >= 0 ? p[dIdx + 1] : input;
    } catch {
      return input;
    }
  };

  async function load() {
    if (!current) {
      setError("No Google Sheet configured.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sheetId = parseSheetId(current);
      const tabsRes = await fetch(
        `/api/sheets/tabs?id=${encodeURIComponent(sheetId)}`,
      );
      if (!tabsRes.ok) throw new Error("tabs");
      const tabsJson = await tabsRes.json();
      const tabs: { title: string; gid: string }[] = tabsJson?.sheets || [];
      const out: Record<string, string[]> = {};
      for (const tab of tabs) {
        const sampleRes = await fetch(
          `/api/sheets/values?id=${encodeURIComponent(sheetId)}&title=${encodeURIComponent(tab.title)}&range=${encodeURIComponent("A1:ZZ200")}`,
        );
        if (!sampleRes.ok) continue;
        const sampleJson = await sampleRes.json();
        const rows: string[][] = (sampleJson?.values as string[][]) || [];
        if (rows.length === 0) continue;
        const head = rows[0];
        const maxCols = Math.max(head.length, ...rows.map((r) => r.length, 0));
        const orderCandidates = new Set<number>();
        for (let i = 0; i < maxCols; i++) {
          const h = normalizeHeader(head[i] || "");
          if (
            h.includes("bestell") ||
            h.includes("order") ||
            h.includes("b nr") ||
            h.includes("bnr")
          )
            orderCandidates.add(i);
        }
        for (let c = 0; c < maxCols; c++) {
          for (let r = 1; r < rows.length; r++) {
            const d = onlyDigits(rows[r]?.[c] || "");
            if (d.length === 4) {
              orderCandidates.add(c);
              break;
            }
          }
        }
        let dateIdx = head.findIndex((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("pdatum") ||
            n.includes("p datum") ||
            n.includes("prufungsdatum") ||
            n.includes("exam date")
          );
        });
        if (dateIdx < 0) {
          for (let c = 0; c < maxCols && dateIdx < 0; c++) {
            for (let r = 1; r < rows.length; r++) {
              if (parseFlexibleToDDMMYYYY(rows[r]?.[c] || "")) {
                dateIdx = c;
                break;
              }
            }
          }
        }
        if (orderCandidates.size === 0 || dateIdx < 0) continue;
        for (const oc of orderCandidates) {
          const col = colIndexToA1(oc);
          const dcol = colIndexToA1(dateIdx);
          const res = await fetch(
            `/api/sheets/values?id=${encodeURIComponent(sheetId)}&title=${encodeURIComponent(tab.title)}&range=${encodeURIComponent(`${col}1:${col}100000`)}`,
          );
          const dres = await fetch(
            `/api/sheets/values?id=${encodeURIComponent(sheetId)}&title=${encodeURIComponent(tab.title)}&range=${encodeURIComponent(`${dcol}1:${dcol}100000`)}`,
          );
          if (!res.ok || !dres.ok) continue;
          const json = await res.json();
          const djson = await dres.json();
          const v: any[][] = json?.values || [];
          const dv: any[][] = djson?.values || [];
          for (let r = 1; r < Math.max(v.length, dv.length); r++) {
            const order = onlyDigits(String(v[r]?.[0] ?? ""));
            const date =
              parseFlexibleToDDMMYYYY(String(dv[r]?.[0] ?? "")) || "";
            if (
              order.length === 4 &&
              date &&
              !(Number(order) >= 1900 && Number(order) <= 2040)
            ) {
              if (!out[date]) out[date] = [];
              if (!out[date].includes(order)) out[date].push(order);
            }
          }
        }
      }
      for (const k of Object.keys(out)) out[k].sort();
      try {
        const prevRaw = localStorage.getItem("ordersGrouped");
        const prev: Record<string, string[]> = prevRaw
          ? JSON.parse(prevRaw)
          : {};
        const prevSet = new Set<string>();
        Object.values(prev).forEach((arr) =>
          arr.forEach((v) => prevSet.add(v)),
        );
        const currSet = new Set<string>();
        Object.values(out).forEach((arr) => arr.forEach((v) => currSet.add(v)));
        let added = 0;
        currSet.forEach((v) => {
          if (!prevSet.has(v)) added++;
        });
        localStorage.setItem("ordersGrouped", JSON.stringify(out));
        if (added > 0) {
          try {
            const { logHistory } = await import("@/lib/history");
            const user = localStorage.getItem("currentUserName") || "User";
            logHistory({
              type: "orders_update",
              message: `${user} added ${added} new Orders to the list`,
              meta: { added },
            });
          } catch {}
        }
      } catch {}
      setGrouped(out);
    } catch (e: any) {
      setError(e?.message || "Failed");
    }
    setLoading(false);
  }

  const openWooCommerceConfig = () => {
    setShowWooConfig(true);
  };

  const handleSaveWooConfig = async () => {
    if (!wooBaseUrl || !wooConsumerKey || !wooConsumerSecret) {
      toast({
        title: "Validation Error",
        description: "Please fill all WooCommerce fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/woocommerce/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: wooBaseUrl,
          consumerKey: wooConsumerKey,
          consumerSecret: wooConsumerSecret,
        }),
      });

      if (res.ok) {
        toast({
          title: t("save", "Save"),
          description: "WooCommerce configuration saved successfully",
        });
        setWooTestResult(null);
        setShowWooConfig(false);
      } else {
        throw new Error("Failed to save configuration");
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description:
          error.message || "Could not save WooCommerce configuration",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleTestWooConnection = async () => {
    setLoading(true);
    setWooTestResult(null);

    try {
      const res = await fetch("/api/woocommerce/test-connection", {
        headers: { Accept: "application/json" },
      });

      let data: any = null;
      try {
        // Try reading normally
        const txt = await res.text();
        try {
          data = txt ? JSON.parse(txt) : {};
        } catch {
          data = { success: false, error: txt || "Invalid response" };
        }
      } catch {
        // If body was already read, fall back to status only
        data = {
          success: res.ok,
          error: res.ok ? undefined : `HTTP ${res.status}`,
        };
      }

      if (data && data.success) {
        setWooTestResult("✅ Connection successful");
        toast({
          title: "Test Successful",
          description: "WooCommerce connection is working correctly",
        });
      } else {
        const errMsg = (data && data.error) || "Connection failed";
        setWooTestResult(`❌ ${errMsg}`);
        toast({
          title: "Test Failed",
          description: errMsg,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const errorMsg = `❌ ${error.message || "Connection test failed"}`;
      setWooTestResult(errorMsg);
      toast({
        title: "Test Failed",
        description: errorMsg,
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  function downloadPdf() {
    const dates = Object.keys(grouped).sort((a, b) => {
      const ap = a.split(".").reverse().join("");
      const bp = b.split(".").reverse().join("");
      return ap.localeCompare(bp);
    });
    const lines: string[] = [];
    lines.push("All Orders by Exam Date");
    lines.push("");
    for (const d of dates) {
      lines.push(`${d}`);
      lines.push(grouped[d].join(", "));
      lines.push("");
    }
    const blob = createSimplePdf(lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "all-orders-by-exam-date.pdf";
    a.click();
    URL.revokeObjectURL(url);
    try {
      import("@/lib/history").then(({ logHistory }) => {
        const user = localStorage.getItem("currentUserName") || "User";
        logHistory({
          type: "orders_download",
          message: `${user} downloaded the Orders list as PDF`,
        });
      });
    } catch {}
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-3">
        <Button onClick={load} disabled={!current || loading}>
          {loading ? "Loading…" : "Show list"}
        </Button>
        <Button
          variant="secondary"
          onClick={openWooCommerceConfig}
          disabled={loading}
        >
          {t("fetchOrders", "Fetch Orders")}
        </Button>
        <Button
          variant="outline"
          onClick={downloadPdf}
          disabled={Object.keys(grouped).length === 0}
        >
          Download list
        </Button>
      </div>
      {!current && (
        <div className="text-sm text-muted-foreground text-center">
          Connect Google Sheet first in Settings &gt; Google Sheets.
        </div>
      )}
      {error && <div className="text-sm text-red-500 text-center">{error}</div>}

      {/* WooCommerce Configuration Form */}
      {showWooConfig && (
        <div className="mt-4 p-4 border border-border rounded-md bg-card/50">
          <h4 className="font-semibold mb-3">WooCommerce Configuration</h4>
          <div className="space-y-3 max-w-md">
            <Input
              placeholder="Store URL (e.g., https://your-store.com)"
              value={wooBaseUrl}
              onChange={(e) => setWooBaseUrl(e.target.value)}
            />
            <Input
              placeholder="Consumer Key"
              value={wooConsumerKey}
              onChange={(e) => setWooConsumerKey(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Consumer Secret"
              value={wooConsumerSecret}
              onChange={(e) => setWooConsumerSecret(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Get your WooCommerce API credentials from WooCommerce → Settings →
              Advanced → REST API
            </p>

            <div className="flex flex-col items-center gap-2">
              <Button onClick={handleSaveWooConfig} disabled={loading}>
                {loading ? "Saving..." : t("save", "Save")}
              </Button>
              <Button
                variant="outline"
                onClick={handleTestWooConnection}
                disabled={loading}
              >
                {loading ? "Testing..." : "Test Connection"}
              </Button>
              <Button variant="outline" onClick={() => setShowWooConfig(false)}>
                {t("cancel", "Cancel")}
              </Button>
            </div>

            {wooTestResult && (
              <div className="p-2 rounded border text-sm">{wooTestResult}</div>
            )}
          </div>
        </div>
      )}

      {Object.keys(grouped).length > 0 && (
        <div className="mt-2 rounded border border-border p-3 max-h-96 overflow-auto themed-scroll">
          {Object.keys(grouped)
            .sort()
            .map((d) => (
              <div key={d} className="mb-2">
                <div className="font-semibold">{d}</div>
                <div className="text-sm text-muted-foreground break-words">
                  {grouped[d].join(", ")}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
