// Tool Orchestration Engine - 轻量编排，能跑20+步
import { MCPClient, MCPError } from './mcpClient';

export type StepContext = {
  particle: string;
  pedantic?: boolean;
  bag: Record<string, any>;
  metadata: {
    startTime: number;
    particleIndex: number;
    totalParticles: number;
  };
};

export type OrchestrationStep = {
  id: string;
  name: string;
  description: string;
  run: (client: MCPClient, ctx: StepContext) => Promise<void>;
  onError?: (error: MCPError, ctx: StepContext) => 'continue' | 'abort' | 'fallback';
  fallback?: OrchestrationStep;
  category: 'search' | 'property' | 'decay' | 'validation' | 'resolution';
  critical: boolean; // 关键步骤失败会中断整个粒子的处理
};

export type WorkflowEvent =
  | { type: 'workflow.start'; particles: string[]; timestamp: number }
  | { type: 'workflow.end'; particles: string[]; timestamp: number; duration: number }
  | { type: 'particle.start'; particle: string; index: number; total: number; timestamp: number }
  | { type: 'particle.end'; particle: string; timestamp: number; duration: number; success: boolean }
  | { type: 'step.start'; particle: string; step: string; stepId: string; timestamp: number }
  | { type: 'step.success'; particle: string; step: string; stepId: string; timestamp: number; duration: number; result?: any }
  | { type: 'step.error'; particle: string; step: string; stepId: string; timestamp: number; duration: number; error: any }
  | { type: 'step.fallback'; particle: string; step: string; stepId: string; fallbackStep: string; timestamp: number }
  | { type: 'step.skip'; particle: string; step: string; stepId: string; reason: string; timestamp: number }
  | { type: 'circuit.open'; tool: string; particle: string; timestamp: number }
  | { type: 'circuit.close'; tool: string; particle: string; timestamp: number };

export type WorkflowReporter = (event: WorkflowEvent) => void;

// 五条展示链路的步骤定义
export const PHYSICS_WORKFLOW_STEPS: OrchestrationStep[] = [
  {
    id: 'search_particle',
    name: 'Search Particle',
    description: 'Find particle in PDG database',
    category: 'search',
    critical: true,
    run: async (client, ctx) => {
      const result = await client.searchParticle(ctx.particle, 10);
      if (!result.data || !result.data.items?.length) {
        throw new Error(`Particle '${ctx.particle}' not found in PDG database`);
      }
      ctx.bag.searchResult = result.data;
      ctx.bag.pdgId = result.data.items[0].pdgid || result.data.items[0].mcid;
      ctx.bag.canonicalName = result.data.items[0].name;
    },
    onError: () => 'abort', // 找不到粒子就中断
  },
  {
    id: 'resolve_identifier',
    name: 'Resolve Identifier',
    description: 'Get canonical particle identifier',
    category: 'resolution',
    critical: false,
    run: async (client, ctx) => {
      const result = await client.resolveIdentifier(ctx.bag.pdgId || ctx.particle);
      ctx.bag.resolvedId = result.data;
      ctx.bag.standardName = result.data?.standard_name || ctx.bag.canonicalName;
    },
    onError: () => 'continue', // 解析失败不影响后续步骤
  },
  {
    id: 'get_mass',
    name: 'Get Mass Property',
    description: 'Retrieve particle mass',
    category: 'property',
    critical: false,
    run: async (client, ctx) => {
      const result = await client.getProperty(ctx.bag.pdgId, 'mass', ctx.pedantic);
      ctx.bag.mass = result.data;
    },
    onError: (error) => error.code === -32001 ? 'fallback' : 'continue',
    fallback: {
      id: 'get_mass_fallback',
      name: 'Get Mass (Non-pedantic)',
      description: 'Retrieve mass with relaxed precision',
      category: 'property',
      critical: false,
      run: async (client, ctx) => {
        const result = await client.getProperty(ctx.bag.pdgId, 'mass', false);
        ctx.bag.mass = result.data;
        ctx.bag.massMode = 'non-pedantic';
      }
    }
  },
  {
    id: 'get_charge',
    name: 'Get Charge Property',
    description: 'Retrieve particle electric charge',
    category: 'property',
    critical: false,
    run: async (client, ctx) => {
      const result = await client.getProperty(ctx.bag.pdgId, 'charge', false);
      ctx.bag.charge = result.data;
    },
    onError: () => 'continue',
  },
  {
    id: 'get_lifetime',
    name: 'Get Lifetime Property',
    description: 'Retrieve particle lifetime/width',
    category: 'property',
    critical: false,
    run: async (client, ctx) => {
      try {
        const result = await client.getProperty(ctx.bag.pdgId, 'lifetime', false);
        ctx.bag.lifetime = result.data;
      } catch {
        // Try width instead for unstable particles
        const result = await client.getProperty(ctx.bag.pdgId, 'width', false);
        ctx.bag.width = result.data;
        ctx.bag.lifetimeType = 'width';
      }
    },
    onError: () => 'continue', // 稳定粒子没有lifetime/width
  },
  {
    id: 'list_properties',
    name: 'List Available Properties',
    description: 'Get all available properties for this particle',
    category: 'property',
    critical: false,
    run: async (client, ctx) => {
      const result = await client.listProperties(ctx.bag.pdgId);
      ctx.bag.availableProperties = result.data;
    },
    onError: () => 'continue',
  },
  {
    id: 'list_decays',
    name: 'List Decay Modes',
    description: 'Get decay channels and branching ratios',
    category: 'decay',
    critical: false,
    run: async (client, ctx) => {
      const result = await client.listDecays(ctx.bag.pdgId, 50, 0.001);
      ctx.bag.decays = result.data;
      ctx.bag.decayCount = result.data?.decays?.length || 0;
    },
    onError: () => 'continue', // 稳定粒子没有衰变模式
  },
  {
    id: 'get_mass_details',
    name: 'Get Mass Details',
    description: 'Get detailed mass measurement with uncertainties',
    category: 'property',
    critical: false,
    run: async (client, ctx) => {
      const result = await client.getPropertyDetails(ctx.bag.pdgId, 'mass');
      ctx.bag.massDetails = result.data;
    },
    onError: () => 'continue',
  },
  {
    id: 'get_width_details',
    name: 'Get Width Details',
    description: 'Get detailed width measurement for unstable particles',
    category: 'property',
    critical: false,
    run: async (client, ctx) => {
      const result = await client.getPropertyDetails(ctx.bag.pdgId, 'width');
      ctx.bag.widthDetails = result.data;
    },
    onError: () => 'continue', // 稳定粒子没有width
  },
  {
    id: 'validate_conservation',
    name: 'Validate Conservation Laws',
    description: 'Check conservation in decay processes',
    category: 'validation',
    critical: false,
    run: async (client, ctx) => {
      if (ctx.bag.decays?.decays?.length > 0) {
        const firstDecay = ctx.bag.decays.decays[0];
        if (firstDecay.final_state?.length > 0) {
          const result = await client.findDecays(firstDecay.final_state, 0.001);
          ctx.bag.conservationCheck = result.data;
        }
      }
    },
    onError: () => 'continue',
  }
];

