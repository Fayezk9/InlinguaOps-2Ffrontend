import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileSpreadsheet, CheckCircle, AlertCircle, Upload, Download } from "lucide-react";
import { JavaActionRequest, JavaActionResponse, JavaBackendStatus, JAVA_ACTION_ENDPOINTS } from "@shared/java-actions";

interface AddressExportPanelProps {
  className?: string;
}

export default function AddressExportPanel({ className }: AddressExportPanelProps) {
  const [orderNumbers, setOrderNumbers] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [javaStatus, setJavaStatus] = useState<JavaBackendStatus | null>(null);
  const [lastResult, setLastResult] = useState<JavaActionResponse | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const { toast } = useToast();

  // Check Java backend status on component mount
  useEffect(() => {
    checkJavaStatus();
  }, []);

  const checkJavaStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const response = await fetch(JAVA_ACTION_ENDPOINTS.STATUS);
      const status: JavaBackendStatus = await response.json();
      setJavaStatus(status);
    } catch (error) {
      setJavaStatus({
        success: false,
        javaAvailable: false,
        error: 'Failed to connect to backend'
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const parseOrderNumbers = (input: string): string[] => {
    return input
      .split(/[,\n\r\s]+/)
      .map(num => num.trim())
      .filter(num => num.length > 0 && /^\d+$/.test(num));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setOrderNumbers(prev => prev + (prev ? '\n' : '') + text);
      toast({
        title: "File uploaded",
        description: `Added content from ${file.name}`
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Could not read the file",
        variant: "destructive"
      });
    }
  };

  const exportAddressList = async () => {
    const numbers = parseOrderNumbers(orderNumbers);
    
    if (numbers.length === 0) {
      toast({
        title: "No order numbers",
        description: "Please enter at least one valid order number",
        variant: "destructive"
      });
      return;
    }

    if (!javaStatus?.javaAvailable) {
      toast({
        title: "Java backend not available",
        description: "Please check your Java configuration",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    setLastResult(null);

    try {
      const request: JavaActionRequest = {
        orderNumbers: numbers
      };

      const response = await fetch(JAVA_ACTION_ENDPOINTS.POST_ADDRESS_LIST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      const result: JavaActionResponse = await response.json();
      setLastResult(result);

      if (result.success) {
        toast({
          title: "Success!",
          description: result.message
        });
      } else {
        toast({
          title: "Export failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      const errorResult: JavaActionResponse = {
        success: false,
        message: "Failed to communicate with backend",
        error: error.message
      };
      setLastResult(errorResult);
      
      toast({
        title: "Network error",
        description: "Could not connect to the backend service",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const validOrderCount = parseOrderNumbers(orderNumbers).length;

  return (
    <Card className={`border border-border bg-card text-card-foreground ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" />
          Address List Export
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Export customer addresses for postal mailings
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Java Backend Status */}
        <div>
          <Label className="text-sm font-medium">Backend Status</Label>
          {isCheckingStatus ? (
            <div className="flex items-center gap-2 mt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Checking Java backend...</span>
            </div>
          ) : (
            <Alert className={`mt-2 ${javaStatus?.javaAvailable ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center gap-2">
                {javaStatus?.javaAvailable ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-green-800">Java Backend Available</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-red-800">Java Backend Not Available</span>
                  </>
                )}
              </div>
              <AlertDescription className="mt-2">
                {javaStatus?.javaAvailable 
                  ? `Java version: ${javaStatus.version}`
                  : `Error: ${javaStatus?.error}`
                }
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        {/* Order Numbers Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="address-order-numbers">Order Numbers</Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {validOrderCount} addresses
              </Badge>
              <Input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="address-file-upload"
              />
              <Button
                type="button"
                variant="outline" 
                size="sm"
                onClick={() => document.getElementById('address-file-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </div>
          </div>
          
          <Textarea
            id="address-order-numbers"
            placeholder="Enter order numbers (one per line or comma-separated)&#10;Example:&#10;1234&#10;5678&#10;9012"
            value={orderNumbers}
            onChange={(e) => setOrderNumbers(e.target.value)}
            rows={6}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Enter order numbers to export customer addresses for postal mailings.
          </p>
        </div>

        {/* Export Button */}
        <div>
          <Button
            onClick={exportAddressList}
            disabled={isExporting || validOrderCount === 0 || !javaStatus?.javaAvailable}
            className="w-full"
            size="lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting Address List...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {validOrderCount} Address{validOrderCount !== 1 ? 'es' : ''}
              </>
            )}
          </Button>
        </div>

        {/* Results Display */}
        {lastResult && (
          <div>
            <Label className="text-sm font-medium">Last Export Result</Label>
            <Alert className={`mt-2 ${lastResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center gap-2">
                {lastResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className={lastResult.success ? 'text-green-800' : 'text-red-800'}>
                  {lastResult.message}
                </span>
              </div>
              {(lastResult.processedCount !== undefined || lastResult.skippedCount !== undefined) && (
                <AlertDescription className="mt-2">
                  <div className="flex gap-4 text-sm">
                    {lastResult.processedCount !== undefined && (
                      <span>Exported: {lastResult.processedCount}</span>
                    )}
                    {lastResult.skippedCount !== undefined && (
                      <span>Skipped: {lastResult.skippedCount}</span>
                    )}
                  </div>
                </AlertDescription>
              )}
              {lastResult.outputPath && (
                <AlertDescription className="mt-2">
                  <div className="text-sm">
                    <strong>Excel file saved to:</strong> {lastResult.outputPath}
                  </div>
                </AlertDescription>
              )}
            </Alert>
          </div>
        )}

        {/* Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Export format:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li><strong>Excel file (.xlsx)</strong> with columns: Vorname, Nachname, Straße und Hausnummer, PLZ, Stadt</li>
              <li>One row per customer address</li>
              <li>Saved to output directory organized by exam type</li>
              <li>Perfect for postal mailing labels and address printing</li>
            </ul>
          </AlertDescription>
        </Alert>

      </CardContent>
    </Card>
  );
}
