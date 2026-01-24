/**
 * Graph Builder Worker Client
 *
 * Provides a clean async API for building graphs using a Web Worker.
 * Manages worker lifecycle, request correlation, and type handling.
 */

import type { ParsedSpec } from '@/types';
import { serializeParsedSpec } from '@/core/parser/workers/types';
import type { LayoutOptions } from '../layout';
import type {
  BuildGraphRequest,
  BuildGraphResponse,
  GraphBuildResult,
} from './types';

/**
 * Pending request tracking.
 */
interface PendingRequest {
  resolve: (result: GraphBuildResult) => void;
  reject: (error: Error) => void;
}

/**
 * Options for building a graph.
 */
export interface BuildGraphOptions {
  layoutOptions?: Partial<LayoutOptions>;
}

/**
 * Client for the graph builder Web Worker.
 *
 * Uses a singleton pattern to share the worker instance across the application.
 * Supports request cancellation via request ID correlation.
 */
export class GraphWorkerClient {
  private static instance: GraphWorkerClient | null = null;
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;

  private constructor() {}

  /**
   * Get the singleton instance of the graph worker client.
   */
  static getInstance(): GraphWorkerClient {
    if (!GraphWorkerClient.instance) {
      GraphWorkerClient.instance = new GraphWorkerClient();
    }
    return GraphWorkerClient.instance;
  }

  /**
   * Initialize the worker if not already running.
   */
  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./graph.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<BuildGraphResponse>) => {
        this.handleResponse(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Graph worker error:', error);
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
  private handleResponse(response: BuildGraphResponse): void {
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

    // Result is already in the correct format
    pending.resolve(response.result);
  }

  /**
   * Generate a unique request ID.
   */
  private generateRequestId(): string {
    return `graph-${++this.requestCounter}-${Date.now()}`;
  }

  /**
   * Build a graph from a parsed OpenAPI specification using the worker.
   *
   * @param spec - The parsed OpenAPI specification
   * @param options - Optional build options including layout configuration
   * @returns A promise that resolves to the graph build result
   */
  async build(
    spec: ParsedSpec,
    options: BuildGraphOptions = {}
  ): Promise<GraphBuildResult> {
    const worker = this.ensureWorker();
    const id = this.generateRequestId();

    return new Promise<GraphBuildResult>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const request: BuildGraphRequest = {
        type: 'build',
        id,
        spec: serializeParsedSpec(spec),
        layoutOptions: options.layoutOptions,
      };

      worker.postMessage(request);
    });
  }

  /**
   * Cancel a pending build request.
   *
   * Note: This only prevents the response from being processed.
   * The worker will still complete the build operation.
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
 * Convenience function to build a graph using the singleton worker client.
 */
export async function buildGraphWithWorker(
  spec: ParsedSpec,
  options: BuildGraphOptions = {}
): Promise<GraphBuildResult> {
  return GraphWorkerClient.getInstance().build(spec, options);
}
