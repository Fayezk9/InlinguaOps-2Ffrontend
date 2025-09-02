package com.linguaops.desktop.service;

import com.linguaops.desktop.LinguaOpsApplication;
import com.linguaops.desktop.controller.I18nController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.ResourceBundle;

public class I18nService {
    private static final Logger logger = LoggerFactory.getLogger(I18nService.class);
    
    private ResourceBundle bundle;
    private String currentLanguage;
    private final Map<String, String> fallbackTranslations;

    public I18nService() {
        this.fallbackTranslations = createFallbackTranslations();
    }

    public void initialize() {
        ConfigurationService configService = LinguaOpsApplication.getInstance().getConfigService();
        setLanguage(configService.getLanguage());
        logger.info("I18n service initialized with language: {}", currentLanguage);
    }

    public void setLanguage(String language) {
        this.currentLanguage = language;
        
        try {
            Locale locale = "de".equals(language) ? Locale.GERMAN : Locale.ENGLISH;
            this.bundle = ResourceBundle.getBundle("i18n.messages", locale);
            logger.debug("Language set to: {}", language);
        } catch (Exception e) {
            logger.warn("Could not load resource bundle for language: {}, using fallback", language, e);
            this.bundle = null;
        }
        
        // Save to config
        LinguaOpsApplication.getInstance().getConfigService().setLanguage(language);
    }

    public String getCurrentLanguage() {
        return currentLanguage;
    }

    public String getText(String key) {
        return getText(key, key);
    }

    public String getText(String key, String fallback) {
        try {
            if (bundle != null && bundle.containsKey(key)) {
                return bundle.getString(key);
            }
        } catch (Exception e) {
            logger.debug("Could not get translation for key: {}", key, e);
        }
        
        // Try fallback translations
        String fallbackValue = fallbackTranslations.get(key + "_" + currentLanguage);
        if (fallbackValue != null) {
            return fallbackValue;
        }
        
        return fallback;
    }

    public void updateUI(I18nController controller) {
        if (controller != null) {
            controller.updateTexts();
        }
    }

    private Map<String, String> createFallbackTranslations() {
        Map<String, String> translations = new HashMap<>();
        
        // Navigation
        translations.put("home_de", "Start");
        translations.put("home_en", "Home");
        translations.put("history_de", "Verlauf");
        translations.put("history_en", "History");
        translations.put("settings_de", "Einstellungen");
        translations.put("settings_en", "Settings");
        translations.put("orders_de", "Bestellungen");
        translations.put("orders_en", "Orders");
        translations.put("telcArea_de", "telc Bereich");
        translations.put("telcArea_en", "Telc Area");
        translations.put("manageParticipants_de", "Teilnehmer verwalten");
        translations.put("manageParticipants_en", "Manage Participants");
        translations.put("exams_de", "Prüfungen");
        translations.put("exams_en", "Exams");
        translations.put("needsAttention_de", "Braucht Aufmerksamkeit");
        translations.put("needsAttention_en", "Needs Attention");
        
        // Buttons and Actions
        translations.put("newOrders_de", "Neue Bestellungen");
        translations.put("newOrders_en", "New Orders");
        translations.put("searchOrders_de", "Bestellungen suchen");
        translations.put("searchOrders_en", "Search Orders");
        translations.put("export_de", "Exportieren");
        translations.put("export_en", "Export");
        translations.put("openWebsite_de", "Website öffnen");
        translations.put("openWebsite_en", "Open Website");
        translations.put("back_de", "Zurück");
        translations.put("back_en", "Back");
        translations.put("notifications_de", "Mitteilungen");
        translations.put("notifications_en", "Notifications");
        translations.put("light_de", "Hell");
        translations.put("light_en", "Light");
        translations.put("dark_de", "Dunkel");
        translations.put("dark_en", "Dark");
        
        // Form and Dialog
        translations.put("addPerson_de", "Person hinzufügen");
        translations.put("addPerson_en", "Add Person");
        translations.put("orderNumber_de", "Bestellnummer");
        translations.put("orderNumber_en", "Order Number");
        translations.put("lastName_de", "Nachname");
        translations.put("lastName_en", "Last name");
        translations.put("firstName_de", "Vorname");
        translations.put("firstName_en", "First name");
        translations.put("email_de", "Email");
        translations.put("email_en", "Email");
        translations.put("phone_de", "Tel.Nr.");
        translations.put("phone_en", "Phone");
        translations.put("save_de", "Speichern");
        translations.put("save_en", "Save");
        translations.put("cancel_de", "Abbrechen");
        translations.put("cancel_en", "Cancel");
        
        // Messages
        translations.put("loading_de", "Laden...");
        translations.put("loading_en", "Loading...");
        translations.put("error_de", "Fehler");
        translations.put("error_en", "Error");
        translations.put("success_de", "Erfolgreich");
        translations.put("success_en", "Success");
        
        return translations;
    }
}
