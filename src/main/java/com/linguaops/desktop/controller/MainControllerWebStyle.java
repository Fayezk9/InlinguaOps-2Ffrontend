package com.linguaops.desktop.controller;

import com.linguaops.desktop.LinguaOpsApplication;
import com.linguaops.desktop.service.I18nService;
import com.linguaops.desktop.service.ThemeService;
import javafx.animation.FadeTransition;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.fxml.Initializable;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Circle;
import javafx.util.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URL;
import java.util.ResourceBundle;

public class MainControllerWebStyle implements Initializable, I18nController {
    private static final Logger logger = LoggerFactory.getLogger(MainControllerWebStyle.class);
    
    private LinguaOpsApplication application;
    private String currentPage = "home";
    
    // Header Components
    @FXML private HBox centralNavigation;
    @FXML private Button backButton;
    @FXML private Label backLabel;
    @FXML private Button homeButton;
    @FXML private Button historyButton;
    @FXML private Button settingsButton;
    @FXML private Circle historyDot;
    
    // Language Controls
    @FXML private Button deButton;
    @FXML private Button enButton;
    
    // Notification
    @FXML private Button notificationButton;
    @FXML private Circle notificationDot;
    
    // Theme Controls
    @FXML private StackPane themeControlsContainer;
    @FXML private HBox themeControls;
    @FXML private Button lightThemeButton;
    @FXML private Button darkThemeButton;
    
