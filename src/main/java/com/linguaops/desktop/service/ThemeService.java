package com.linguaops.desktop.service;

import com.linguaops.desktop.LinguaOpsApplication;
import javafx.scene.Scene;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Objects;

public class ThemeService {
    private static final Logger logger = LoggerFactory.getLogger(ThemeService.class);
    
    public enum Theme {
        LIGHT("light"),
        DARK("dark");
        
        private final String name;
        
        Theme(String name) {
            this.name = name;
        }
        
        public String getName() {
            return name;
        }
        
        public static Theme fromString(String name) {
            for (Theme theme : values()) {
                if (theme.name.equals(name)) {
                    return theme;
                }
            }
            return DARK; // default
        }
    }
    
    private Theme currentTheme;

    public void initialize() {
        ConfigurationService configService = LinguaOpsApplication.getInstance().getConfigService();
        setTheme(Theme.fromString(configService.getTheme()));
        logger.info("Theme service initialized with theme: {}", currentTheme.getName());
    }

    public void setTheme(Theme theme) {
        this.currentTheme = theme;
        
        // Apply to current scene if available
        LinguaOpsApplication app = LinguaOpsApplication.getInstance();
        if (app != null && app.getScene() != null) {
            applyTheme(app.getScene());
        }
        
        // Save to config
        if (app != null) {
            app.getConfigService().setTheme(theme.getName());
        }
        
        logger.debug("Theme changed to: {}", theme.getName());
    }

    public void toggleTheme() {
        Theme newTheme = currentTheme == Theme.LIGHT ? Theme.DARK : Theme.LIGHT;
        setTheme(newTheme);
    }

    public Theme getCurrentTheme() {
        return currentTheme != null ? currentTheme : Theme.DARK;
    }

    public void applyTheme(Scene scene) {
        if (scene == null) return;
        
        // Clear existing stylesheets
        scene.getStylesheets().clear();
        
        try {
            // Try webapp-style CSS first (new style)
            String baseStylesheet = getClass().getResource("/css/webapp-base.css");
            String themeStylesheet = getClass().getResource("/css/webapp-" + getCurrentTheme().getName() + ".css");

            if (baseStylesheet != null && themeStylesheet != null) {
                // Use webapp-style CSS
                scene.getStylesheets().add(baseStylesheet.toExternalForm());
                scene.getStylesheets().add(themeStylesheet.toExternalForm());
                logger.debug("Applied webapp-style {} theme to scene", getCurrentTheme().getName());
            } else {
                // Fallback to original CSS
                String originalBase = Objects.requireNonNull(
                    getClass().getResource("/css/base.css")
                ).toExternalForm();
                scene.getStylesheets().add(originalBase);

                String originalTheme = Objects.requireNonNull(
                    getClass().getResource("/css/" + getCurrentTheme().getName() + ".css")
                ).toExternalForm();
                scene.getStylesheets().add(originalTheme);

                logger.debug("Applied original {} theme to scene", getCurrentTheme().getName());
            }

        } catch (Exception e) {
            logger.warn("Could not apply theme stylesheets", e);
            // Apply minimal fallback styling
            applyFallbackStyling(scene);
        }
    }

    private void applyFallbackStyling(Scene scene) {
        // Apply basic inline styling as fallback
        String fallbackStyle = "";
        
        if (getCurrentTheme() == Theme.DARK) {
            fallbackStyle = """
                .root {
                    -fx-base: #1a1a1a;
                    -fx-background: #000000;
                    -fx-control-inner-background: #2a2a2a;
                    -fx-text-fill: white;
                }
                """;
        } else {
            fallbackStyle = """
                .root {
                    -fx-base: #f0f0f0;
                    -fx-background: #ffffff;
                    -fx-control-inner-background: #ffffff;
                    -fx-text-fill: black;
                }
                """;
        }
        
        scene.getRoot().setStyle(fallbackStyle);
        logger.debug("Applied fallback {} theme styling", getCurrentTheme().getName());
    }

    // Utility methods for controllers
    public String getStyleClass(String baseClass) {
        return baseClass + "-" + getCurrentTheme().getName();
    }

    public boolean isDarkTheme() {
        return getCurrentTheme() == Theme.DARK;
    }

    public boolean isLightTheme() {
        return getCurrentTheme() == Theme.LIGHT;
    }
}
