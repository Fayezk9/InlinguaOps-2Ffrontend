package com.linguaops.desktop.controller;

import com.linguaops.desktop.LinguaOpsApplication;
import com.linguaops.desktop.service.I18nService;
import javafx.animation.FadeTransition;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URL;
import java.util.ResourceBundle;

public class IndexControllerWebStyle implements Initializable, I18nController {
    private static final Logger logger = LoggerFactory.getLogger(IndexControllerWebStyle.class);
    
    // Sidebar Navigation
    @FXML private Button telcButton;
    @FXML private Button ordersButton;
    @FXML private Button participantsButton;
    @FXML private Button examsButton;
    @FXML private Button needsAttentionButton;
    
    // Labels
    @FXML private Label telcLabel;
    @FXML private Label ordersLabel;
    @FXML private Label participantsLabel;
    @FXML private Label examsLabel;
    @FXML private Label needsAttentionLabel;
    
    // Hero content
    @FXML private ImageView heroImage;
    @FXML private VBox heroOverlay;
    @FXML private VBox heroHoverOverlay;
    @FXML private Label heroTextLarge;
    @FXML private Label heroTextSmall;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        setupHeroImage();
        setupHoverEffects();
        updateTexts();
        logger.debug("IndexControllerWebStyle initialized");
    }

    private void setupHeroImage() {
        try {
            // Try to load the hero image from the same URL as web app
            String imageUrl = "https://cdn.builder.io/api/v1/image/assets%2Fd5ceaaf188a440b69293546711d11d26%2F90c62cb03a824279b621dcd43fc885ca?format=webp&width=800";
            Image hero = new Image(imageUrl, true); // background loading
            
            // Set up error handling
            hero.errorProperty().addListener((observable, oldValue, newValue) -> {
                if (newValue) {
                    logger.debug("Hero image failed to load, showing text fallback");
                    heroImage.setVisible(false);
                    heroOverlay.setVisible(true);
                    heroOverlay.setOpacity(1.0);
                }
            });
            
            // Set up success handling
            hero.progressProperty().addListener((observable, oldValue, newValue) -> {
                if (newValue.doubleValue() >= 1.0 && !hero.isError()) {
                    logger.debug("Hero image loaded successfully");
                    heroImage.setVisible(true);
                    heroOverlay.setVisible(false);
                    setupImageHoverEffect();
                }
            });
            
            heroImage.setImage(hero);
            
            // If image is already cached and loaded immediately
            if (!hero.isError() && hero.getProgress() >= 1.0) {
                heroImage.setVisible(true);
                heroOverlay.setVisible(false);
                setupImageHoverEffect();
            } else {
                // Show text fallback initially while loading
                heroOverlay.setVisible(true);
                heroOverlay.setOpacity(1.0);
            }
            
        } catch (Exception e) {
            logger.debug("Could not setup hero image: {}", e.getMessage());
            // Show text fallback
            heroImage.setVisible(false);
            heroOverlay.setVisible(true);
            heroOverlay.setOpacity(1.0);
        }
    }
    
    private void setupImageHoverEffect() {
        if (heroImage.isVisible()) {
            // Set up hover effect that shows overlay on image hover
            heroImage.setOnMouseEntered(e -> {
                heroHoverOverlay.setVisible(true);
                FadeTransition fadeIn = new FadeTransition(Duration.millis(300), heroHoverOverlay);
                fadeIn.setFromValue(0.0);
                fadeIn.setToValue(1.0);
                fadeIn.play();
            });
            
            heroImage.setOnMouseExited(e -> {
                FadeTransition fadeOut = new FadeTransition(Duration.millis(300), heroHoverOverlay);
                fadeOut.setFromValue(1.0);
                fadeOut.setToValue(0.0);
                fadeOut.setOnFinished(event -> heroHoverOverlay.setVisible(false));
                fadeOut.play();
            });
        }
    }

    private void setupHoverEffects() {
        // Add hover effects to sidebar buttons
        setupButtonHover(telcButton);
        setupButtonHover(ordersButton);
        setupButtonHover(participantsButton);
        setupButtonHover(examsButton);
        setupButtonHover(needsAttentionButton);
    }
    
    private void setupButtonHover(Button button) {
        button.setOnMouseEntered(e -> {
            button.setScaleX(1.02);
            button.setScaleY(1.02);
        });
        
        button.setOnMouseExited(e -> {
            button.setScaleX(1.0);
            button.setScaleY(1.0);
        });
    }

    // Navigation Methods
    @FXML
    private void navigateToTelc() {
        logger.debug("Navigate to Telc area");
        updateActiveState(telcButton);
        
        // In a real implementation, this would navigate via main controller
        // For now, we'll use the web app approach - route navigation
        try {
            // Try to get main controller and navigate
            MainControllerWebStyle mainController = getMainController();
            if (mainController != null) {
                // TODO: Implement telc page navigation
                logger.debug("Would navigate to telc page");
            }
        } catch (Exception e) {
            logger.error("Failed to navigate to telc page", e);
        }
    }

    @FXML
    private void navigateToOrders() {
        logger.debug("Navigate to Orders");
        updateActiveState(ordersButton);
        
        try {
            MainControllerWebStyle mainController = getMainController();
            if (mainController != null) {
                // TODO: Implement orders page navigation
                logger.debug("Would navigate to orders page");
            }
        } catch (Exception e) {
            logger.error("Failed to navigate to orders page", e);
        }
    }

    @FXML
    private void navigateToParticipants() {
        logger.debug("Navigate to Participants");
        updateActiveState(participantsButton);
        
        try {
            MainControllerWebStyle mainController = getMainController();
            if (mainController != null) {
                mainController.navigateToParticipants();
            }
        } catch (Exception e) {
            logger.error("Failed to navigate to participants page", e);
        }
    }

    @FXML
    private void navigateToExams() {
        logger.debug("Navigate to Exams");
        updateActiveState(examsButton);
        
        try {
            MainControllerWebStyle mainController = getMainController();
            if (mainController != null) {
                // TODO: Implement exams page navigation
                logger.debug("Would navigate to exams page");
            }
        } catch (Exception e) {
            logger.error("Failed to navigate to exams page", e);
        }
    }

    @FXML
    private void showNeedsAttention() {
        logger.debug("Show needs attention");
        try {
            MainControllerWebStyle mainController = getMainController();
            if (mainController != null) {
                // TODO: Implement needs attention page navigation
                logger.debug("Would navigate to needs attention page");
            }
        } catch (Exception e) {
            logger.error("Failed to navigate to needs attention page", e);
        }
    }

    private void updateActiveState(Button activeButton) {
        // Remove active state from all buttons
        telcButton.getStyleClass().removeAll("sidebar-button-active");
        ordersButton.getStyleClass().removeAll("sidebar-button-active");
        participantsButton.getStyleClass().removeAll("sidebar-button-active");
        examsButton.getStyleClass().removeAll("sidebar-button-active");
        
        // Add active state to clicked button
        if (!activeButton.getStyleClass().contains("sidebar-button-active")) {
            activeButton.getStyleClass().add("sidebar-button-active");
        }
    }

    private MainControllerWebStyle getMainController() {
        // Helper method to get the main controller for navigation
        try {
            LinguaOpsApplication app = LinguaOpsApplication.getInstance();
            if (app != null && app.getPrimaryStage() != null) {
                // Get the main controller from the scene's root userData
                Object userData = app.getPrimaryStage().getScene().getRoot().getUserData();
                if (userData instanceof MainControllerWebStyle) {
                    return (MainControllerWebStyle) userData;
                }
                
                // Alternative: Try to find it through the scene
                // This is a simplified approach for demo purposes
                return null;
            }
        } catch (Exception e) {
            logger.debug("Could not get main controller", e);
        }
        return null;
    }

    @Override
    public void updateTexts() {
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app == null) return;
        
        I18nService i18n = app.getI18nService();
        
        // Update sidebar labels
        telcLabel.setText(i18n.getText("telcArea"));
        ordersLabel.setText(i18n.getText("orders"));
        participantsLabel.setText(i18n.getText("manageParticipants"));
        examsLabel.setText(i18n.getText("exams"));
        needsAttentionLabel.setText(i18n.getText("needsAttention"));
        
        // Update hero text
        heroTextLarge.setText("inlingua®");
        heroTextSmall.setText("... um mit der Welt sprechen zu können.");
    }
}
