package com.linguaops.desktop.controller;

import com.linguaops.desktop.LinguaOpsApplication;
import com.linguaops.desktop.service.I18nService;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.Label;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URL;
import java.util.ResourceBundle;

public class TelcController implements Initializable, I18nController {
    private static final Logger logger = LoggerFactory.getLogger(TelcController.class);
    
    @FXML private Label titleLabel;
    @FXML private Label placeholderLabel;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        updateTexts();
        logger.debug("TelcController initialized");
    }

    @Override
    public void updateTexts() {
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app == null) return;
        
        I18nService i18n = app.getI18nService();
        
        titleLabel.setText(i18n.getText("telcArea"));
        placeholderLabel.setText(i18n.getText("telcPlaceholder", "Telc area functionality coming soon."));
    }
}
