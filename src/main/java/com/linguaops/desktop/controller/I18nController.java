package com.linguaops.desktop.controller;

/**
 * Interface for controllers that support internationalization.
 * Controllers implementing this interface can have their UI texts
 * updated when the language changes.
 */
public interface I18nController {
    
    /**
     * Updates all text elements in the controller's UI with
     * the current language from the I18n service.
     */
    void updateTexts();
}
