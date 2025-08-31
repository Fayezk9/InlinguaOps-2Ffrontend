// Electron integration utilities for the frontend
import React from 'react';

interface ElectronAPI {
  getVersion: () => Promise<string>;
  showSaveDialog: () => Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
  onMenuAction: (callback: (action: string) => void) => void;
  onNavigate: (callback: (path: string) => void) => void;
  onCheckJavaStatus: (callback: () => void) => void;
  platform: string;
  isDesktop: boolean;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    electronDev?: {
      openDevTools: () => Promise<void>;
      reloadApp: () => Promise<void>;
    };
  }
}

// Check if running in Electron
export const isElectron = () => {
  return window.electronAPI?.isDesktop || false;
};

// Get platform information
export const getPlatform = () => {
  return window.electronAPI?.platform || navigator.platform;
};

// Show native save dialog
export const showSaveDialog = async (): Promise<string | null> => {
  if (!isElectron()) return null;
  
  const result = await window.electronAPI!.showSaveDialog();
  return result.canceled ? null : result.filePath || null;
};

// Show native open dialog
export const showOpenDialog = async (): Promise<string[]> => {
  if (!isElectron()) return [];
  
  const result = await window.electronAPI!.showOpenDialog();
  return result.canceled ? [] : result.filePaths;
};

// Get app version
export const getAppVersion = async (): Promise<string> => {
  if (!isElectron()) return '1.0.0';
  
  return await window.electronAPI!.getVersion();
};

// Electron-aware file upload hook
export const useElectronFileDialog = () => {
  const openFileDialog = async (): Promise<File[]> => {
    if (isElectron()) {
      // Use native Electron dialog
      const filePaths = await showOpenDialog();
      const files: File[] = [];
      
      for (const filePath of filePaths) {
        try {
          // In Electron, we need to read files differently
          const response = await fetch(`file://${filePath}`);
          const buffer = await response.arrayBuffer();
          const fileName = filePath.split(/[/\\]/).pop() || 'file';
          const file = new File([buffer], fileName);
          files.push(file);
        } catch (error) {
          console.error('Error reading file:', error);
        }
      }
      
      return files;
    } else {
      // Web browser - use regular file input
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.txt,.csv';
        
        input.onchange = (event) => {
          const files = Array.from((event.target as HTMLInputElement).files || []);
          resolve(files);
        };
        
        input.click();
      });
    }
  };

  return { openFileDialog };
};

// Set up Electron menu listeners
export const useElectronMenuListeners = (navigate: (path: string) => void) => {
  React.useEffect(() => {
    if (!isElectron()) return;

    const handleMenuAction = (action: string) => {
      switch (action) {
        case 'new-batch':
          // Handle new batch action
          navigate('/orders-new');
          break;
        default:
          console.log('Unhandled menu action:', action);
      }
    };

    const handleNavigation = (path: string) => {
      navigate(path);
    };

    const handleJavaStatusCheck = () => {
      // Trigger Java status check
      // This could dispatch an action or call an API
      window.dispatchEvent(new CustomEvent('check-java-status'));
    };

    // Set up listeners
    window.electronAPI!.onMenuAction(handleMenuAction);
    window.electronAPI!.onNavigate(handleNavigation);
    window.electronAPI!.onCheckJavaStatus(handleJavaStatusCheck);

    // Cleanup
    return () => {
      window.electronAPI!.removeAllListeners('menu-action');
      window.electronAPI!.removeAllListeners('navigate');
      window.electronAPI!.removeAllListeners('check-java-status');
    };
  }, [navigate]);
};

// Enhanced file upload component for Electron
export const ElectronFileUpload: React.FC<{
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  children: React.ReactNode;
}> = ({ onFilesSelected, accept = '.txt,.csv', multiple = true, children }) => {
  const { openFileDialog } = useElectronFileDialog();

  const handleClick = async () => {
    if (isElectron()) {
      const files = await openFileDialog();
      onFilesSelected(files);
    } else {
      // Fallback to regular file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = multiple;
      
      input.onchange = (event) => {
        const files = Array.from((event.target as HTMLInputElement).files || []);
        onFilesSelected(files);
      };
      
      input.click();
    }
  };

  return (
    <div onClick={handleClick} style={{ cursor: 'pointer' }}>
      {children}
    </div>
  );
};

// Desktop-specific features badge
export const DesktopFeaturesBadge: React.FC = () => {
  if (!isElectron()) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
      Desktop App
    </div>
  );
};

// Initialize Electron integration
export const initializeElectron = () => {
  if (!isElectron()) return;

  console.log('Running in Electron desktop app mode');
  
  // Add desktop-specific styles
  document.body.classList.add('electron-app');
  
  // Handle any desktop-specific initialization
  getAppVersion().then(version => {
    console.log('App version:', version);
  });
};
