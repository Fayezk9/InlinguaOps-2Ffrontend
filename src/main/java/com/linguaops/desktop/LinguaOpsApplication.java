package com.linguaops.desktop;

import com.linguaops.desktop.controller.MainController;
import com.linguaops.desktop.service.ConfigurationService;
import com.linguaops.desktop.service.I18nService;
import com.linguaops.desktop.service.ThemeService;
import javafx.application.Application;
import javafx.fxml.FXMLLoader;
import javafx.scene.Scene;
import javafx.scene.image.Image;
import javafx.stage.Stage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

public class LinguaOpsApplication extends Application {
    private static final Logger logger = LoggerFactory.getLogger(LinguaOpsApplication.class);
    
    private static LinguaOpsApplication instance;
    private Stage primaryStage;
    private Scene scene;
    private MainController mainController;
    
    // Services
    private final ConfigurationService configService = new ConfigurationService();
    private final I18nService i18nService = new I18nService();
    private final ThemeService themeService = new ThemeService();

    @Override
    public void init() throws Exception {
        super.init();
        instance = this;
        
        // Initialize services
        configService.initialize();
        i18nService.initialize();
        themeService.initialize();
        
        logger.info("LinguaOps Desktop Application initialized");
    }

    @Override
    public void start(Stage stage) throws IOException {
        this.primaryStage = stage;

        FXMLLoader fxmlLoader = new FXMLLoader(
            LinguaOpsApplication.class.getResource("/fxml/main-webapp-style.fxml")
        );

        scene = new Scene(fxmlLoader.load(), 1200, 800);
        Object controller = fxmlLoader.getController();

        // Handle both old and new controller types
        if (controller instanceof MainControllerWebStyle) {
            MainControllerWebStyle webStyleController = (MainControllerWebStyle) controller;
            webStyleController.setApplication(this);
            // Store for getUserData access pattern
            scene.getRoot().setUserData(webStyleController);
        } else if (controller instanceof MainController) {
            mainController = (MainController) controller;
            mainController.setApplication(this);
        }

        // Apply current theme
        themeService.applyTheme(scene);

        // Apply current language if using old controller
        if (mainController != null) {
            i18nService.updateUI(mainController);
        }

        stage.setTitle("LinguaOps - Desktop Application");
        stage.setScene(scene);
        stage.setMinWidth(1000);
        stage.setMinHeight(700);

        // Set application icon
        try {
            Image icon = new Image(getClass().getResourceAsStream("/images/icon.png"));
            stage.getIcons().add(icon);
        } catch (Exception e) {
            logger.warn("Could not load application icon: {}", e.getMessage());
        }

        stage.show();

        logger.info("LinguaOps Desktop Application (WebApp Style) started");
    }

    @Override
    public void stop() throws Exception {
        super.stop();
        configService.save();
        logger.info("LinguaOps Desktop Application stopped");
    }

    // Getters for services
    public ConfigurationService getConfigService() { return configService; }
    public I18nService getI18nService() { return i18nService; }
    public ThemeService getThemeService() { return themeService; }
    public Scene getScene() { return scene; }
    public Stage getPrimaryStage() { return primaryStage; }
    
    public static LinguaOpsApplication getInstance() { return instance; }

    public static void main(String[] args) {
        launch(args);
    }
}
