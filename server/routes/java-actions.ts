import { Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

// Interfaces for the Java action requests
interface JavaActionRequest {
  orderNumbers: string[];
  inputFilePath?: string;
}

interface JavaActionResponse {
  success: boolean;
  message: string;
  outputPath?: string;
  processedCount?: number;
  skippedCount?: number;
  error?: string;
}

/**
 * Execute MakeRegistrationPdfAction (Anmeldebestätigung)
 * POST /api/java-actions/make-registration-pdf
 */
export const executeRegistrationPdfAction = async (req: Request, res: Response) => {
  try {
    const { orderNumbers, inputFilePath }: JavaActionRequest = req.body;

    if (!orderNumbers || !Array.isArray(orderNumbers) || orderNumbers.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Order numbers array is required and cannot be empty" 
      });
    }

    // Create input file for Java application
    const inputFile = inputFilePath || 'input/order_numbers.txt';
    const inputDir = path.dirname(inputFile);
    
    // Ensure input directory exists
    await fs.mkdir(inputDir, { recursive: true });
    
    // Write order numbers to file
    await fs.writeFile(inputFile, orderNumbers.join('\n'), 'utf8');

    // Execute Java application
    const result = await executeJavaAction('MakeRegistrationPdfAction', inputFile);
    
    const response: JavaActionResponse = {
      success: result.success,
      message: result.success 
        ? `Successfully generated ${result.processedCount} registration PDFs` 
        : result.error || 'Failed to generate registration PDFs',
      processedCount: result.processedCount,
      skippedCount: result.skippedCount,
      outputPath: result.outputPath
    };

    if (result.success) {
      res.json(response);
    } else {
      res.status(500).json({ ...response, error: result.error });
    }

  } catch (error: any) {
    console.error('Error in executeRegistrationPdfAction:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
};

/**
 * Execute MakeParticipationPdfAction (Teilnahmebestätigung)  
 * POST /api/java-actions/make-participation-pdf
 */
export const executeParticipationPdfAction = async (req: Request, res: Response) => {
  try {
    const { orderNumbers, inputFilePath }: JavaActionRequest = req.body;

    if (!orderNumbers || !Array.isArray(orderNumbers) || orderNumbers.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Order numbers array is required and cannot be empty" 
      });
    }

    // Create input file for Java application
    const inputFile = inputFilePath || 'input/order_numbers.txt';
    const inputDir = path.dirname(inputFile);
    
    // Ensure input directory exists
    await fs.mkdir(inputDir, { recursive: true });
    
    // Write order numbers to file
    await fs.writeFile(inputFile, orderNumbers.join('\n'), 'utf8');

    // Execute Java application - use menu option 2 for participation PDFs
    const result = await executeJavaAction('MakeParticipationPdfAction', inputFile);
    
    const response: JavaActionResponse = {
      success: result.success,
      message: result.success 
        ? `Successfully generated ${result.processedCount} participation PDFs` 
        : result.error || 'Failed to generate participation PDFs',
      processedCount: result.processedCount,
      skippedCount: result.skippedCount,
      outputPath: result.outputPath
    };

    if (result.success) {
      res.json(response);
    } else {
      res.status(500).json({ ...response, error: result.error });
    }

  } catch (error: any) {
    console.error('Error in executeParticipationPdfAction:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
};

/**
 * Execute MakePostAddressListAction (Address Export)
 * POST /api/java-actions/make-post-address-list
 */
export const executePostAddressListAction = async (req: Request, res: Response) => {
  try {
    const { orderNumbers, inputFilePath }: JavaActionRequest = req.body;

    if (!orderNumbers || !Array.isArray(orderNumbers) || orderNumbers.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Order numbers array is required and cannot be empty" 
      });
    }

    // Create input file for Java application
    const inputFile = inputFilePath || 'Adressen Input.txt';
    
    // Write order numbers to file
    await fs.writeFile(inputFile, orderNumbers.join('\n'), 'utf8');

    // Execute Java application - use menu option 3 for address export
    const result = await executeJavaAction('MakePostAddressListAction', inputFile);
    
    const response: JavaActionResponse = {
      success: result.success,
      message: result.success 
        ? `Successfully exported ${result.processedCount} addresses` 
        : result.error || 'Failed to export address list',
      processedCount: result.processedCount,
      skippedCount: result.skippedCount,
      outputPath: result.outputPath
    };

    if (result.success) {
      res.json(response);
    } else {
      res.status(500).json({ ...response, error: result.error });
    }

  } catch (error: any) {
    console.error('Error in executePostAddressListAction:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
};

/**
 * Helper function to execute Java applications
 */
async function executeJavaAction(actionName: string, inputFile: string): Promise<{
  success: boolean;
  error?: string;
  processedCount?: number;
  skippedCount?: number;
  outputPath?: string;
}> {
  return new Promise((resolve) => {
    // Construct the command to run the Java application
    // Adjust this path according to your Java project structure
    const javaCommand = process.env.JAVA_HOME 
      ? path.join(process.env.JAVA_HOME, 'bin', 'java')
      : 'java';
    
    const jarPath = process.env.JAVA_JAR_PATH || 'target/wc-docgen-1.0.jar';
    const mainClass = process.env.JAVA_MAIN_CLASS || 'wc.docgen.AppMenu';
    
    // Arguments for Java application
    const args = ['-cp', jarPath, mainClass];
    
    console.log(`Executing Java action: ${actionName}`);
    console.log(`Command: ${javaCommand} ${args.join(' ')}`);
    
    const javaProcess = spawn(javaCommand, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';
    
    // Send the menu choice based on action
    let menuChoice = '1'; // Default to registration PDF
    if (actionName === 'MakeParticipationPdfAction') {
      menuChoice = '2';
    } else if (actionName === 'MakePostAddressListAction') {
      menuChoice = '3';
    }
    
    // Send menu selection and input file path
    javaProcess.stdin.write(`${menuChoice}\n`);
    if (actionName === 'MakePostAddressListAction') {
      javaProcess.stdin.write(`${inputFile}\n`);
    }
    javaProcess.stdin.write('0\n'); // Exit after execution
    javaProcess.stdin.end();

    javaProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`Java stdout: ${data}`);
    });

    javaProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`Java stderr: ${data}`);
    });

    javaProcess.on('close', (code) => {
      console.log(`Java process exited with code: ${code}`);
      
      if (code === 0) {
        // Parse output to extract statistics
        const processedMatch = stdout.match(/Processed:\s*(\d+)/i);
        const skippedMatch = stdout.match(/Skipped:\s*(\d+)/i);
        const outputPathMatch = stdout.match(/FERTIG:\s*(.+)/i) || stdout.match(/Excel geschrieben:\s*(.+)/i);
        
        resolve({
          success: true,
          processedCount: processedMatch ? parseInt(processedMatch[1]) : undefined,
          skippedCount: skippedMatch ? parseInt(skippedMatch[1]) : undefined,
          outputPath: outputPathMatch ? outputPathMatch[1].trim() : undefined
        });
      } else {
        resolve({
          success: false,
          error: `Java process failed with code ${code}. Stderr: ${stderr}`
        });
      }
    });

    javaProcess.on('error', (error) => {
      console.error(`Failed to start Java process: ${error}`);
      resolve({
        success: false,
        error: `Failed to start Java process: ${error.message}`
      });
    });

    // Set a timeout for long-running processes
    setTimeout(() => {
      javaProcess.kill();
      resolve({
        success: false,
        error: 'Java process timed out after 5 minutes'
      });
    }, 5 * 60 * 1000); // 5 minutes timeout
  });
}

/**
 * Get status of Java backend (check if Java is available)
 * GET /api/java-actions/status
 */
export const getJavaBackendStatus = async (req: Request, res: Response) => {
  try {
    const javaCommand = process.env.JAVA_HOME 
      ? path.join(process.env.JAVA_HOME, 'bin', 'java')
      : 'java';
    
    const javaProcess = spawn(javaCommand, ['-version'], { stdio: 'pipe' });
    
    let version = '';
    javaProcess.stderr.on('data', (data) => {
      version += data.toString();
    });
    
    javaProcess.on('close', (code) => {
      if (code === 0) {
        res.json({
          success: true,
          javaAvailable: true,
          version: version.split('\n')[0],
          jarPath: process.env.JAVA_JAR_PATH || 'target/wc-docgen-1.0.jar'
        });
      } else {
        res.json({
          success: false,
          javaAvailable: false,
          error: 'Java not available or not properly configured'
        });
      }
    });

    javaProcess.on('error', () => {
      res.json({
        success: false,
        javaAvailable: false,
        error: 'Java not found in system PATH'
      });
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      javaAvailable: false,
      error: error.message
    });
  }
};