    // Content Area
    @FXML private StackPane mainContentArea;
    @FXML private StackPane pageContainer;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        setupInitialState();
        setupEventHandlers();
        logger.debug("MainControllerWebStyle initialized");
    }

    public void setApplication(LinguaOpsApplication application) {
        this.application = application;
        updateTexts();
        updateThemeButtons();
        updateLanguageButtons();
        
        // Load initial page
        Platform.runLater(() -> navigateToHome());
    }

    private void setupInitialState() {
        // Set initial navigation button states
        updateNavigationState();
        
        // Show theme controls only on home page
        updateThemeControlsVisibility();
    }

    private void setupEventHandlers() {
        // History dot visibility (will be updated by history service)
        historyDot.setVisible(false);
        notificationDot.setVisible(false);
    }

    // Navigation Methods
    @FXML
    private void navigateToHome() {
        loadPage("home", "/fxml/pages/index-webapp-style.fxml");
    }

    @FXML
    private void navigateToHistory() {
        loadPage("history", "/fxml/pages/history-webapp-style.fxml");
        // Hide history dot when visiting history page
        historyDot.setVisible(false);
    }

    @FXML
    private void navigateToSettings() {
        loadPage("settings", "/fxml/pages/settings-webapp-style.fxml");
    }

    public void navigateToParticipants() {
        loadPage("participants", "/fxml/pages/participants-webapp-style.fxml");
    }
    
    @FXML
    private void navigateBack() {
        // Navigate back to home or previous page
        navigateToHome();
    }

    private void loadPage(String pageName, String fxmlPath) {
        try {
            FXMLLoader loader = new FXMLLoader(getClass().getResource(fxmlPath));
            Node page = loader.load();
            
            // Get controller if it implements I18nController
            Object controller = loader.getController();
            if (controller instanceof I18nController) {
                ((I18nController) controller).updateTexts();
            }
            
            // Fade transition
            if (!pageContainer.getChildren().isEmpty()) {
                FadeTransition fadeOut = new FadeTransition(Duration.millis(150), pageContainer);
                fadeOut.setFromValue(1.0);
                fadeOut.setToValue(0.0);
                fadeOut.setOnFinished(e -> {
                    pageContainer.getChildren().clear();
                    pageContainer.getChildren().add(page);
                    
                    FadeTransition fadeIn = new FadeTransition(Duration.millis(300), pageContainer);
                    fadeIn.setFromValue(0.0);
                    fadeIn.setToValue(1.0);
                    fadeIn.play();
                });
                fadeOut.play();
            } else {
                pageContainer.getChildren().add(page);
            }
            
            currentPage = pageName;
            updateNavigationState();
            updateThemeControlsVisibility();
            updateBackButtonVisibility();
            
            logger.debug("Navigated to page: {}", pageName);
            
        } catch (IOException e) {
            logger.error("Failed to load page: {}", pageName, e);
            // Show error fallback
            showErrorPage(pageName);
        }
    }

    private void showErrorPage(String pageName) {
        Label errorLabel = new Label("Page not found: " + pageName);
        errorLabel.getStyleClass().add("error-message");
        pageContainer.getChildren().clear();
        pageContainer.getChildren().add(errorLabel);
    }

    private void updateNavigationState() {
        // Update navigation button states
        homeButton.getStyleClass().removeAll("nav-button-active");
        historyButton.getStyleClass().removeAll("nav-button-active");
        settingsButton.getStyleClass().removeAll("nav-button-active");
        
        switch (currentPage) {
            case "home" -> homeButton.getStyleClass().add("nav-button-active");
            case "history" -> historyButton.getStyleClass().add("nav-button-active");
            case "settings" -> settingsButton.getStyleClass().add("nav-button-active");
            case "participants" -> { /* keep header nav highlighting, sidebar handles active */ }
        }
    }
    
    private void updateBackButtonVisibility() {
        boolean showBack = !currentPage.equals("home");
        backButton.setVisible(showBack);
        backButton.setManaged(showBack);
    }
    
    private void updateThemeControlsVisibility() {
        boolean showThemeControls = currentPage.equals("home");
        themeControlsContainer.setVisible(showThemeControls);
        themeControlsContainer.setManaged(showThemeControls);
    }

    // Language Methods
    @FXML
    private void setLanguageGerman() {
        if (application != null) {
            application.getI18nService().setLanguage("de");
            updateTexts();
            updateLanguageButtons();
        }
    }

    @FXML
    private void setLanguageEnglish() {
        if (application != null) {
            application.getI18nService().setLanguage("en");
            updateTexts();
            updateLanguageButtons();
        }
    }

    private void updateLanguageButtons() {
        if (application == null) return;
        
        String currentLang = application.getI18nService().getCurrentLanguage();
        
        deButton.getStyleClass().removeAll("lang-button-active");
        enButton.getStyleClass().removeAll("lang-button-active");
        
        if ("de".equals(currentLang)) {
            deButton.getStyleClass().add("lang-button-active");
        } else {
            enButton.getStyleClass().add("lang-button-active");
        }
    }

    // Theme Methods
    @FXML
    private void setLightTheme() {
        if (application != null) {
            application.getThemeService().setTheme(ThemeService.Theme.LIGHT);
            updateThemeButtons();
        }
    }

    @FXML
    private void setDarkTheme() {
        if (application != null) {
            application.getThemeService().setTheme(ThemeService.Theme.DARK);
            updateThemeButtons();
        }
    }

    private void updateThemeButtons() {
        if (application == null) return;
        
        ThemeService.Theme currentTheme = application.getThemeService().getCurrentTheme();
        
        lightThemeButton.getStyleClass().removeAll("theme-button-active");
        darkThemeButton.getStyleClass().removeAll("theme-button-active");
        
        if (currentTheme == ThemeService.Theme.LIGHT) {
            lightThemeButton.getStyleClass().add("theme-button-active");
        } else {
            darkThemeButton.getStyleClass().add("theme-button-active");
        }
    }

    // Other Actions
    @FXML
    private void showNotifications() {
        // TODO: Implement notifications popup
        logger.debug("Show notifications clicked");
        // For now, hide the notification dot when clicked
        notificationDot.setVisible(false);
    }

    // History notification methods
    public void showHistoryNotification() {
        historyDot.setVisible(true);
    }

    public void hideHistoryNotification() {
        historyDot.setVisible(false);
    }
    
    // Notification methods
    public void showNotificationDot() {
        notificationDot.setVisible(true);
    }
    
    public void hideNotificationDot() {
        notificationDot.setVisible(false);
    }

    @Override
    public void updateTexts() {
        if (application == null) return;
        
        I18nService i18n = application.getI18nService();
        
        // Update navigation texts
        homeButton.setText(i18n.getText("home"));
        historyButton.setText(i18n.getText("history"));
        settingsButton.setText(i18n.getText("settings"));
        backLabel.setText(i18n.getText("back"));
        
        // Update theme button texts
        lightThemeButton.setText(i18n.getText("light"));
        darkThemeButton.setText(i18n.getText("dark"));
    }
}
