package com.linguaops.desktop.controller;

import com.linguaops.desktop.LinguaOpsApplication;
import com.linguaops.desktop.service.ConfigurationService;
import com.linguaops.desktop.service.I18nService;
import javafx.application.Platform;
import javafx.concurrent.Task;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.*;
import javafx.scene.layout.VBox;
import javafx.stage.FileChooser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.awt.Desktop;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.ResourceBundle;

public class OrdersController implements Initializable, I18nController {
    private static final Logger logger = LoggerFactory.getLogger(OrdersController.class);
    
    @FXML private Label titleLabel;
    @FXML private Label placeholderLabel;
    @FXML private Label statusLabel;
    @FXML private Label resultsLabel;
    
    @FXML private Button newOrdersButton;
    @FXML private Button searchOrdersButton;
    @FXML private Button exportButton;
    @FXML private Button openWebsiteButton;
    
    @FXML private VBox statusArea;
    @FXML private VBox resultsArea;
    @FXML private VBox resultsContainer;
    @FXML private ScrollPane resultsScrollPane;
    @FXML private ProgressIndicator progressIndicator;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        updateButtonStates();
        updateTexts();
        logger.debug("OrdersController initialized");
    }

    private void updateButtonStates() {
        // Update export button state based on available data
        boolean hasExportData = hasOrdersData();
        exportButton.setDisable(!hasExportData);
        
        // Update open website button state based on configured URL
        boolean canOpenWebsite = hasWebsiteUrl();
        openWebsiteButton.setDisable(!canOpenWebsite);
    }

    private boolean hasOrdersData() {
        // Check if there's any orders data available for export
        // This would typically check a local data store or cache
        return true; // Placeholder - always enabled for demo
    }

    private boolean hasWebsiteUrl() {
        ConfigurationService config = LinguaOpsApplication.getInstance().getConfigService();
        String url = config.getOrdersWebsiteUrl();
        return url != null && !url.trim().isEmpty();
    }

    @FXML
    private void handleNewOrders() {
        logger.debug("New Orders button clicked");
        
        showStatus("Ready to create or fetch new orders.");
        logActivity("orders_open", "Opened New Orders");
        
        // TODO: Implement new orders functionality
        // This might open a dialog or navigate to a form
        
        showAlert(Alert.AlertType.INFORMATION, "New Orders", "Ready to create or fetch new orders.");
    }

    @FXML
    private void handleSearchOrders() {
        logger.debug("Search Orders button clicked");
        
        // Show search dialog
        TextInputDialog dialog = new TextInputDialog();
        dialog.setTitle("Search Orders");
        dialog.setHeaderText("Search orders by ID or keyword:");
        dialog.setContentText("Enter search term:");
        
        Optional<String> result = dialog.showAndWait();
        result.ifPresent(searchTerm -> {
            if (!searchTerm.trim().isEmpty()) {
                performSearch(searchTerm.trim());
                logActivity("orders_search", "Searched orders: " + searchTerm);
            }
        });
    }

    private void performSearch(String searchTerm) {
        showStatus("Searching for: " + searchTerm);
        showProgress(true);
        
        // Simulate search operation
        Task<Void> searchTask = new Task<Void>() {
            @Override
            protected Void call() throws Exception {
                Thread.sleep(2000); // Simulate search delay
                return null;
            }
            
            @Override
            protected void succeeded() {
                Platform.runLater(() -> {
                    showProgress(false);
                    showStatus("Search completed");
                    showSearchResults(searchTerm);
                });
            }
            
            @Override
            protected void failed() {
                Platform.runLater(() -> {
                    showProgress(false);
                    showStatus("Search failed");
                });
            }
        };
        
        new Thread(searchTask).start();
    }

    private void showSearchResults(String searchTerm) {
        resultsContainer.getChildren().clear();
        
        // Add mock results
        for (int i = 1; i <= 3; i++) {
            Label resultLabel = new Label("Order " + (1000 + i) + " - Customer " + i);
            resultLabel.getStyleClass().add("result-item");
            resultsContainer.getChildren().add(resultLabel);
        }
        
        resultsArea.setVisible(true);
    }

    @FXML
    private void handleExport() {
        logger.debug("Export button clicked");
        
        FileChooser fileChooser = new FileChooser();
        fileChooser.setTitle("Export Orders");
        fileChooser.setInitialFileName("orders-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")) + ".csv");
        fileChooser.getExtensionFilters().add(
            new FileChooser.ExtensionFilter("CSV Files", "*.csv")
        );
        
        File file = fileChooser.showSaveDialog(exportButton.getScene().getWindow());
        if (file != null) {
            exportToCsv(file);
            logActivity("orders_export", "Exported orders CSV");
        }
    }

    private void exportToCsv(File file) {
        try (FileWriter writer = new FileWriter(file)) {
            // Write CSV header
            writer.write("date,orderId,status,customer\n");
            
            // Write sample data
            writer.write("2024-01-15,1001,completed,Customer 1\n");
            writer.write("2024-01-16,1002,pending,Customer 2\n");
            writer.write("2024-01-17,1003,completed,Customer 3\n");
            
            showAlert(Alert.AlertType.INFORMATION, "Export Complete", 
                "Orders exported successfully to " + file.getName());
            
        } catch (IOException e) {
            logger.error("Failed to export orders", e);
            showAlert(Alert.AlertType.ERROR, "Export Failed", 
                "Failed to export orders: " + e.getMessage());
        }
    }

    @FXML
    private void handleOpenWebsite() {
        logger.debug("Open Website button clicked");
        
        ConfigurationService config = LinguaOpsApplication.getInstance().getConfigService();
        String url = config.getOrdersWebsiteUrl();
        
        if (url == null || url.trim().isEmpty()) {
            // Prompt user to configure URL
            TextInputDialog dialog = new TextInputDialog();
            dialog.setTitle("Configure Website URL");
            dialog.setHeaderText("No website URL configured.");
            dialog.setContentText("Enter website URL:");
            
            Optional<String> result = dialog.showAndWait();
            result.ifPresent(newUrl -> {
                config.setOrdersWebsiteUrl(newUrl);
                config.save();
                openWebsite(newUrl);
            });
        } else {
            openWebsite(url);
        }
    }

    private void openWebsite(String url) {
        try {
            if (Desktop.isDesktopSupported()) {
                Desktop.getDesktop().browse(new URI(url));
                logActivity("orders_open_website", "Opened website: " + url);
            } else {
                showAlert(Alert.AlertType.WARNING, "Browser Not Supported", 
                    "Cannot open browser. Please visit: " + url);
            }
        } catch (Exception e) {
            logger.error("Failed to open website", e);
            showAlert(Alert.AlertType.ERROR, "Failed to Open Website", 
                "Could not open website: " + e.getMessage());
        }
    }

    private void showStatus(String message) {
        statusLabel.setText(message);
        statusArea.setVisible(true);
    }

    private void showProgress(boolean show) {
        progressIndicator.setVisible(show);
    }

    private void showAlert(Alert.AlertType type, String title, String message) {
        Alert alert = new Alert(type);
        alert.setTitle(title);
        alert.setHeaderText(null);
        alert.setContentText(message);
        alert.showAndWait();
    }

    private void logActivity(String type, String message) {
        try {
            ConfigurationService config = LinguaOpsApplication.getInstance().getConfigService();
            String user = config.getCurrentUserName();
            
            // TODO: Implement proper history logging service
            logger.info("Activity: {} - {} by {}", type, message, user);
            
        } catch (Exception e) {
            logger.debug("Could not log activity", e);
        }
    }

    @Override
    public void updateTexts() {
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app == null) return;
        
        I18nService i18n = app.getI18nService();
        
        titleLabel.setText(i18n.getText("orders"));
        newOrdersButton.setText(i18n.getText("newOrders"));
        searchOrdersButton.setText(i18n.getText("searchOrders"));
        exportButton.setText(i18n.getText("export"));
        openWebsiteButton.setText(i18n.getText("openWebsite"));
        
        // Update button states after text update
        updateButtonStates();
    }
}
