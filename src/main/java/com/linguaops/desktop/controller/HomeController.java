package com.linguaops.desktop.controller;

import com.linguaops.desktop.LinguaOpsApplication;
import com.linguaops.desktop.service.I18nService;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URL;
import java.util.ResourceBundle;

public class HomeController implements Initializable, I18nController {
    private static final Logger logger = LoggerFactory.getLogger(HomeController.class);
    
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
    @FXML private Label heroOverlay;
    
    // Icons
    @FXML private ImageView telcIcon;
    @FXML private ImageView ordersIcon;
    @FXML private ImageView participantsIcon;
    @FXML private ImageView examsIcon;
    @FXML private ImageView heroImage;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        // Set up fallback content first
        if (heroOverlay != null) {
            heroOverlay.setText("inlingua®\n... um mit der Welt sprechen zu können.");
            heroOverlay.setVisible(true);
        }

        setupIcons();
        setupHeroImage();
        updateTexts();
        logger.debug("HomeController initialized with hero content");
    }

    private void setupIcons() {
        try {
            // Load icons (using placeholder for now, can be replaced with actual icons)
            setIcon(telcIcon, "/images/icons/home.png");
            setIcon(ordersIcon, "/images/icons/plus-circle.png");
            setIcon(participantsIcon, "/images/icons/check-circle.png");
            setIcon(examsIcon, "/images/icons/file-text.png");
        } catch (Exception e) {
            logger.debug("Could not load navigation icons: {}", e.getMessage());
        }

        // Ensure icons are visible (even if images failed to load)
        ensureIconsVisible();
    }

    private void setIcon(ImageView imageView, String path) {
        try {
            Image icon = new Image(getClass().getResourceAsStream(path));
            imageView.setImage(icon);
        } catch (Exception e) {
            // Create a simple colored rectangle as fallback
            imageView.setImage(null);
            logger.debug("Could not load icon from path: {}", path);
        }
    }

    private void ensureIconsVisible() {
        // Make sure icon containers are visible even without images
        if (telcIcon != null) telcIcon.setVisible(true);
        if (ordersIcon != null) ordersIcon.setVisible(true);
        if (participantsIcon != null) participantsIcon.setVisible(true);
        if (examsIcon != null) examsIcon.setVisible(true);
    }

    private void setupHeroImage() {
        try {
            // Try to load the hero image
            String imageUrl = "https://cdn.builder.io/api/v1/image/assets%2Fd5ceaaf188a440b69293546711d11d26%2F90c62cb03a824279b621dcd43fc885ca?format=webp&width=800";
            Image hero = new Image(imageUrl, true); // background loading

            // Set up error handling
            hero.errorProperty().addListener((observable, oldValue, newValue) -> {
                if (newValue) {
                    logger.debug("Hero image failed to load, showing fallback");
                    heroImage.setVisible(false);
                    heroOverlay.setVisible(true);
                    heroOverlay.setText("inlingua®\n... um mit der Welt sprechen zu können.");
                }
            });

            // Set up success handling
            hero.progressProperty().addListener((observable, oldValue, newValue) -> {
                if (newValue.doubleValue() >= 1.0) {
                    logger.debug("Hero image loaded successfully");
                    heroImage.setVisible(true);
                    heroOverlay.setVisible(false);
                }
            });

            heroImage.setImage(hero);

            // If image is already cached and loaded immediately
            if (!hero.isError() && hero.getProgress() >= 1.0) {
                heroImage.setVisible(true);
                heroOverlay.setVisible(false);
            } else {
                // Show fallback initially while loading
                heroOverlay.setVisible(true);
                heroOverlay.setText("inlingua®\n... um mit der Welt sprechen zu können.");
            }

        } catch (Exception e) {
            logger.debug("Could not setup hero image: {}", e.getMessage());
            // Show overlay text as fallback
            heroImage.setVisible(false);
            heroOverlay.setVisible(true);
            heroOverlay.setText("inlingua®\n... um mit der Welt sprechen zu können.");
        }
    }

    // Navigation Methods
    @FXML
    private void navigateToTelc() {
        logger.debug("Navigate to Telc area");
        // In a real implementation, this would trigger navigation in the main controller
        // For now, we'll just update the active state
        updateActiveState(telcButton);
    }

    @FXML
    private void navigateToOrders() {
        logger.debug("Navigate to Orders");
        updateActiveState(ordersButton);
        
        // Navigate to orders page via main controller
        try {
            MainController mainController = getMainController();
            if (mainController != null) {
                mainController.navigateToOrdersPublic();
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
            MainController mainController = getMainController();
            if (mainController != null) {
                mainController.navigateToParticipantsPublic();
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
            MainController mainController = getMainController();
            if (mainController != null) {
                mainController.navigateToExamsPublic();
            }
        } catch (Exception e) {
            logger.error("Failed to navigate to exams page", e);
        }
    }

    @FXML
    private void showNeedsAttention() {
        logger.debug("Show needs attention");
        // TODO: Implement needs attention functionality
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

    private MainController getMainController() {
        // Helper method to get the main controller for navigation
        // This is a simplified approach - in a more complex app, you'd use a navigation service
        try {
            LinguaOpsApplication app = LinguaOpsApplication.getInstance();
            if (app != null && app.getPrimaryStage() != null) {
                // Get the main controller from the scene's root
                Object userData = app.getPrimaryStage().getScene().getRoot().getUserData();
                if (userData instanceof MainController) {
                    return (MainController) userData;
                }
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
    }
}
