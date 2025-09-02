module linguaops.desktop {
    requires javafx.base;
    requires javafx.controls;
    requires javafx.fxml;
    requires javafx.web;
    
    requires java.net.http;
    requires java.desktop;
    
    requires com.fasterxml.jackson.databind;
    requires com.fasterxml.jackson.datatype.jsr310;
    requires org.apache.httpcomponents.httpclient5;
    requires org.slf4j;
    requires ch.qos.logback.classic;
    
    exports com.linguaops.desktop;
    exports com.linguaops.desktop.controller;
    exports com.linguaops.desktop.service;
    
    opens com.linguaops.desktop to javafx.fxml;
    opens com.linguaops.desktop.controller to javafx.fxml;
    opens com.linguaops.desktop.service to com.fasterxml.jackson.databind;
}
