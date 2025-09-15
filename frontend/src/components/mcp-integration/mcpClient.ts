// MCP Client SDK - 强类型封装 + 超时/重试/断路器
export type JsonRpcReq<T> = { 
  jsonrpc: "2.0"; 
  id: string; 
  method: string; 
  params?: T; 
};

export type JsonRpcRes<R> = { 
  jsonrpc: "2.0"; 
  id: string; 
  result?: R; 
  error?: { 
    code: number; 
    message: string; 
    data?: any; 
  }; 
};

export type MCPToolResult<T = any> = {
  id: string;
  data: T;
  timestamp: number;
  latency: number;
};

export type MCPError = Error & {
  code?: number;
  data?: any;
  isRetryable?: boolean;
};

export interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailTime?: number;
  nextRetryTime?: number;
}

export interface MCPClientConfig {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174';
const ENDPOINT = "/latex-mcp/mcp";
const DEFAULT_TIMEOUT = 12_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 1000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT = 60_000;

export class MCPClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private metrics = new Map<string, {
    totalCalls: number;
    successfulCalls: number;
    totalLatency: number;
    lastCall?: number;
  }>();

  constructor(config: MCPClientConfig = {}) {
    this.baseUrl = config.baseUrl || ENDPOINT;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries || DEFAULT_MAX_RETRIES;
    this.retryDelay = config.retryDelay || DEFAULT_RETRY_DELAY;
  }

  async callTool<TRes = any>(
    toolName: string, 
    args: Record<string, any> = {}, 
    options?: {
      timeout?: number; 
      signal?: AbortSignal;
      retries?: number;
    }
  ): Promise<MCPToolResult<TRes>> {
    const startTime = performance.now();
    
    // Check circuit breaker
    if (this.isCircuitBreakerOpen(toolName)) {
      throw this.createMCPError(
        `Circuit breaker is open for tool: ${toolName}`,
        -32099,
        { toolName, circuitBreakerOpen: true },
        false
      );
    }

    const id = crypto.randomUUID();
    const body: JsonRpcReq<{ name: string; arguments: Record<string, any> }> = {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: toolName, arguments: args }
    };

