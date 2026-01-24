/**
 * Parser Worker Client
 *
 * Provides a clean async API for parsing OpenAPI specs using a Web Worker.
 * Manages worker lifecycle, request correlation, and type deserialization.
 */

import type { ParseResult } from '../parseSpec';
import type { ParseRequest, ParseResponse } from './types';
import { deserializeSourceMap, deserializeParsedSpec } from './types';

/**
 * Pending request tracking.
 */
interface PendingRequest {
  resolve: (result: ParseResult) => void;
  reject: (error: Error) => void;
}

/**
 * Client for the parser Web Worker.
 *
 * Uses a singleton pattern to share the worker instance across the application.
 * Supports request cancellation via request ID correlation.
 */
export class ParserWorkerClient {
  private static instance: ParserWorkerClient | null = null;
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;

  private constructor() {}

  /**
   * Get the singleton instance of the parser worker client.
   */
  static getInstance(): ParserWorkerClient {
    if (!ParserWorkerClient.instance) {
      ParserWorkerClient.instance = new ParserWorkerClient();
    }
    return ParserWorkerClient.instance;
  }

  /**
   * Initialize the worker if not already running.
   */
  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./parser.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<ParseResponse>) => {
        this.handleResponse(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Parser worker error:', error);
        // Reject all pending requests on worker error
        for (const [id, request] of this.pendingRequests) {
          request.reject(new Error(`Worker error: ${error.message}`));
          this.pendingRequests.delete(id);
        }
      };
    }

    return this.worker;
  }

  /**
   * Handle responses from the worker.
   */
  private handleResponse(response: ParseResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      // Request was cancelled or already handled
      return;
    }

    this.pendingRequests.delete(response.id);

    if (response.type === 'error') {
      pending.reject(new Error(response.error));
      return;
    }

    // Deserialize the result back to Map-based types
    const result: ParseResult = {
      spec: response.result.spec
        ? deserializeParsedSpec(response.result.spec)
        : null,
      errors: response.result.errors,
      sourceMap: deserializeSourceMap(response.result.sourceMap),
    };

    pending.resolve(result);
  }

  /**
   * Generate a unique request ID.
   */
  private generateRequestId(): string {
    return `parse-${++this.requestCounter}-${Date.now()}`;
  }

  /**
   * Parse an OpenAPI specification using the worker.
   *
   * @param text - The OpenAPI specification text (YAML or JSON)
   * @returns A promise that resolves to the parse result
   */
  async parse(text: string): Promise<ParseResult> {
    const worker = this.ensureWorker();
    const id = this.generateRequestId();

    return new Promise<ParseResult>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const request: ParseRequest = {
        type: 'parse',
        id,
        text,
      };

      worker.postMessage(request);
    });
  }

  /**
   * Cancel a pending parse request.
   *
   * Note: This only prevents the response from being processed.
   * The worker will still complete the parse operation.
   *
   * @param requestId - The ID of the request to cancel (if known)
   */
  cancelPending(requestId?: string): void {
    if (requestId) {
      this.pendingRequests.delete(requestId);
    } else {
      // Cancel all pending requests
      this.pendingRequests.clear();
    }
  }

  /**
   * Terminate the worker and clean up resources.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }

  /**
   * Check if the worker is currently running.
   */
  isRunning(): boolean {
    return this.worker !== null;
  }

  /**
   * Get the number of pending requests.
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

/**
 * Convenience function to parse using the singleton worker client.
 */
export async function parseWithWorker(text: string): Promise<ParseResult> {
  return ParserWorkerClient.getInstance().parse(text);
}
