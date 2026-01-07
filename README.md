# ModernAngularApi - Traffic Light Management System

A comprehensive Angular-based traffic light management system with real-time monitoring, SignalR integration, and offline map capabilities for Egypt.

## ⚠️ Important: Offline Map Setup Required

**The offline map tiles (~307 MB) are NOT included in this repository.** You must download them separately before running the application.

### Quick Start

1. **Clone the repository:**

   ```bash
   git clone https://github.com/YOUR_USERNAME/ModernAngularApi.git
   cd ModernAngularApi
   ```

2. **Download offline map tiles:**

   Choose one of these options:

   - **Option A**: Download from [Releases](https://github.com/YOUR_USERNAME/ModernAngularApi/releases/latest)
   - **Option B**: Download from [Google Drive](YOUR_GOOGLE_DRIVE_LINK)
   - **Option C**: Download from [OneDrive](YOUR_ONEDRIVE_LINK)

3. **Extract tiles:**

   ```bash
   # Extract tiles.zip to src/assets/tiles/
   # Your structure should be:
   # src/assets/tiles/6/, tiles/7/, ... , tiles/14/
   ```

4. **Install dependencies:**

   ```bash
   npm install
   ```

5. **Run the application:**
   ```bash
   ng serve -o
   ```

📖 **For detailed map setup instructions, see [src/assets/README.md](src/assets/README.md)**

## Features

- 🗺️ **Offline Maps**: Full offline map support using Leaflet.js (no internet required)
- 🚦 **Traffic Light Control**: Manage traffic signals with customizable patterns
- 📡 **Real-time Updates**: SignalR integration for live cabinet status
- 🎨 **Modern UI**: Built with Angular Material and Bootstrap
- 🌍 **Geographic Coverage**: Optimized for Egypt (Cairo region)
- 📊 **Admin Dashboard**: Comprehensive management interface

## Technology Stack

- **Angular** 20.3.0
- **Leaflet.js** for offline maps
- **SignalR** for real-time communication
- **Angular Material** UI components
- **Bootstrap** 5.3.8
- **TypeScript** 5.9.2

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