// 五条展示链路配置
export const DEMONSTRATION_WORKFLOWS = {
  electron: {
    name: 'Electron (Stable Lepton)',
    description: 'Lightweight charged lepton validation',
    steps: ['search_particle', 'resolve_identifier', 'get_mass', 'get_charge', 'list_properties'],
    expectedCalls: 5
  },
  muon: {
    name: 'Muon (Unstable Lepton)',
    description: 'Medium-weight lepton with decay analysis',
    steps: ['search_particle', 'resolve_identifier', 'get_mass', 'get_charge', 'get_lifetime', 'list_decays', 'validate_conservation'],
    expectedCalls: 7
  },
  pi0: {
    name: 'Pi0 Meson (Neutral Pion)',
    description: 'Neutral meson with electromagnetic decays',
    steps: ['search_particle', 'resolve_identifier', 'get_mass', 'get_width_details', 'list_decays', 'list_properties'],
    expectedCalls: 6
  },
  B0: {
    name: 'B0 Meson (Beauty Meson)',
    description: 'Heavy flavor meson with complex decay patterns',
    steps: ['search_particle', 'resolve_identifier', 'get_mass', 'get_mass_details', 'get_lifetime', 'list_decays', 'validate_conservation', 'list_properties'],
    expectedCalls: 8
  },
  H0: {
    name: 'Higgs Boson',
    description: 'Scalar boson with detailed mass measurements',
    steps: ['search_particle', 'resolve_identifier', 'get_mass', 'get_mass_details', 'get_width_details', 'list_decays', 'list_properties'],
    expectedCalls: 7
  }
};

export class PhysicsOrchestrator {
  private client: MCPClient;
  private isRunning = false;
  private abortController?: AbortController;

  constructor(client: MCPClient) {
    this.client = client;
  }

  async runDemonstrationWorkflow(
    particles: string[],
    reporter: WorkflowReporter,
    options: {
      concurrency?: number;
      pedantic?: boolean;
      abortSignal?: AbortSignal;
    } = {}
  ): Promise<void> {
    if (this.isRunning) {
      throw new Error('Workflow already running');
    }

    this.isRunning = true;
    this.abortController = new AbortController();
    
    const startTime = Date.now();
    
    try {
      reporter({
        type: 'workflow.start',
        particles,
        timestamp: startTime
      });

      // 并发处理粒子（默认并发度为2）
      const concurrency = Math.min(options.concurrency || 2, particles.length);
      const particleChunks: string[][] = [];
      
      for (let i = 0; i < particles.length; i += concurrency) {
        particleChunks.push(particles.slice(i, i + concurrency));
      }

      for (const chunk of particleChunks) {
        if (this.abortController.signal.aborted || options.abortSignal?.aborted) {
          break;
        }

        await Promise.all(
          chunk.map((particle, index) => 
            this.processParticle(
              particle, 
              particles.indexOf(particle), 
              particles.length,
              reporter,
              { pedantic: options.pedantic }
            )
          )
        );
      }

      const duration = Date.now() - startTime;
      reporter({
        type: 'workflow.end',
        particles,
        timestamp: Date.now(),
        duration
      });

    } finally {
      this.isRunning = false;
      this.abortController = undefined;
    }
  }

