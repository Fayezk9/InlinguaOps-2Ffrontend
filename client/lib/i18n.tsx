import React from "react";

export type Lang = "de" | "en";

type Dict = Record<string, { de: string; en: string }>;

const dict: Dict = {
  home: { de: "Start", en: "Home" },
  history: { de: "Verlauf", en: "History" },
  settings: { de: "Einstellungen", en: "Settings" },
  back: { de: "Zurück", en: "Back" },
  notifications: { de: "Mitteilungen", en: "Notifications" },
  light: { de: "Hell", en: "Light" },
  dark: { de: "Dunkel", en: "Dark" },
  language: { de: "Sprache", en: "Language" },
  german: { de: "Deutsch", en: "German" },
  english: { de: "Englisch", en: "English" },
  googleSheets: { de: "Google Sheets", en: "Google Sheets" },
  emails: { de: "Emails", en: "Emails" },
  backgroundPhoto: { de: "Hintergrundfoto", en: "Background Photo" },
  setChangeGoogleSheet: {
    de: "Google Sheet setzen / ändern",
    en: "Set / Change Google Sheet",
  },
  openInTelc: { de: "Im Telc Bereich öffnen", en: "Open in telc area" },
  openGoogleSheet: { de: "Google Sheet öffnen", en: "Open Google Sheet" },
  clearGoogleSheet: { de: "Google Sheet entfernen", en: "Clear Google Sheet" },
  savedGoogleSheets: {
    de: "Gespeicherte Google Sheets",
    en: "Saved Google Sheets",
  },
  hideSaved: { de: "Verstecken", en: "Hide Saved" },
  noSavedSheetsYet: {
    de: "Noch keine Sheets gespeichert.",
    en: "No saved sheets yet.",
  },
  use: { de: "Benutzen", en: "Use" },
  edit: { de: "Bearbeiten", en: "Edit" },
  delete: { de: "Löschen", en: "Delete" },
  save: { de: "Speichern", en: "Save" },
  cancel: { de: "Abbrechen", en: "Cancel" },

  // AddPersonDialog
  addPerson: { de: "Person hinzufügen", en: "Add Person" },
  orderNumber: { de: "Bestellnummer", en: "Order Number" },
  lastName: { de: "Nachname", en: "Last name" },
  firstName: { de: "Vorname", en: "First name" },
  birthDate: { de: "Geburtsdatum", en: "Date of birth" },
  birthPlace: { de: "Geburtsort", en: "Place of birth" },
  birthCountry: { de: "Geburtsland", en: "Country of birth" },
  email: { de: "Email", en: "Email" },
  phone: { de: "Tel.Nr.", en: "Phone" },
  exam: { de: "Prüfung", en: "Exam" },
  examPart: { de: "Prüfungsteil", en: "Exam part" },
  certificate: { de: "Zertifikat", en: "Certificate" },
  pDate: { de: "P.Datum", en: "P.Date" },
  bDate: { de: "B.Datum", en: "B.Date" },
  price: { de: "Preis", en: "Price" },
  paymentMethod: { de: "Zahlungsart", en: "Payment method" },
  status: { de: "Status", en: "Status" },
  employee: { de: "Mitarbeiter", en: "Employee" },
  add: { de: "Hinzufügen", en: "Add" },
  invalidEmailMsg: {
    de: "Bitte eine gültige E-Mail eingeben!",
    en: "Please enter a valid email!",
  },
  bookingAfterExamMsg: {
    de: "Buchungsdatum sollte vor dem Prüfungsdatum sein!",
    en: "Booking date should be before exam date!",
  },
  choose: { de: "Wählen", en: "Choose" },
  pickCountry: { de: "Land wählen", en: "Select country" },

  // App-specific navigation/pages
  telcArea: { de: "telc Bereich", en: "Telc Area" },
  orders: { de: "Bestellungen", en: "Orders" },
  manageParticipants: { de: "Teilnehmer verwalten", en: "Manage Participants" },
  exams: { de: "Prüfungen", en: "Exams" },
  needsAttention: { de: "Braucht Aufmerksamkeit", en: "Needs Attention" },
  registrationConfirmation: {
    de: "Anmeldebestätigung",
    en: "Registration Confirmation",
  },
  participationConfirmation: {
    de: "Teilnahmebestätigung",
    en: "Participation Confirmation",
  },
  examsManagement: { de: "Prüfungsverwaltung", en: "Exams Management" },
  newOrders: { de: "Neue Bestellungen", en: "New Orders" },
  searchOrders: { de: "Bestellungen suchen", en: "Search Orders" },
  export: { de: "Exportieren", en: "Export" },
  openWebsite: { de: "Website öffnen", en: "Open Website" },
  addressPostList: { de: "Adress-Post-Liste", en: "Address Post List" },
  makeRegistrationConfirmation: {
    de: "Anmeldebestätigungen erzeugen",
    en: "Make Registration Confirmation",
  },
  makeParticipationConfirmation: {
    de: "Teilnahmebestätigungen erzeugen",
    en: "Make Participation Confirmation",
  },
  makeAddressPostList: {
    de: "Adress-Post-Liste erzeugen",
    en: "Make Address Post List",
  },
  refreshOrders: { de: "Bestellungen aktualisieren", en: "Refresh Orders" },
  newOrdersFound: { de: "Neue Bestellungen gefunden", en: "New Orders Found" },
  ordersRefreshed: { de: "Bestellungen aktualisiert", en: "Orders Refreshed" },
  lastUpdated: { de: "Zuletzt aktualisiert", en: "Last Updated" },
  never: { de: "Nie", en: "Never" },
  searchOrdersDialog: { de: "Bestellungen suchen", en: "Search Orders" },
  orderNumber: { de: "Bestellnummer", en: "Order Number" },
  lastName: { de: "Nachname", en: "Last Name" },
  firstName: { de: "Vorname", en: "First Name" },
  birthday: { de: "Geburtstag", en: "Birthday" },
  examType: { de: "Prüfungsart", en: "Exam Type" },
  examDate: { de: "Prüfungsdatum", en: "Exam Date" },
  selectExamType: { de: "Prüfungsart wählen", en: "Select Exam Type" },
  selectExamDate: { de: "Prüfungsdatum wählen", en: "Select Exam Date" },
  search: { de: "Suchen", en: "Search" },
  clear: { de: "Löschen", en: "Clear" },
  searchResults: { de: "Suchergebnisse", en: "Search Results" },
  noResultsFound: { de: "Keine Ergebnisse gefunden", en: "No Results Found" },
  birthPlace: { de: "Geburtsort", en: "Birth Place" },
  birthCountry: { de: "Geburtsland", en: "Birth Country" },
  examPart: { de: "Prüfungsteil", en: "Exam Part" },
  certificate: { de: "Zertifikat", en: "Certificate" },
  examDateShort: { de: "P.Datum", en: "Exam Date" },
  bookingDate: { de: "B.Datum", en: "Booking Date" },
  paymentMethod: { de: "Zahlungsart", en: "Payment Method" },
  employee: { de: "Mitarbeiter", en: "Employee" },
  wooCommerceOrder: { de: "WooCommerce Bestellung", en: "WooCommerce Order" },
  participantData: { de: "Teilnehmerdaten", en: "Participant Data" },
  addExam: { de: "Prüfung hinzufügen", en: "Add Exam" },
  postponeExam: { de: "Prüfung verschieben", en: "Postpone Exam" },
  back: { de: "Zurück", en: "Back" },
  close: { de: "Schließen", en: "Close" },
  searching: { de: "Suche...", en: "Searching..." },
  sendRegistrationConfirmation: { de: "Anmeldebestätigung senden", en: "Send Registration Confirmation" },
  sendParticipationConfirmation: { de: "Teilnahmebestätigung senden", en: "Send Participation Confirmation" },
  certificatePerPost: { de: "Zertifikat per Post", en: "Certificate per Post" },
  registrationConfirmation: { de: "Anmeldebestätigung", en: "Registration Confirmation" },
  participationConfirmation: { de: "Teilnahmebestätigung", en: "Participation Confirmation" },
  emailTemplate: { de: "E-Mail Vorlage", en: "Email Template" },
  emailSubject: { de: "E-Mail Betreff", en: "Email Subject" },
  emailBody: { de: "E-Mail Text", en: "Email Body" },
  configureEmailTemplate: { de: "E-Mail Vorlage konfigurieren", en: "Configure Email Template" },
  emailSent: { de: "E-Mail gesendet", en: "Email Sent" },
  emailSendFailed: { de: "E-Mail senden fehlgeschlagen", en: "Email Send Failed" },
  fetchOrders: { de: "Bestellungen abrufen", en: "Fetch Orders" },
};

export const I18nContext = React.createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof dict, fallback?: string) => string;
}>({ lang: "de", setLang: () => {}, t: (k) => dict[k]?.de ?? String(k) });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(
    (localStorage.getItem("lang") as Lang) || "de",
  );
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
    if (typeof document !== "undefined") document.documentElement.lang = l;
  };
  const t = React.useCallback(
    (key: keyof typeof dict, fallback?: string) => {
      const entry = dict[key];
      if (!entry) return fallback ?? String(key);
      return entry[lang] ?? fallback ?? entry.de;
    },
    [lang],
  );
  React.useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);
  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return React.useContext(I18nContext);
}
