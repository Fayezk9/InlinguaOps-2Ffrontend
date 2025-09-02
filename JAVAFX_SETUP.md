# JavaFX Setup Instructions for IntelliJ IDEA

## Problem
When running the JavaFX application in IntelliJ, you get the error:
```
Fehler: Zum Ausführen dieser Anwendung benötigte JavaFX-Runtime-Komponenten fehlen
```

## Solution

### 1. Download JavaFX SDK
1. Go to https://openjfx.io/
2. Download JavaFX SDK for your platform (Windows/Mac/Linux)
3. Extract it to a folder (e.g., `C:\javafx-sdk-21.0.1` or `/Users/yourname/javafx-sdk-21.0.1`)

### 2. Configure IntelliJ Project Structure
1. Open IntelliJ IDEA
2. Go to **File → Project Structure** (Ctrl+Alt+Shift+S)
3. Go to **Libraries** → Click **+** → **Java**
4. Navigate to your JavaFX SDK folder → Select the **lib** folder
5. Name it "JavaFX-21" and click OK
6. Make sure it's added to your module dependencies

### 3. Configure Run Configuration
1. Go to **Run → Edit Configurations**
2. Select your main class configuration (LinguaOpsApplication)
3. In **VM options**, add:
   ```
   --module-path "path/to/javafx-sdk-21.0.1/lib" --add-modules javafx.controls,javafx.fxml,javafx.web,javafx.base
   ```
   Replace `path/to/javafx-sdk-21.0.1/lib` with your actual JavaFX SDK lib path.

   **Example for Windows:**
   ```
   --module-path "C:\javafx-sdk-21.0.1\lib" --add-modules javafx.controls,javafx.fxml,javafx.web,javafx.base
   ```

   **Example for Mac/Linux:**
   ```
   --module-path "/Users/yourname/javafx-sdk-21.0.1/lib" --add-modules javafx.controls,javafx.fxml,javafx.web,javafx.base
   ```

4. Set **Main class** to: `com.linguaops.desktop.LinguaOpsApplication`
5. Click **Apply** and **OK**

### 4. Alternative: Use Maven to Run
Instead of running from IntelliJ directly, you can use Maven:

```bash
mvn clean javafx:run
```

This will automatically include the JavaFX runtime.

### 5. For Building Executable JAR
To build a standalone executable:

```bash
mvn clean package
```

Then run with:
```bash
java --module-path path/to/javafx-sdk-21.0.1/lib --add-modules javafx.controls,javafx.fxml,javafx.web,javafx.base -jar target/linguaops-desktop-1.0.0.jar
```

## Troubleshooting

### If you still get module errors:
1. Make sure Java 17+ is selected as your project SDK
2. Verify that the JavaFX SDK version matches your dependencies (21.0.1)
3. Check that the module-info.java file is in the correct location

### If FXML files don't load:
1. Verify that FXML files are in `src/main/resources/fxml/`
2. Check that the FXMLLoader paths are correct in your controllers
3. Ensure the module-info.java file opens the controller packages to javafx.fxml

### If the application starts but shows blank window:
1. Check the console for error messages
2. Verify CSS files are in `src/main/resources/css/`
3. Check that scene and stage initialization is correct
