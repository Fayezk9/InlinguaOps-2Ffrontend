package com.linguaops.desktop.controller;

import com.linguaops.desktop.LinguaOpsApplication;
import com.linguaops.desktop.service.I18nService;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.*;
import javafx.scene.layout.VBox;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URL;
import java.util.ResourceBundle;

public class SettingsControllerWebStyle implements Initializable, I18nController {
    private static final Logger logger = LoggerFactory.getLogger(SettingsControllerWebStyle.class);
    
    // Header
    @FXML private Label settingsTitle;
    
    // Navigation buttons
    @FXML private Button languageButton;
    @FXML private Button googleSheetsButton;
    @FXML private Button ordersSettingsButton;
    @FXML private Button examsSettingsButton;
    @FXML private Button emailsButton;
    @FXML private Button backgroundButton;
    
    // Settings Panel
    @FXML private VBox settingsPanel;
    @FXML private Label panelTitle;
    @FXML private VBox panelContent;
    
    // Language Section
    @FXML private VBox languageContent;
    @FXML private Button germanButton;
    @FXML private Button englishButton;
    
    // Google Sheets Section
    @FXML private VBox googleSheetsContent;
    @FXML private TextField sheetUrlField;
    @FXML private TextField serviceEmailField;
    @FXML private TextArea privateKeyArea;
    
    // Default content
    @FXML private VBox defaultContent;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        updateTexts();
        logger.debug("SettingsControllerWebStyle initialized");
    }

    @FXML
    private void showLanguageSection() {
        showPanel("language", "Sprache");
        hideAllContent();
        languageContent.setVisible(true);
        languageContent.setManaged(true);
        updateLanguageButtons();
    }

    @FXML
    private void showGoogleSheetsSection() {
        showPanel("googleSheets", "Google Sheets");
        hideAllContent();
        googleSheetsContent.setVisible(true);
        googleSheetsContent.setManaged(true);
        loadGoogleSheetsData();
    }

    @FXML
    private void showOrdersSection() {
        showPanel("orders", "Bestellungen");
        hideAllContent();
        defaultContent.setVisible(true);
        defaultContent.setManaged(true);
    }

    @FXML
    private void showExamsSection() {
        showPanel("exams", "Prüfungsverwaltung");
        hideAllContent();
        defaultContent.setVisible(true);
        defaultContent.setManaged(true);
    }

    @FXML
    private void showEmailsSection() {
        showPanel("emails", "Emails");
        hideAllContent();
        defaultContent.setVisible(true);
        defaultContent.setManaged(true);
    }

    @FXML
    private void showBackgroundSection() {
        showPanel("background", "Hintergrundfoto");
        hideAllContent();
        defaultContent.setVisible(true);
        defaultContent.setManaged(true);
    }

    @FXML
    private void hidePanel() {
        settingsPanel.setVisible(false);
        settingsPanel.setManaged(false);
    }

    private void showPanel(String section, String title) {
        panelTitle.setText(title);
        settingsPanel.setVisible(true);
        settingsPanel.setManaged(true);
    }

    private void hideAllContent() {
        languageContent.setVisible(false);
        languageContent.setManaged(false);
        googleSheetsContent.setVisible(false);
        googleSheetsContent.setManaged(false);
        defaultContent.setVisible(false);
        defaultContent.setManaged(false);
    }

    // Language methods
    @FXML
    private void setGerman() {
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app != null) {
            app.getI18nService().setLanguage("de");
            updateLanguageButtons();
        }
    }

    @FXML
    private void setEnglish() {
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app != null) {
            app.getI18nService().setLanguage("en");
            updateLanguageButtons();
        }
    }

    private void updateLanguageButtons() {
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app == null) return;
        
        String currentLang = app.getI18nService().getCurrentLanguage();
        
        germanButton.getStyleClass().removeAll("primary-button-dark", "outline-button-dark");
        englishButton.getStyleClass().removeAll("primary-button-dark", "outline-button-dark");
        
        if ("de".equals(currentLang)) {
            germanButton.getStyleClass().add("primary-button-dark");
            englishButton.getStyleClass().add("outline-button-dark");
        } else {
            germanButton.getStyleClass().add("outline-button-dark");
            englishButton.getStyleClass().add("primary-button-dark");
        }
    }

    // Google Sheets methods
    private void loadGoogleSheetsData() {
        // Load current Google Sheets configuration
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app != null) {
            try {
                String savedUrl = app.getConfigService().getProperty("telcSheetUrl", "");
                String savedEmail = app.getConfigService().getProperty("telcSaEmail", "");
                
                sheetUrlField.setText(savedUrl);
                serviceEmailField.setText(savedEmail);
                privateKeyArea.setText(""); // Don't store/show private key
            } catch (Exception e) {
                logger.warn("Could not load Google Sheets configuration", e);
            }
        }
    }

    @FXML
    private void saveGoogleSheets() {
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app != null) {
            try {
                String url = sheetUrlField.getText().trim();
                String email = serviceEmailField.getText().trim();
                String privateKey = privateKeyArea.getText().trim();
                
                if (!url.isEmpty()) {
                    app.getConfigService().setProperty("telcSheetUrl", url);
                }
                if (!email.isEmpty()) {
                    app.getConfigService().setProperty("telcSaEmail", email);
                }
                
                // Note: In a real implementation, you would securely store the private key
                // or send it to an API endpoint
                
                logger.info("Google Sheets configuration saved");
                
                // Show success message
                Alert alert = new Alert(Alert.AlertType.INFORMATION);
                alert.setTitle("Erfolgreich");
                alert.setHeaderText(null);
                alert.setContentText("Google Sheets Konfiguration wurde gespeichert.");
                alert.showAndWait();
                
                hidePanel();
                
            } catch (Exception e) {
                logger.error("Could not save Google Sheets configuration", e);
                
                Alert alert = new Alert(Alert.AlertType.ERROR);
                alert.setTitle("Fehler");
                alert.setHeaderText(null);
                alert.setContentText("Fehler beim Speichern der Konfiguration: " + e.getMessage());
                alert.showAndWait();
            }
        }
    }

    @Override
    public void updateTexts() {
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app == null) return;
        
        I18nService i18n = app.getI18nService();
        
        // Update button texts
        settingsTitle.setText(i18n.getText("settings"));
        languageButton.setText(i18n.getText("language", "Sprache"));
        googleSheetsButton.setText("Google Sheets");
        ordersSettingsButton.setText(i18n.getText("orders"));
        examsSettingsButton.setText("Prüfungsverwaltung");
        emailsButton.setText("Emails");
        backgroundButton.setText("Hintergrundfoto");
    }
}