    let lastError: MCPError | null = null;
    const maxAttempts = (options?.retries ?? this.maxRetries) + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await this.delay(this.retryDelay * Math.pow(2, attempt - 1)); // Exponential backoff
      }

      try {
        const result = await this.performCall<TRes>(id, body, options);
        const latency = performance.now() - startTime;
        
        // Record success metrics
        this.recordSuccess(toolName, latency);
        this.resetCircuitBreaker(toolName);
        
        return {
          id,
          data: result,
          timestamp: Date.now(),
          latency
        };
      } catch (error) {
        lastError = this.createMCPError(
          error instanceof Error ? error.message : String(error),
          (error as any)?.code || -32603,
          (error as any)?.data,
          this.isRetryableError(error as any)
        );

        // Don't retry non-retryable errors (domain errors)
        if (!lastError.isRetryable) {
          break;
        }
      }
    }

    // Record failure and update circuit breaker
    this.recordFailure(toolName);
    this.updateCircuitBreaker(toolName);
    
    throw lastError!;
  }

  private async performCall<TRes>(
    id: string,
    body: JsonRpcReq<any>,
    options?: { timeout?: number; signal?: AbortSignal }
  ): Promise<TRes> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("timeout"), options?.timeout ?? this.timeout);
    
    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Origin": ORIGIN,
        },
        body: JSON.stringify(body),
        signal: options?.signal ?? controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = (await response.json()) as JsonRpcRes<TRes>;
      
      if (json.error) {
        throw Object.assign(new Error(json.error.message), {
          code: json.error.code,
          data: json.error.data
        });
      }

      return json.result as TRes;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private createMCPError(message: string, code: number, data?: any, isRetryable = true): MCPError {
    const error = Object.assign(new Error(message), {
      code,
      data,
      isRetryable
    }) as MCPError;
    return error;
  }

  private isRetryableError(error: any): boolean {
    const code = error?.code;
    // Network errors and timeouts are retryable
    // Domain-specific errors (-32001, etc.) are not retryable
    return !code || code === -32603 || code >= -32099;
  }

  private isCircuitBreakerOpen(toolName: string): boolean {
    const breaker = this.circuitBreakers.get(toolName);
    if (!breaker || !breaker.isOpen) return false;
    
    // Check if timeout has passed
    if (breaker.nextRetryTime && Date.now() >= breaker.nextRetryTime) {
      breaker.isOpen = false;
      breaker.failures = 0;
      return false;
    }
    
    return true;
  }

  private updateCircuitBreaker(toolName: string): void {
    const breaker = this.circuitBreakers.get(toolName) || {
      isOpen: false,
      failures: 0
    };
    
    breaker.failures++;
    breaker.lastFailTime = Date.now();
    
    if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      breaker.isOpen = true;
      breaker.nextRetryTime = Date.now() + CIRCUIT_BREAKER_TIMEOUT;
    }
    
    this.circuitBreakers.set(toolName, breaker);
  }

  private resetCircuitBreaker(toolName: string): void {
    const breaker = this.circuitBreakers.get(toolName);
    if (breaker) {
      breaker.isOpen = false;
      breaker.failures = 0;
      breaker.nextRetryTime = undefined;
    }
  }

  private recordSuccess(toolName: string, latency: number): void {
    const metrics = this.metrics.get(toolName) || {
      totalCalls: 0,
      successfulCalls: 0,
      totalLatency: 0
    };
    
    metrics.totalCalls++;
    metrics.successfulCalls++;
    metrics.totalLatency += latency;
    metrics.lastCall = Date.now();
    
    this.metrics.set(toolName, metrics);
  }

  private recordFailure(toolName: string): void {
    const metrics = this.metrics.get(toolName) || {
      totalCalls: 0,
      successfulCalls: 0,
      totalLatency: 0
    };
    
    metrics.totalCalls++;
    metrics.lastCall = Date.now();
    
    this.metrics.set(toolName, metrics);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API for dashboard
  public getMetrics(): Map<string, {
    totalCalls: number;
    successfulCalls: number;
    avgLatency: number;
    successRate: number;
    lastCall?: number;
  }> {
    const result = new Map();
    for (const [tool, metrics] of this.metrics) {
      result.set(tool, {
        totalCalls: metrics.totalCalls,
        successfulCalls: metrics.successfulCalls,
        avgLatency: metrics.totalCalls > 0 ? metrics.totalLatency / metrics.successfulCalls : 0,
        successRate: metrics.totalCalls > 0 ? metrics.successfulCalls / metrics.totalCalls : 0,
        lastCall: metrics.lastCall
      });
    }
    return result;
  }

  public getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  public resetMetrics(): void {
    this.metrics.clear();
    this.circuitBreakers.clear();
  }

  // Convenience methods for specific physics tools
  async searchParticle(query: string, limit = 10) {
    return this.callTool('search_particle', { query, limit });
  }

  async getProperty(particle: string, property: string, pedantic = false) {
    return this.callTool('get_property', { 
      id: particle, 
      quantity: property, 
      pedantic 
    });
  }

  async getPropertyDetails(particle: string, property: string) {
    return this.callTool('get_property_details', { 
      id: particle, 
      quantity: property 
    });
  }

  async listDecays(particle: string, limit = 50, minBranchingRatio = 0) {
    return this.callTool('list_decays', { 
      id: particle, 
      limit,
      min_branching_ratio: minBranchingRatio 
    });
  }

  async findDecays(finalState: string[], minBranchingRatio = 0) {
    return this.callTool('find_decays', { 
      final_state: finalState,
      min_branching_ratio: minBranchingRatio 
    });
  }

  async listProperties(particle: string) {
    return this.callTool('list_properties', { id: particle });
  }

  async resolveIdentifier(identifier: string) {
    return this.callTool('resolve_identifier', { any: identifier });
  }

  async getDatabaseInfo() {
    return this.callTool('database_info', {});
  }
}