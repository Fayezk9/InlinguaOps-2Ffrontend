# LinguaOps Desktop Application

A JavaFX desktop application that replicates the functionality of the original React/TypeScript LinguaOps frontend, designed to integrate seamlessly with your Java backend.

## Features

- **Modern JavaFX UI** with dark/light theme switching
- **Internationalization** support (German/English)
- **Navigation** between different modules (Orders, History, Settings, etc.)
- **Purple gradient design** matching the original interface
- **Responsive layout** with smooth page transitions
- **Configuration management** with persistent settings
- **Orders management** with export functionality
- **History tracking** with activity logging

## Requirements

- **Java 17** or higher
- **Maven 3.6+** for building
- **JavaFX 21** (automatically managed by Maven)

## Building and Running

### 1. Clone and Build

```bash
# Build the project
mvn clean compile

# Run during development
mvn javafx:run

# Build executable JAR
mvn clean package
```

### 2. Running the Application

**Development mode:**
```bash
mvn javafx:run
```

**Production JAR:**
```bash
java --module-path /path/to/javafx/lib --add-modules javafx.controls,javafx.fxml,javafx.web -jar target/linguaops-desktop-1.0.0.jar
```

**Alternative run command (if JavaFX is on classpath):**
```bash
java -jar target/linguaops-desktop-1.0.0-shaded.jar
```

### 3. Configuration

The application creates a configuration directory at `~/.linguaops/` with:
- `config.json` - Application settings (theme, language, API URLs, etc.)

Default configuration:
- **Language**: German (DE)
- **Theme**: Dark
- **API Base URL**: `http://localhost:8080/api`

## Project Structure

```
src/main/java/com/linguaops/desktop/
├── LinguaOpsApplication.java          # Main application entry point
├── controller/                        # UI controllers
│   ├── MainController.java            # Main window controller
│   ├── HomeController.java            # Home page with navigation
│   ├── OrdersController.java          # Orders management
│   ├── HistoryController.java         # Activity history
│   └── SettingsController.java        # Application settings
└── service/                           # Application services
    ├── ConfigurationService.java      # Persistent configuration
    ├── I18nService.java               # Internationalization
    └── ThemeService.java              # Theme management

src/main/resources/
├── fxml/                              # FXML layout files
│   ├── main.fxml                      # Main window layout
│   └── pages/                         # Individual page layouts
├── css/                               # Styling
│   ├── base.css                       # Common styles
│   ├── dark.css                       # Dark theme
│   └── light.css                      # Light theme
└── images/                            # Icons and images
```

## Integration with Java Backend

### API Configuration

Update the API base URL in the application:

1. **Via Configuration File** (`~/.linguaops/config.json`):
```json
{
  "apiBaseUrl": "http://your-backend:8080/api",
  "language": "en",
  "theme": "dark"
}
```

2. **Via Settings UI**: Use the Settings page to configure API endpoints

### Expected API Endpoints

The application expects the following REST endpoints from your Java backend:

- `GET /api/orders` - List orders
- `POST /api/orders/search` - Search orders  
- `GET /api/history` - Activity history
- `POST /api/participants` - Manage participants
- `GET /api/settings` - Application settings

### Backend Integration Example

For Spring Boot backend integration, ensure CORS is configured:

```java
@CrossOrigin(origins = "*") // Configure appropriately for production
@RestController
@RequestMapping("/api")
public class ApiController {
    
    @GetMapping("/orders")
    public ResponseEntity<List<Order>> getOrders() {
        // Your implementation
    }
    
    @PostMapping("/orders/search")
    public ResponseEntity<List<Order>> searchOrders(@RequestBody SearchRequest request) {
        // Your implementation
    }
}
```

## Features Status

### ✅ Completed
- Basic application structure and navigation
- Theme switching (Dark/Light)
- Internationalization (German/English)
- Orders page with action buttons
- Settings and configuration management
- CSS styling matching original design

### 🚧 In Progress
- History page with activity logging
- Settings page with Google Sheets integration
- API integration with backend

### 📋 Planned
- Complete backend API integration
- Advanced order management features
- Participant management
- Exam scheduling
- Data export/import functionality

## Development

### Adding New Pages

1. Create FXML layout in `src/main/resources/fxml/pages/`
2. Create controller in `src/main/java/com/linguaops/desktop/controller/`
3. Implement `I18nController` interface for text updates
4. Add navigation method in `MainController`

### Adding Translations

Add new keys to the `I18nService.createFallbackTranslations()` method:

```java
translations.put("newKey_de", "German Text");
translations.put("newKey_en", "English Text");
```

### Styling

Modify CSS files in `src/main/resources/css/`:
- `base.css` - Common styles
- `dark.css` - Dark theme specific
- `light.css` - Light theme specific

## Troubleshooting

### JavaFX Module Issues
If you encounter module path issues, ensure JavaFX is properly installed:

```bash
# Download JavaFX SDK and set JAVAFX_HOME
export JAVAFX_HOME=/path/to/javafx-sdk-21
java --module-path $JAVAFX_HOME/lib --add-modules javafx.controls,javafx.fxml,javafx.web -jar target/app.jar
```

### Build Issues
```bash
# Clean and rebuild
mvn clean compile
mvn javafx:run
```

### Configuration Issues
Delete configuration directory to reset:
```bash
rm -rf ~/.linguaops/
```

## License

This project is part of the LinguaOps application suite.
