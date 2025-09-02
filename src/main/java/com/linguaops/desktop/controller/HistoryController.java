package com.linguaops.desktop.controller;

import com.linguaops.desktop.LinguaOpsApplication;
import com.linguaops.desktop.service.I18nService;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URL;
import java.util.ResourceBundle;

public class HistoryController implements Initializable, I18nController {
    private static final Logger logger = LoggerFactory.getLogger(HistoryController.class);
    
    @FXML private Label titleLabel;
    @FXML private Label noActivityLabel;
    @FXML private Button clearButton;
    @FXML private ScrollPane historyScrollPane;
    @FXML private VBox historyContainer;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        updateTexts();
        loadHistory();
        logger.debug("HistoryController initialized");
    }

    private void loadHistory() {
        // TODO: Load actual history from service
        // For now, show no activity message
        boolean hasHistory = false;
        
        noActivityLabel.setVisible(!hasHistory);
        historyScrollPane.setVisible(hasHistory);
        clearButton.setDisable(!hasHistory);
    }

    @FXML
    private void clearHistory() {
        logger.debug("Clear history clicked");
        
        // TODO: Implement clear history functionality
        historyContainer.getChildren().clear();
        loadHistory();
    }

    @Override
    public void updateTexts() {
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app == null) return;
        
        I18nService i18n = app.getI18nService();
        
        titleLabel.setText(i18n.getText("history"));
        clearButton.setText(i18n.getText("clear", "Clear"));
        noActivityLabel.setText(i18n.getText("noRecentActivity", "No recent activity yet."));
    }
}
