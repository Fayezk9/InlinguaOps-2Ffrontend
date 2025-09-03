package com.linguaops.desktop.controller;

import com.linguaops.desktop.LinguaOpsApplication;
import com.linguaops.desktop.service.I18nService;
import javafx.fxml.FXML;
import javafx.fxml.Initializable;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URL;
import java.util.LinkedHashSet;
import java.util.ResourceBundle;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ParticipantsControllerWebStyle implements Initializable, I18nController {
    private static final Logger logger = LoggerFactory.getLogger(ParticipantsControllerWebStyle.class);

    enum Section { NONE, ANMELDE, TEILNAHME, ADDRESS }

    @FXML private Label titleLabel;
    @FXML private Button btnAnmelde;
    @FXML private Button btnTeilnahme;
    @FXML private Button btnAddress;

    @FXML private VBox panel;
    @FXML private Label panelTitle;
    @FXML private TextArea orderInput;
    @FXML private Button actionButton;
    @FXML private Label parsedLabel;

    private Section open = Section.NONE;

    @Override
    public void initialize(URL location, ResourceBundle resources) {
        updateTexts();
        updatePanel();
    }

    @FXML
    private void openAnmelde() { toggle(Section.ANMELDE); }

    @FXML
    private void openTeilnahme() { toggle(Section.TEILNAHME); }

    @FXML
    private void openAddress() { toggle(Section.ADDRESS); }

    private void toggle(Section s) {
        open = open == s ? Section.NONE : s;
        updatePanel();
    }

    private void updatePanel() {
        boolean show = open != Section.NONE;
        panel.setVisible(show);
        panel.setManaged(show);
        if (!show) return;

        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        I18nService i18n = app != null ? app.getI18nService() : null;
        if (i18n == null) return;

        switch (open) {
            case ANMELDE -> {
                panelTitle.setText(i18n.getText("registrationConfirmation"));
                actionButton.setText(i18n.getText("makeRegistrationConfirmation"));
            }
            case TEILNAHME -> {
                panelTitle.setText(i18n.getText("participationConfirmation"));
                actionButton.setText(i18n.getText("makeParticipationConfirmation"));
            }
            case ADDRESS -> {
                panelTitle.setText(i18n.getText("addressPostList"));
                actionButton.setText(i18n.getText("makeAddressPostList"));
            }
        }
        updateParsed();
        orderInput.textProperty().removeListener((obs, o, n) -> {});
        orderInput.textProperty().addListener((obs, o, n) -> updateParsed());
    }

    private void updateParsed() {
        var ids = parseOrderNumbers(orderInput.getText());
        parsedLabel.setText("Parsed: " + ids.size());
    }

    @FXML
    private void runAction() {
        var ids = parseOrderNumbers(orderInput.getText());
        logger.info("Would run action {} for {} orders", open, ids.size());
        // Desktop app: wire actual generation/integration later
    }

    private static LinkedHashSet<String> parseOrderNumbers(String text) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (text == null) return out;
        Pattern p = Pattern.compile("[0-9]{2,}");
        Matcher m = p.matcher(text);
        while (m.find()) out.add(m.group());
        return out;
    }

    @Override
    public void updateTexts() {
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app == null) return;
        I18nService i18n = app.getI18nService();
        titleLabel.setText(i18n.getText("manageParticipants"));
        btnAnmelde.setText(i18n.getText("registrationConfirmation"));
        btnTeilnahme.setText(i18n.getText("participationConfirmation"));
        btnAddress.setText(i18n.getText("addressPostList"));
        if (open != Section.NONE) updatePanel();
    }
}
