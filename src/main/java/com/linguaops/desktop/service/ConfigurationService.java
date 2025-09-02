package com.linguaops.desktop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

public class ConfigurationService {
    private static final Logger logger = LoggerFactory.getLogger(ConfigurationService.class);
    private static final String CONFIG_DIR = System.getProperty("user.home") + "/.linguaops";
    private static final String CONFIG_FILE = "config.json";
    
    private final ObjectMapper objectMapper;
    private Map<String, Object> config;
    private final Path configPath;

    public ConfigurationService() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
        this.configPath = Paths.get(CONFIG_DIR, CONFIG_FILE);
        this.config = new HashMap<>();
    }

    public void initialize() {
        try {
            // Create config directory if it doesn't exist
            Files.createDirectories(Paths.get(CONFIG_DIR));
            
            // Load existing config or create default
            if (Files.exists(configPath)) {
                loadConfig();
            } else {
                createDefaultConfig();
                save();
            }
            
            logger.info("Configuration service initialized");
        } catch (Exception e) {
            logger.error("Failed to initialize configuration service", e);
            createDefaultConfig();
        }
    }

    private void loadConfig() throws IOException {
        config = objectMapper.readValue(configPath.toFile(), Map.class);
        logger.debug("Configuration loaded from {}", configPath);
    }

    private void createDefaultConfig() {
        config.clear();
        config.put("language", "de");
        config.put("theme", "dark");
        config.put("windowWidth", 1200);
        config.put("windowHeight", 800);
        config.put("apiBaseUrl", "http://localhost:8080/api");
        config.put("ordersWebsiteUrl", "");
        config.put("currentUserName", "User");
        
        logger.debug("Default configuration created");
    }

    public void save() {
        try {
            objectMapper.writeValue(configPath.toFile(), config);
            logger.debug("Configuration saved to {}", configPath);
        } catch (IOException e) {
            logger.error("Failed to save configuration", e);
        }
    }

    // Generic getters and setters
    public String getString(String key, String defaultValue) {
        return (String) config.getOrDefault(key, defaultValue);
    }

    public int getInt(String key, int defaultValue) {
        Object value = config.get(key);
        return value instanceof Number ? ((Number) value).intValue() : defaultValue;
    }

    public boolean getBoolean(String key, boolean defaultValue) {
        Object value = config.get(key);
        return value instanceof Boolean ? (Boolean) value : defaultValue;
    }

    public void setString(String key, String value) {
        config.put(key, value);
    }

    public void setInt(String key, int value) {
        config.put(key, value);
    }

    public void setBoolean(String key, boolean value) {
        config.put(key, value);
    }

    // Convenience methods for common settings
    public String getLanguage() { return getString("language", "de"); }
    public void setLanguage(String language) { setString("language", language); }

    public String getTheme() { return getString("theme", "dark"); }
    public void setTheme(String theme) { setString("theme", theme); }

    public String getApiBaseUrl() { return getString("apiBaseUrl", "http://localhost:8080/api"); }
    public void setApiBaseUrl(String url) { setString("apiBaseUrl", url); }

    public String getOrdersWebsiteUrl() { return getString("ordersWebsiteUrl", ""); }
    public void setOrdersWebsiteUrl(String url) { setString("ordersWebsiteUrl", url); }

    public String getCurrentUserName() { return getString("currentUserName", "User"); }
    public void setCurrentUserName(String name) { setString("currentUserName", name); }

    // Generic property methods for backward compatibility and extended usage
    public String getProperty(String key, String defaultValue) {
        return getString(key, defaultValue);
    }

    public void setProperty(String key, String value) {
        setString(key, value);
    }

    public Object getProperty(String key) {
        return config.get(key);
    }

    public void setProperty(String key, Object value) {
        config.put(key, value);
    }
}
