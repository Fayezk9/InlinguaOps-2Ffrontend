package com.linguaops.desktop.controller;

import com.linguaops.desktop.LinguaOpsApplication;
import com.linguaops.desktop.service.I18nService;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URL;
import java.util.ResourceBundle;

public class HistoryControllerWebStyle implements Initializable, I18nController {
    private static final Logger logger = LoggerFactory.getLogger(HistoryControllerWebStyle.class);
    
    @FXML private Label historyTitle;
    @FXML private VBox historyList;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        loadHistoryItems();
        updateTexts();
        logger.debug("HistoryControllerWebStyle initialized");
    }

    private void loadHistoryItems() {
        // TODO: Load actual history items
        historyList.getChildren().clear();
        
        // Add some placeholder items
        for (int i = 1; i <= 5; i++) {
            Label historyItem = new Label("History item " + i);
            historyItem.getStyleClass().add("text-secondary-dark");
            historyList.getChildren().add(historyItem);
        }
    }

    @FXML
    private void refreshHistory() {
        logger.debug("Refresh history");
        loadHistoryItems();
    }

    @FXML
    private void clearHistory() {
        logger.debug("Clear history");
        historyList.getChildren().clear();
        
        Label emptyLabel = new Label("History cleared");
        emptyLabel.getStyleClass().add("text-secondary-dark");
        historyList.getChildren().add(emptyLabel);
    }

    @Override
    public void updateTexts() {
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app == null) return;
        
        I18nService i18n = app.getI18nService();
        historyTitle.setText(i18n.getText("history"));
    }
}
