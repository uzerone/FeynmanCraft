// MCP Integration Types for ParticlePhysics MCP Server
export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastHeartbeat?: number;
  capabilities: string[];
  tools: MCPTool[];
  metrics: MCPServerMetrics;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  category: 'search' | 'property' | 'decay' | 'database';
  complexity: 'simple' | 'moderate' | 'complex';
  avgResponseTime: number;
  successRate: number;
}

export interface MCPServerMetrics {
  totalCalls: number;
  successfulCalls: number;
  avgResponseTime: number;
  lastCallTime?: number;
  errorRate: number;
  uptime: number;
}

export interface MCPToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  timestamp: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  responseTime?: number;
  result?: any;
  error?: string;
}

export interface MCPWorkflow {
  id: string;
  name: string;
  description: string;
  steps: MCPWorkflowStep[];
  status: 'idle' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  totalCalls: number;
  successfulCalls: number;
}

export interface MCPWorkflowStep {
  id: string;
  toolName: string;
  description: string;
  arguments: Record<string, any>;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface PhysicsValidationRequest {
  query: string;
  particles: string[];
  interactions: string[];
  validationLevel: 'basic' | 'comprehensive' | 'expert';
}

export interface PhysicsValidationResult {
  isValid: boolean;
  confidence: number;
  findings: PhysicsValidationFinding[];
  recommendations: string[];
  usedTools: string[];
  processingTime: number;
}

export interface PhysicsValidationFinding {
  type: 'particle' | 'interaction' | 'decay' | 'property';
  severity: 'info' | 'warning' | 'error';
  message: string;
  evidence: any;
  toolUsed: string;
}

// Predefined ParticlePhysics MCP Server Tools
export const PARTICLE_PHYSICS_TOOLS: MCPTool[] = [
  {
    name: 'search_particle',
    description: 'Search for particles by name, symbol, or properties',
    parameters: {
      query: { type: 'string', description: 'Search term for particle' },
      limit: { type: 'number', description: 'Maximum results (default: 10)' }
    },
    category: 'search',
    complexity: 'simple',
    avgResponseTime: 150,
    successRate: 0.95
  },
  {
    name: 'get_property',
    description: 'Get specific property of a particle',
    parameters: {
      particle: { type: 'string', description: 'Particle name or PDG ID' },
      property: { type: 'string', description: 'Property name (mass, charge, etc.)' }
    },
    category: 'property',
    complexity: 'simple',
    avgResponseTime: 120,
    successRate: 0.92
  },
  {
    name: 'get_property_details',
    description: 'Get detailed property information with uncertainties',
    parameters: {
      particle: { type: 'string', description: 'Particle name or PDG ID' },
      property: { type: 'string', description: 'Property name' }
    },
    category: 'property',
    complexity: 'moderate',
    avgResponseTime: 180,
    successRate: 0.88
  },
  {
    name: 'list_decays',
    description: 'List decay modes for a particle',
    parameters: {
      particle: { type: 'string', description: 'Particle name or PDG ID' },
      min_branching_ratio: { type: 'number', description: 'Minimum branching ratio' }
    },
    category: 'decay',
    complexity: 'moderate',
    avgResponseTime: 200,
    successRate: 0.90
  },
  {
    name: 'find_decays',
    description: 'Find particles that decay to specific final states',
    parameters: {
      final_state: { type: 'array', description: 'List of final state particles' },
      min_branching_ratio: { type: 'number', description: 'Minimum branching ratio' }
    },
    category: 'decay',
    complexity: 'complex',
    avgResponseTime: 300,
    successRate: 0.85
  },
  {
    name: 'list_properties',
    description: 'List all available properties for a particle',
    parameters: {
      particle: { type: 'string', description: 'Particle name or PDG ID' }
    },
    category: 'property',
    complexity: 'simple',
    avgResponseTime: 100,
    successRate: 0.94
  },
  {
    name: 'resolve_identifier',
    description: 'Resolve particle name/symbol to standard PDG identifier',
    parameters: {
      identifier: { type: 'string', description: 'Particle name or symbol to resolve' }
    },
    category: 'search',
    complexity: 'simple',
    avgResponseTime: 80,
    successRate: 0.96
  },
  {
    name: 'database_info',
    description: 'Get information about the PDG database version and statistics',
    parameters: {},
    category: 'database',
    complexity: 'simple',
    avgResponseTime: 60,
    successRate: 0.98
  }
];

// Predefined Physics Validation Workflows
export const PHYSICS_VALIDATION_WORKFLOWS: MCPWorkflow[] = [
  {
    id: 'particle_existence_check',
    name: 'Particle Existence Validation',
    description: 'Verify that mentioned particles exist in the PDG database',
    steps: [
      {
        id: 'search_particles',
        toolName: 'search_particle',
        description: 'Search for each particle mentioned',
        arguments: {},
        dependencies: [],
        status: 'pending'
      },
      {
        id: 'resolve_identifiers',
        toolName: 'resolve_identifier',
        description: 'Resolve particle names to standard identifiers',
        arguments: {},
        dependencies: ['search_particles'],
        status: 'pending'
      }
    ],
    status: 'idle',
    totalCalls: 0,
    successfulCalls: 0
  },
  {
    id: 'decay_validation',
    name: 'Decay Process Validation',
    description: 'Validate decay processes and branching ratios',
    steps: [
      {
        id: 'get_particle_properties',
        toolName: 'get_property',
        description: 'Get mass and charge properties',
        arguments: {},
        dependencies: [],
        status: 'pending'
      },
      {
        id: 'list_known_decays',
        toolName: 'list_decays',
        description: 'List known decay modes',
        arguments: {},
        dependencies: ['get_particle_properties'],
        status: 'pending'
      },
      {
        id: 'validate_conservation',
        toolName: 'find_decays',
        description: 'Check conservation laws',
        arguments: {},
        dependencies: ['list_known_decays'],
        status: 'pending'
      }
    ],
    status: 'idle',
    totalCalls: 0,
    successfulCalls: 0
  },
  {
    id: 'comprehensive_physics_audit',
    name: 'Comprehensive Physics Audit',
    description: 'Complete physics validation with 20+ tool calls',
    steps: [
      {
        id: 'database_status',
        toolName: 'database_info',
        description: 'Check PDG database status',
        arguments: {},
        dependencies: [],
        status: 'pending'
      },
      {
        id: 'particle_search_comprehensive',
        toolName: 'search_particle',
        description: 'Comprehensive particle search',
        arguments: {},
        dependencies: ['database_status'],
        status: 'pending'
      }
      // Additional steps will be added dynamically based on findings
    ],
    status: 'idle',
    totalCalls: 0,
    successfulCalls: 0
  }
];

export const DEFAULT_MCP_SERVER: MCPServerConfig = {
  id: 'particle-physics-server',
  name: 'ParticlePhysics MCP Server',
  url: 'http://localhost:8000',
  status: 'disconnected',
  capabilities: ['physics_validation', 'particle_search', 'decay_analysis'],
  tools: PARTICLE_PHYSICS_TOOLS,
  metrics: {
    totalCalls: 0,
    successfulCalls: 0,
    avgResponseTime: 0,
    errorRate: 0,
    uptime: 0
  }
};