  private async processParticle(
    particle: string,
    index: number,
    total: number,
    reporter: WorkflowReporter,
    options: { pedantic?: boolean } = {}
  ): Promise<void> {
    const particleStartTime = Date.now();
    let success = false;

    reporter({
      type: 'particle.start',
      particle,
      index,
      total,
      timestamp: particleStartTime
    });

    // 创建粒子上下文
    const context: StepContext = {
      particle,
      pedantic: options.pedantic || false,
      bag: {},
      metadata: {
        startTime: particleStartTime,
        particleIndex: index,
        totalParticles: total
      }
    };

    // 获取该粒子的工作流步骤
    const workflowConfig = DEMONSTRATION_WORKFLOWS[particle as keyof typeof DEMONSTRATION_WORKFLOWS];
    const stepIds = workflowConfig?.steps || ['search_particle', 'resolve_identifier', 'get_mass'];
    const steps = PHYSICS_WORKFLOW_STEPS.filter(step => stepIds.includes(step.id));

    try {
      for (const step of steps) {
        if (this.abortController?.signal.aborted) {
          break;
        }

        await this.executeStep(step, context, reporter);
      }
      success = true;
    } catch (error) {
      // Particle processing failed completely
      success = false;
    }

    const duration = Date.now() - particleStartTime;
    reporter({
      type: 'particle.end',
      particle,
      timestamp: Date.now(),
      duration,
      success
    });
  }

  private async executeStep(
    step: OrchestrationStep,
    context: StepContext,
    reporter: WorkflowReporter
  ): Promise<void> {
    const stepStartTime = Date.now();
    
    reporter({
      type: 'step.start',
      particle: context.particle,
      step: step.name,
      stepId: step.id,
      timestamp: stepStartTime
    });

    try {
      await step.run(this.client, context);
      
      const duration = Date.now() - stepStartTime;
      reporter({
        type: 'step.success',
        particle: context.particle,
        step: step.name,
        stepId: step.id,
        timestamp: Date.now(),
        duration,
        result: this.extractStepResult(step.id, context.bag)
      });

    } catch (error) {
      const duration = Date.now() - stepStartTime;
      const mcpError = error as MCPError;
      
      reporter({
        type: 'step.error',
        particle: context.particle,
        step: step.name,
        stepId: step.id,
        timestamp: Date.now(),
        duration,
        error: {
          message: mcpError.message,
          code: mcpError.code,
          isRetryable: mcpError.isRetryable
        }
      });

      // 处理错误策略
      const errorPolicy = step.onError?.(mcpError, context) || 'continue';
      
      if (errorPolicy === 'fallback' && step.fallback) {
        reporter({
          type: 'step.fallback',
          particle: context.particle,
          step: step.name,
          stepId: step.id,
          fallbackStep: step.fallback.name,
          timestamp: Date.now()
        });
        
        await this.executeStep(step.fallback, context, reporter);
      } else if (errorPolicy === 'abort' || step.critical) {
        throw error; // 中断粒子处理
      }
      // 'continue' 策略：忽略错误，继续下一步
    }
  }

  private extractStepResult(stepId: string, bag: Record<string, any>): any {
    // 提取步骤结果用于UI显示（避免传输过大的数据）
    switch (stepId) {
      case 'search_particle':
        return { found: !!bag.searchResult, pdgId: bag.pdgId };
      case 'get_mass':
        return { value: bag.mass?.value, unit: bag.mass?.unit };
      case 'list_decays':
        return { count: bag.decayCount };
      case 'list_properties':
        return { count: bag.availableProperties?.length };
      default:
        return { success: true };
    }
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  public get isWorkflowRunning(): boolean {
    return this.isRunning;
  }
}

// 预定义的演示场景
export function createDemonstrationScenarios() {
  return {
    basic: {
      name: 'Basic Physics Validation (10 calls)',
      particles: ['electron', 'muon'],
      description: 'Lightweight demonstration with stable and unstable leptons'
    },
    comprehensive: {
      name: 'Comprehensive Physics Audit (20+ calls)',
      particles: ['electron', 'muon', 'pi0', 'B0'],
      description: 'Full spectrum: leptons, mesons, and heavy flavor physics'
    },
    advanced: {
      name: 'Advanced Physics Showcase (25+ calls)',
      particles: ['electron', 'muon', 'pi0', 'B0', 'H0'],
      description: 'Complete physics landscape including the Higgs boson'
    },
    stress_test: {
      name: 'Stress Test (40+ calls)',
      particles: ['electron', 'muon', 'pi0', 'pi+', 'B0', 'B+', 'H0', 'Z0'],
      description: 'High-volume demonstration for performance testing'
    }
  };
}