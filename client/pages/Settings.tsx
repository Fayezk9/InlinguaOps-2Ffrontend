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

function SchoolSection() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/school/address");
      const j = await r.json().catch(() => ({}));
      const a = j?.address || null;
      if (a) {
        setFirstName(a.firstName || "");
        setLastName(a.lastName || "");
        setStreet(a.street || "");
        setHouseNumber(a.houseNumber || "");
        setZip(a.zip || "");
        setCity(a.city || "");
      }
      const lr = await fetch("/api/school/logo");
      const lj = await lr.json().catch(() => ({}));
      setLogo(lj?.logo || null);
      setLoaded(true);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (open && !loaded) load();
  }, [open]);

  const onSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/school/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, street, houseNumber, zip, city }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || `Save failed (${res.status})`);
      toast({ title: "Saved", description: "School address saved" });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message || "Could not save", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full">
      <div className="w-full max-w-md space-y-3">
        <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
          Address
        </Button>
        <div className="mt-2 p-3 border rounded-md">
          <div className="text-sm font-medium mb-2">Logo</div>
          {logo ? (
            <div className="flex items-center gap-3">
              <img src={logo} alt="School logo" className="h-14 w-auto object-contain border rounded bg-white" />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await fetch("/api/school/logo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentBase64: "" }) });
                      setLogo(null);
                      toast({ title: "Removed", description: "Logo removed" });
                    } catch {}
                  }}
                >
                  Remove
                </Button>
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Change</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Upload Logo</Button>
              <span className="text-xs text-muted-foreground">PNG/JPG, small size recommended</span>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!f) return;
              const reader = new FileReader();
              reader.onload = async () => {
                const dataUrl = String(reader.result || "");
                setLogo(dataUrl);
                try {
                  await fetch("/api/school/logo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contentBase64: dataUrl }),
                  });
                  toast({ title: "Saved", description: "Logo saved" });
                } catch (e: any) {
                  toast({ title: "Failed", description: e?.message || "Could not save logo", variant: "destructive" });
                }
              };
              reader.readAsDataURL(f);
            }}
          />
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>School Address</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-1">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="col-span-1">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Street</Label>
              <Input value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div className="col-span-1">
              <Label>House number</Label>
              <Input value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
            </div>
            <div className="col-span-1">
              <Label>Zip</Label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onSave} disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      const target = e.target as HTMLElement | null;
      // Ignore clicks inside any open dialog (so editing inside a modal won't close the settings section)
      if (target && (target.closest('[role="dialog"]') || target.closest('[data-sonner-toast]'))) return;
      if (panelRef.current && !panelRef.current.contains(target as Node)) {
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
  // Database window sub-tabs
  const [dbTab, setDbTab] = useState<"woo" | "orders">("woo");
  useEffect(() => {
    const handler = () => setDbTab("woo");
    window.addEventListener("openWooConfig", handler);
    return () => window.removeEventListener("openWooConfig", handler);
  }, []);
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
              {section === "database" && dbTab === "orders" ? (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <button className="underline" onClick={() => setDbTab("woo")}>
                    Database
                  </button>
                  <span>→</span>
                  <span className="text-foreground font-medium">Orders</span>
                </div>
              ) : (
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
                              : section === "school"
                                ? "School"
                                : t("backgroundPhoto", "Background Photo")}
                </CardTitle>
              )}
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
                <div className="flex flex-col items-center gap-4 py-4 w-full">
                  <div className="w-full max-w-md flex gap-2">
                    <Button
                      className="flex-1"
                      variant={dbTab === "woo" ? "secondary" : "outline"}
                      onClick={() => setDbTab("woo")}
                    >
                      Woo Commerce
                    </Button>
                    <Button
                      className="flex-1"
                      variant={dbTab === "orders" ? "secondary" : "outline"}
                      onClick={() => setDbTab("orders")}
                    >
                      Orders
                    </Button>
                  </div>
                  {dbTab === "woo" ? (
                    <DatabaseSetupPanel />
                  ) : (
                    <OrdersPanel current={current} />
                  )}
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
              ) : section === "school" ? (
                <SchoolSection />
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
  const { toast } = useToast();
  const [fetching, setFetching] = useState(false);
  const [fetchedOnce, setFetchedOnce] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [origRows, setOrigRows] = useState<any[]>([]);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/orders/simple/status");
        const j = await r.json().catch(() => ({}));
        setFetchedOnce(!!j?.initialized);
        setLastAdded(j?.lastAdded || null);
      } catch {}
      try {
        const c = await fetch("/api/woocommerce/config");
        setIsConfigured(c.ok);
      } catch {
        setIsConfigured(false);
      }
    })();
  }, []);

  const setGlobalLoading = (on: boolean) => {
    try {
      window.dispatchEvent(new CustomEvent("app:loading", { detail: { loading: on } }));
    } catch {}
  };

  const fetchOrders = async () => {
    if (fetchedOnce) {
      toast({ title: "Info", description: "Orders already fetched." });
      return;
    }
    // pre-check config
    try {
      const c = await fetch("/api/woocommerce/config");
      if (!c.ok) {
        toast({ title: "Configure WooCommerce", description: "Open Woo Commerce to set URL and keys." });
        window.dispatchEvent(new Event("openWooConfig"));
        return;
      }
      setIsConfigured(true);
    } catch {}
    setFetching(true);
    setGlobalLoading(true);
    try {
      // Try recent 30 days first
      const r = await fetch("/api/orders/recent-detailed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since: new Date(Date.now() - 30*24*60*60*1000).toISOString() }),
      });
      let list: any[] = [];
      if (r.ok) {
        const j = await r.json();
        list = Array.isArray(j?.results) ? j.results : [];
      }
      // Fallback: pull latest page if none in window
      if (!list.length) {
        const r2 = await fetch("/api/orders/old-detailed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: 1, pageSize: 5 }),
        });
        if (r2.ok) {
          const j2 = await r2.json();
          list = Array.isArray(j2?.results) ? j2.results : [];
        }
      }
      const items = list.slice(0, 5).map((o: any) => ({
        orderNumber: String(o.number || o.id || ""),
        lastName: String(o.billingLastName || ""),
        firstName: String(o.billingFirstName || ""),
        examKind: String(o.examKind || ""),
        examPart: String(o.examPart || ""),
        examDate: String(o.examDate || ""),
        price: String(o.price ?? ""),
      }));
      if (!items.length) throw new Error("No orders found to import");
      const s = await fetch("/api/orders/simple/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!s.ok) throw new Error("Save failed");
      const sj = await s.json().catch(() => ({}));
      setFetchedOnce(true);
      setLastAdded(sj?.lastAdded || new Date().toISOString());
      toast({ title: "Done", description: `Saved ${items.length} orders` });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message || "Fetch error", variant: "destructive" });
    }
    setFetching(false);
    setGlobalLoading(false);
  };

  const openList = async () => {
    setShowList(true);
    try {
      const r = await fetch("/api/orders/simple/list");
      const j = await r.json().catch(() => ({}));
      const items = Array.isArray(j?.items) ? j.items : [];
      setRows(items);
      setOrigRows(JSON.parse(JSON.stringify(items)));
    } catch {}
  };

  const saveEdits = async () => {
    const updates: any[] = [];
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i];
      const b = origRows[i] || {};
      const changed: any = { orderNumber: a.order_number || a.orderNumber };
      let diff = false;
      if ((a.last_name || "") !== (b.last_name || "")) { changed.lastName = a.last_name; diff = true; }
      if ((a.first_name || "") !== (b.first_name || "")) { changed.firstName = a.first_name; diff = true; }
      if ((a.price || "") !== (b.price || "")) { changed.price = a.price; diff = true; }
      if (diff) updates.push(changed);
    }
    if (updates.length === 0) {
      toast({ title: "No changes", description: "Nothing to save" });
      return;
    }
    try {
      const r = await fetch("/api/orders/simple/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updates }),
      });
      if (!r.ok) throw new Error("Update failed");
      toast({ title: "Saved", description: "Updates applied" });
      setOrigRows(JSON.parse(JSON.stringify(rows)));
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message || "Save error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3 w-full max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <Button onClick={fetchOrders} disabled={fetching || fetchedOnce || isConfigured === false}>
          {fetching ? "Fetching…" : "Fetch Orders"}
        </Button>
        <Button variant="secondary" onClick={openList}>Show List</Button>
      </div>
      <div className="text-xs text-muted-foreground">{`Last added: ${lastAdded ? new Date(lastAdded).toISOString().slice(0,16).replace('T',' ') : '-'}`}</div>
      {isConfigured === false && (
        <div className="text-xs text-red-600">WooCommerce not configured. Open Woo Commerce tab to set it up.</div>
      )}

      <Dialog open={showList} onOpenChange={setShowList}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Orders</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Order Number</th>
                  <th className="py-2 pr-3">Last Name</th>
                  <th className="py-2 pr-3">First Name</th>
                  <th className="py-2 pr-3">Exam Kind</th>
                  <th className="py-2 pr-3">Exam Part</th>
                  <th className="py-2 pr-3">Exam Date</th>
                  <th className="py-2 pr-0">Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.order_number || r.orderNumber} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{r.order_number || r.orderNumber}</td>
                    <td className="py-2 pr-3"><Input value={r.last_name || ""} onChange={(e) => { const v=[...rows]; v[idx] = { ...v[idx], last_name: e.target.value }; setRows(v); }} /></td>
                    <td className="py-2 pr-3"><Input value={r.first_name || ""} onChange={(e) => { const v=[...rows]; v[idx] = { ...v[idx], first_name: e.target.value }; setRows(v); }} /></td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.exam_kind}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.exam_part}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.exam_date}</td>
                    <td className="py-2 pr-0"><Input value={r.price || ""} onChange={(e) => { const v=[...rows]; v[idx] = { ...v[idx], price: e.target.value }; setRows(v); }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button onClick={saveEdits}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
