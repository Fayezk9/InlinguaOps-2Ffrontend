// Shared types for Java backend action API calls

export interface JavaActionRequest {
  orderNumbers: string[];
  inputFilePath?: string;
}

export interface JavaActionResponse {
  success: boolean;
  message: string;
  outputPath?: string;
  processedCount?: number;
  skippedCount?: number;
  error?: string;
}

export interface JavaBackendStatus {
  success: boolean;
  javaAvailable: boolean;
  version?: string;
  jarPath?: string;
  error?: string;
}

// Specific request/response types for each action

export interface RegistrationPdfRequest extends JavaActionRequest {
  // Could add specific fields for registration PDFs if needed
  templateType?: 'standard' | 'premium';
}

export interface RegistrationPdfResponse extends JavaActionResponse {
  pdfCount?: number;
  outputDirectory?: string;
}

export interface ParticipationPdfRequest extends JavaActionRequest {
  // Could add specific fields for participation PDFs if needed
  certificateLevel?: 'B1' | 'B2' | 'C1';
}

export interface ParticipationPdfResponse extends JavaActionResponse {
  certificateCount?: number;
  outputDirectory?: string;
}

export interface PostAddressListRequest extends JavaActionRequest {
  // Could add specific fields for address export if needed
  format?: 'excel' | 'csv' | 'pdf';
  includeHeaders?: boolean;
}

export interface PostAddressListResponse extends JavaActionResponse {
  exportFormat?: string;
  recordCount?: number;
  filePath?: string;
}

// API endpoint paths (for consistency)
export const JAVA_ACTION_ENDPOINTS = {
  STATUS: '/api/java-actions/status',
  REGISTRATION_PDF: '/api/java-actions/make-registration-pdf',
  PARTICIPATION_PDF: '/api/java-actions/make-participation-pdf',
  POST_ADDRESS_LIST: '/api/java-actions/make-post-address-list'
} as const;

// Helper type for API calls
export type JavaActionEndpoint = typeof JAVA_ACTION_ENDPOINTS[keyof typeof JAVA_ACTION_ENDPOINTS];

// Error types
export interface JavaActionError {
  success: false;
  error: string;
  code?: 'JAVA_NOT_FOUND' | 'JAR_NOT_FOUND' | 'PROCESS_FAILED' | 'TIMEOUT' | 'VALIDATION_ERROR';
  details?: string;
}
