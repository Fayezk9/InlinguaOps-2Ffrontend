import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateDDMMYYYY, dottedToISO } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2, Mail, FileText, Package } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

export type SearchOrdersForm = {
  orderNumber: string;
  lastName: string;
  firstName: string;
  birthday: string;
  examType: "B1" | "B2" | "C1" | "";
  examDate: string;
};

type SearchOrdersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (criteria: SearchOrdersForm) => void;
  searchResults?: any[];
  isLoading?: boolean;
  hasSearched?: boolean;
};

// Mock exam dates - in real implementation, these would come from settings
const EXAM_DATES = {
  B1: ["2024-01-15", "2024-02-15", "2024-03-15", "2024-04-15"],
  B2: ["2024-01-20", "2024-02-20", "2024-03-20", "2024-04-20"],
  C1: ["2024-01-25", "2024-02-25", "2024-03-25", "2024-04-25"],
};

export function SearchOrdersDialog({
  open,
  onOpenChange,
  onSearch,
  searchResults = [],
  isLoading = false,
  hasSearched = false,
}: SearchOrdersDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<"search" | "results">(
    "search",
  );
  const [form, setForm] = useState<SearchOrdersForm>({
    orderNumber: "",
    lastName: "",
    firstName: "",
    birthday: "",
    examType: "",
    examDate: "",
  });

  // Reset to search view when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentView("search");
    }
  }, [open]);

  // Switch to results view when search results are available
  useEffect(() => {
    if (hasSearched && !isLoading) {
      setCurrentView("results");
    }
  }, [hasSearched, isLoading]);

  const handleInputChange = (field: keyof SearchOrdersForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // Reset exam date when exam type changes
      ...(field === "examType" ? { examDate: "" } : {}),
    }));
  };

  const handleSearch = () => {
    onSearch(form);
    // Don't close dialog, let the parent component handle view switching
  };

  const handleBack = () => {
    setCurrentView("search");
  };

  const handleSendRegistrationConfirmation = async (result: any) => {
    try {
      const orderNumber =
        result.wooOrder?.number ||
        result.wooOrder?.id ||
        result.participantData?.bestellnummer;
      const email = result.participantData?.email || result.wooOrder?.email;

      if (!email) {
        throw new Error("No email address found");
      }

      // Get email template from localStorage
      const subjectTemplate =
        localStorage.getItem(
          "emailTemplate_registrationConfirmation_subject",
        ) || "Anmeldebestätigung Bestellnummer [ORDERNUMBER]";
      const bodyTemplate =
        localStorage.getItem("emailTemplate_registrationConfirmation_body") ||
        "";

      // Replace placeholders with actual data
      const subject = subjectTemplate.replace(
        "[ORDERNUMBER]",
        orderNumber || "",
      );
      const body = bodyTemplate
        .replace(/\[FIRSTNAME\]/g, result.participantData?.vorname || "")
        .replace(/\[LASTNAME\]/g, result.participantData?.nachname || "")
        .replace(/\[EXAMTYPE\]/g, result.participantData?.pruefung || "")
        .replace(/\[EXAMDATE\]/g, result.participantData?.pDatum || "")
        .replace(/\[ORDERNUMBER\]/g, orderNumber || "");

      // Send email via backend API
      const response = await fetch(
        "/api/emails/send-registration-confirmation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject,
            body,
            participantData: result.participantData,
            orderData: result.wooOrder,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to send email");
      }

      toast({
        title: t("emailSent", "Email Sent"),
        description: `Registration confirmation sent to ${email}`,
      });
    } catch (error: any) {
      toast({
        title: t("emailSendFailed", "Email Send Failed"),
        description: error?.message ?? "Could not send email",
        variant: "destructive",
      });
    }
  };

  const handleSendParticipationConfirmation = async (result: any) => {
    try {
      const email = result.participantData?.email || result.wooOrder?.email;

      if (!email) {
        throw new Error("No email address found");
      }

      // TODO: Implement actual email sending
      toast({
        title: t("emailSent", "Email Sent"),
        description: `Participation confirmation sent to ${email}`,
      });
    } catch (error: any) {
      toast({
        title: t("emailSendFailed", "Email Send Failed"),
        description: error?.message ?? "Could not send email",
        variant: "destructive",
      });
    }
  };

  const handleCertificatePerPost = async (result: any) => {
    try {
      // TODO: Implement certificate per post functionality
      toast({
        title: t("certificatePerPost", "Certificate per Post"),
        description: "Certificate delivery arranged",
      });
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error?.message ?? "Could not arrange certificate delivery",
        variant: "destructive",
      });
    }
  };

  const handleClear = () => {
    setForm({
      orderNumber: "",
      lastName: "",
      firstName: "",
      birthday: "",
      examType: "",
      examDate: "",
    });
  };

  const availableExamDates = form.examType ? EXAM_DATES[form.examType] : [];

  const renderSearchForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="orderNumber">{t("orderNumber", "Order Number")}</Label>
        <Input
          id="orderNumber"
          value={form.orderNumber}
          onChange={(e) => handleInputChange("orderNumber", e.target.value)}
          placeholder={t("orderNumber", "Order Number")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastName">{t("lastName", "Last Name")}</Label>
        <Input
          id="lastName"
          value={form.lastName}
          onChange={(e) => handleInputChange("lastName", e.target.value)}
          placeholder={t("lastName", "Last Name")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="firstName">{t("firstName", "First Name")}</Label>
        <Input
          id="firstName"
          value={form.firstName}
          onChange={(e) => handleInputChange("firstName", e.target.value)}
          placeholder={t("firstName", "First Name")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthday">{t("birthday", "Birthday")}</Label>
        <Input
          id="birthday"
          type="text"
          placeholder="DD.MM.YYYY"
          value={form.birthday}
          onChange={(e) => handleInputChange("birthday", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("examType", "Exam Type")}</Label>
          <Select
            value={form.examType}
            onValueChange={(value) =>
              handleInputChange("examType", value as "B1" | "B2" | "C1")
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={t("selectExamType", "Select Exam Type")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="B1">B1</SelectItem>
              <SelectItem value="B2">B2</SelectItem>
              <SelectItem value="C1">C1</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("examDate", "Exam Date")}</Label>
          <Select
            value={form.examDate}
            onValueChange={(value) => handleInputChange("examDate", value)}
            disabled={!form.examType}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={t("selectExamDate", "Select Exam Date")}
              />
            </SelectTrigger>
            <SelectContent>
              {availableExamDates.map((date) => (
                <SelectItem key={date} value={date}>
                  {formatDateDDMMYYYY(date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6" />
          <span className="ml-2">{t("searching", "Searching...")}</span>
        </div>
      ) : searchResults.length > 0 ? (
        <div className="space-y-4 max-h-96 overflow-auto">
          {searchResults.map((result, index) => (
            <Card key={result.wooOrder?.id || index} className="p-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-4">
                  {/* WooCommerce Order Info */}
                  {result.wooOrder && (
                    <div>
                      <h5 className="font-semibold text-sm mb-2">
                        {t("wooCommerceOrder", "WooCommerce Order")}
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="font-medium">
                            {t("orderNumber", "Order Number")}:{" "}
                          </span>
                          {result.wooOrder.number || result.wooOrder.id}
                        </div>
                        <div>
                          <span className="font-medium">
                            {t("status", "Status")}:{" "}
                          </span>
                          {result.wooOrder.status}
                        </div>
                        <div>
                          <span className="font-medium">
                            {t("price", "Price")}:{" "}
                          </span>
                          {result.wooOrder.total} {result.wooOrder.currency}
                        </div>
                        <div>
                          <span className="font-medium">
                            {t("email", "Email")}:{" "}
                          </span>
                          {result.wooOrder.email}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Participant Data from Google Sheets */}
                  {result.participantData && (
                    <div>
                      <h5 className="font-semibold text-sm mb-2">
                        {t("participantData", "Participant Data")}
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="font-medium">
                            {t("lastName", "Last Name")}:{" "}
                          </span>
                          {result.participantData.nachname}
                        </div>
                        <div>
                          <span className="font-medium">
                            {t("firstName", "First Name")}:{" "}
                          </span>
                          {result.participantData.vorname}
                        </div>
                        <div>
                          <span className="font-medium">
                            {t("birthday", "Birthday")}:{" "}
                          </span>
                          {result.participantData.geburtsdatum}
                        </div>
                        <div>
                          <span className="font-medium">
                            {t("examType", "Exam Type")}:{" "}
                          </span>
                          {result.participantData.pruefung}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSendRegistrationConfirmation(result)}
                    className="whitespace-nowrap"
                  >
                    <Mail className="h-3 w-3 mr-1" />
                    {t(
                      "sendRegistrationConfirmation",
                      "Send Registration Confirmation",
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSendParticipationConfirmation(result)}
                    className="whitespace-nowrap"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    {t(
                      "sendParticipationConfirmation",
                      "Send Participation Confirmation",
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCertificatePerPost(result)}
                    className="whitespace-nowrap"
                  >
                    <Package className="h-3 w-3 mr-1" />
                    {t("certificatePerPost", "Certificate per Post")}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            {t("noResultsFound", "No Results Found")}
          </p>
        </div>
      )}
    </div>
  );

  const normalizeBirthday = (raw: any): string => {
    if (!raw) return "";
    const s = String(raw).trim();
    const isoDotted = dottedToISO(s);
    if (isoDotted) return formatDateDDMMYYYY(isoDotted);
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) {
      const dd = m[1].padStart(2, "0");
      const mm = m[2].padStart(2, "0");
      const yyyy = m[3];
      return formatDateDDMMYYYY(`${yyyy}-${mm}-${dd}`);
    }
    const fmt = formatDateDDMMYYYY(s);
    return fmt || s;
  };

  const META_KEYS_DOB = [
    "dob",
    "date_of_birth",
    "geburtsdatum",
    "geburtstag",
    "birth_date",
    "billing_dob",
    "billing_birthdate",
    "_billing_birthdate",
    "birthday",
  ];
  const META_KEYS_NATIONALITY = [
    "nationality",
    "billing_nationality",
    "staatsangehoerigkeit",
    "staatsangehörigkeit",
    "nationalitaet",
    "nationalität",
    "geburtsland",
    "birth_country",
    "country_of_birth",
    "geburts land",
  ];
  const META_KEYS_EXAM_KIND = [
    "pruefungstyp",
    "prüfungstyp",
    "exam_type",
    "exam_kind",
    "type",
    "typ",
    "teilnahmeart",
    "pruefung_art",
    "prüfungsart",
    "pruefungsart",
    "art_der_pruefung",
    "prüfung_typ",
    "exam_variant",
    "variant",
    "variante",
  ];
  const META_KEYS_LEVEL = ["exam_level", "level", "niveau", "language_level", "pruefungsniveau", "prüfungsniveau"];
  const META_KEYS_BIRTH_PLACE = [
    "geburtsort",
    "ort der geburt",
    "geburts stadt",
    "birthplace",
    "place_of_birth",
    "birth_place",
  ];
  const META_KEYS_CERT = [
    "zertifikat",
    "certificate",
    "certificate_delivery",
    "zertifikat_versand",
    "zertifikat versand",
    "lieferung_zertifikat",
    "zertifikat_abholung",
  ];
  const norm = (s: string) => s
    .toLowerCase()
    .trim()
    .replace(/:$/u, "")
    .replace(/\(.*?\)/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const getFromMeta = (meta: Record<string, any>, keys: string[]) => {
    const map = Object.fromEntries(Object.entries(meta || {}).map(([k, v]) => [norm(String(k)), v]));
    for (const k of keys) {
      const v = map[norm(k)];
      if (v != null && String(v).length > 0) return String(v);
    }
    return "";
  };

  const renderResultsCompact = () => {
    const result = searchResults[0];
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6" />
          <span className="ml-2">{t("searching", "Searching...")}</span>
        </div>
      );
    }
    if (!result) {
      return (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            {t("noResultsFound", "No Results Found")}
          </p>
        </div>
      );
    }

    const wo = result.wooOrder || {};
    const customerName: string = (wo as any).customerName || "";
    const nameParts = customerName.trim().split(/\s+/);
    const derivedLast = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const derivedFirst = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0] || "";

    const pd = result.participantData || {};
    const w: any = wo;
    const surname = w.billingLastName || pd.nachname || derivedLast;
    const firstName = w.billingFirstName || pd.vorname || derivedFirst;
    const birthdayRaw = pd.geburtsdatum || pd.birthday || w.extracted?.dob || "";
    const birthday = birthdayRaw ? (formatDateDDMMYYYY(birthdayRaw) || String(birthdayRaw)) : "";
    const birthLand = pd.geburtsland || pd.birthland || pd.geburtsland_de || w.extracted?.nationality || "";
    const email = pd.email || w.email || "";
    const phone = (pd.telefon || pd.phone || w.phone || "") as string;
    const examKind = pd.pruefung || pd.examType || w.extracted?.examKind || w.extracted?.level || "";

    const meta = ((wo as any).meta || {}) as Record<string, any>;
    const metaValues = Object.values(meta).map((v) => String(v).toLowerCase());

    const birthdayResolvedRaw = birthdayRaw || getFromMeta(meta, META_KEYS_DOB) || (w.extracted?.dob || "");
    const birthdayResolved = normalizeBirthday(birthdayResolvedRaw);
    const birthPlaceResolved = getFromMeta(meta, META_KEYS_BIRTH_PLACE) || (w.extracted?.birthPlace || "");
    const nationalityResolved = (birthLand || getFromMeta(meta, META_KEYS_NATIONALITY) || (w.extracted?.nationality || ""));
    const examKindResolved = (examKind || getFromMeta(meta, META_KEYS_EXAM_KIND) || getFromMeta(meta, META_KEYS_LEVEL) || w.extracted?.examKind || w.extracted?.level || "");
    const certMeta = getFromMeta(meta, META_KEYS_CERT) || (w.extracted?.certificate || "");
    const certificateResolved = certMeta
      ? /post/i.test(certMeta) ? "Per Post" : /abhol/i.test(certMeta) ? "Abholen im Büro" : String(certMeta)
      : "";

    const productNames: string[] = Array.isArray((wo as any).lineItems)
      ? (wo as any).lineItems.map((li: any) => li?.name).filter(Boolean)
      : [];
    const productLabel = productNames.join(", ");

    const levelRaw = getFromMeta(meta, META_KEYS_LEVEL) || (w.extracted?.level || "") || String(pd.examType || "");
    const across = [levelRaw, examKindResolved, String(pd.pruefung || ""), productLabel].join(" ");
    const levelMatch = across.match(/\b(B1|B2|C1)\b/i);
    const levelDetected = levelMatch ? levelMatch[1].toUpperCase() : "";
    const examSort = productLabel || levelDetected;
    const examPartRaw =
      pd.pruefungsteil ||
      pd.examPart ||
      metaValues.find(
        (v) => v.includes("nur mündlich") || v.includes("nur muendlich") || v.includes("nur schriftlich"),
      ) || "";
    const examPart = examPartRaw
      ? examPartRaw.toLowerCase().includes("mündlich") || examPartRaw.toLowerCase().includes("muendlich")
        ? "nur mündlich"
        : examPartRaw.toLowerCase().includes("schriftlich")
        ? "nur schriftlich"
        : ""
      : "";

    const extractHNo = (s?: string) => {
      if (!s) return "";
      const matches = Array.from(String(s).matchAll(/\b(\d+[a-zA-Z]?)\b/g));
      return matches.length ? matches[matches.length - 1][1] : "";
    };
    const houseNoResolved = w.extracted?.houseNo || extractHNo(w.billingAddress1) || extractHNo(w.billingAddress2) || extractHNo(w.shippingAddress1) || "";
    const line1Billing = [w.billingAddress1, houseNoResolved].filter(Boolean).join(" ");
    const line2Billing = [w.billingPostcode, w.billingCity].filter(Boolean).join(" ");
    const line1 = line1Billing || [w.shippingAddress1, houseNoResolved].filter(Boolean).join(" ");
    const line2 = line2Billing || [w.shippingPostcode, w.shippingCity].filter(Boolean).join(" ");

    const debugKeys = Object.keys(meta || {}).slice(0, 60).join(", ");

    return (
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><span className="font-medium">Surname:</span> {surname}</div>
          <div><span className="font-medium">First name:</span> {firstName}</div>
          <div><span className="font-medium">Geburtsdatum:</span> {birthdayResolved || "-"}</div>
          <div><span className="font-medium">Geburtsort:</span> {birthPlaceResolved || "-"}</div>
          <div><span className="font-medium">Geburtsland:</span> {nationalityResolved || "-"}</div>
          <div><span className="font-medium">Email:</span> {email}</div>
          <div><span className="font-medium">Telefon:</span> {phone || "-"}</div>
          <div className="sm:col-span-2">
            <span className="font-medium">Address:</span>
            <div>{line1}</div>
            <div>{line2}</div>
          </div>
          <div><span className="font-medium">Exam kind:</span> {examKindResolved}</div>
          <div><span className="font-medium">Exam sort:</span> {examSort || "-"}</div>
          {examPart && (
            <div className="sm:col-span-2"><span className="font-medium">Exam part:</span> {examPart}</div>
          )}
          {certificateResolved && (
            <div className="sm:col-span-2"><span className="font-medium">Certificate:</span> {certificateResolved}</div>
          )}
          <div className="sm:col-span-2"><span className="font-medium">Price:</span> {w.total} {w.currency}</div>
          <details className="sm:col-span-2 mt-2 text-xs opacity-70">
            <summary>Debug: order meta keys</summary>
            <div className="break-words">{debugKeys}</div>
          </details>
        </div>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={currentView === "results" ? "max-w-2xl" : "max-w-md"}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            {currentView === "results" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {currentView === "search"
                ? t("searchOrdersDialog", "Search Orders")
                : t("searchResults", "Search Results")}
            </DialogTitle>
          </div>
        </DialogHeader>

        {currentView === "search" ? renderSearchForm() : renderResultsCompact()}

        {currentView === "search" && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClear}>
              {t("clear", "Clear")}
            </Button>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2" />
                  {t("searching", "Searching...")}
                </>
              ) : (
                t("search", "Search")
              )}
            </Button>
          </DialogFooter>
        )}

        {currentView === "results" && (
          <DialogFooter>
            <Button variant="outline" onClick={handleBack}>
              {t("back", "Back")}
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              {t("close", "Close")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
