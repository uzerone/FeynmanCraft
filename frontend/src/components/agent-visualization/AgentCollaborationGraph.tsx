import { useRef, useMemo } from 'react';
import { AgentStageStatus, ORDERED_AGENTS } from './types';
import { Badge } from '@/components/ui/badge';

interface AgentNode {
  id: string;
  name: string;
  emoji: string;
  status: AgentStageStatus['status'];
  x: number;
  y: number;
  color: string;
  progress: number;
  isActive: boolean;
}

interface AgentConnection {
  source: string;
  target: string;
  isActive: boolean;
  isCompleted: boolean;
}

interface AgentCollaborationGraphProps {
  agents: AgentStageStatus[];
  isActive?: boolean;
  className?: string;
}

export function AgentCollaborationGraph({ 
  agents, 
  isActive = false, 
  className 
}: AgentCollaborationGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Calculate node positions in a circular layout
  const nodes = useMemo((): AgentNode[] => {
    const centerX = 200;
    const centerY = 200;
    const radius = 120;
    
    return ORDERED_AGENTS.map((agentConfig, index) => {
      const agent = agents.find(a => a.id === agentConfig.id);
      const angle = (index * 2 * Math.PI) / ORDERED_AGENTS.length - Math.PI / 2; // Start from top
      
      return {
        id: agentConfig.id,
        name: agentConfig.name,
        emoji: agentConfig.emoji,
        status: agent?.status || 'idle',
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        color: agentConfig.color,
        progress: agent?.progress || 0,
        isActive: agent?.status === 'running' || false
      };
    });
  }, [agents]);

  // Calculate connections based on agent flow
  const connections = useMemo((): AgentConnection[] => {
    const agentFlow = [
      'planner_agent',
      'kb_retriever_agent', 
      'physics_validator_agent',
      'diagram_generator_agent',
      'tikz_validator_agent',
      'feedback_agent'
    ];

    const connections: AgentConnection[] = [];
    
    for (let i = 0; i < agentFlow.length - 1; i++) {
      const sourceAgent = agents.find(a => a.id === agentFlow[i]);
      const targetAgent = agents.find(a => a.id === agentFlow[i + 1]);
      
      connections.push({
        source: agentFlow[i],
        target: agentFlow[i + 1],
        isActive: sourceAgent?.status === 'running' || targetAgent?.status === 'running',
        isCompleted: sourceAgent?.status === 'success' && targetAgent?.status !== 'idle'
      });
    }

    return connections;
  }, [agents]);

  // Get node position by ID
  const getNodePosition = (nodeId: string) => {
    return nodes.find(n => n.id === nodeId) || { x: 0, y: 0 };
  };

  // Get status color
  const getStatusColor = (status: AgentStageStatus['status']) => {
    switch (status) {
      case 'success': return '#22c55e';
      case 'running': return '#3b82f6';
      case 'error': return '#ef4444';
      case 'waiting': return '#f59e0b';
      case 'queued': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  return (
    <div className={className}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-neutral-100">
            Agent Collaboration Network
          </h3>
          <Badge variant="outline" className="text-neutral-300 border-neutral-600">
            {isActive ? 'Active' : 'Idle'}
          </Badge>
        </div>
        <p className="text-sm text-neutral-400 mb-4">
          Interactive visualization of agent data flow and collaboration patterns
        </p>
      </div>

      <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 p-4">
        <svg
          ref={svgRef}
          width="400"
          height="400"
          viewBox="0 0 400 400"
          className="w-full h-auto max-w-md mx-auto"
        >
          {/* Background grid */}
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="#374151"
                strokeWidth="0.5"
                opacity="0.3"
              />
            </pattern>
            
            {/* Gradient definitions for connections */}
            <linearGradient id="activeConnection" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
            </linearGradient>
            
            <linearGradient id="completedConnection" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          <rect width="400" height="400" fill="url(#grid)" />

          {/* Render connections */}
          {connections.map((connection, index) => {
            const source = getNodePosition(connection.source);
            const target = getNodePosition(connection.target);
            
            let strokeColor = '#4b5563';
            let strokeWidth = 2;
            let opacity = 0.4;
            
            if (connection.isActive) {
              strokeColor = 'url(#activeConnection)';
              strokeWidth = 3;
              opacity = 1;
            } else if (connection.isCompleted) {
              strokeColor = 'url(#completedConnection)';
              strokeWidth = 2.5;
              opacity = 0.8;
            }

            return (
              <g key={`connection-${index}`}>
                {/* Connection line */}
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  strokeDasharray={connection.isActive ? "5,5" : "none"}
                  className={connection.isActive ? "animate-pulse" : ""}
                />
                
                {/* Arrow marker */}
                <polygon
                  points={`${target.x - 8},${target.y - 4} ${target.x - 8},${target.y + 4} ${target.x - 2},${target.y}`}
                  fill={connection.isActive ? '#3b82f6' : '#22c55e'}
                  opacity={connection.isActive || connection.isCompleted ? 0.8 : 0.3}
                />
              </g>
            );
          })}

          {/* Render nodes */}
          {nodes.map((node) => (
            <g key={node.id}>
              {/* Node background circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r="30"
                fill={getStatusColor(node.status)}
                opacity="0.15"
                stroke={getStatusColor(node.status)}
                strokeWidth="2"
                strokeOpacity="0.8"
                className={node.isActive ? "animate-pulse" : ""}
              />
              
              {/* Progress ring */}
              {node.progress > 0 && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="25"
                  fill="none"
                  stroke={getStatusColor(node.status)}
                  strokeWidth="3"
                  strokeOpacity="0.6"
                  strokeDasharray={`${(node.progress / 100) * 157} 157`}
                  strokeDashoffset="-39.25"
                  transform={`rotate(-90 ${node.x} ${node.y})`}
                />
              )}
              
              {/* Agent emoji */}
              <text
                x={node.x}
                y={node.y + 6}
                textAnchor="middle"
                fontSize="18"
                className="pointer-events-none select-none"
              >
                {node.emoji}
              </text>
              
              {/* Status indicator */}
              <circle
                cx={node.x + 20}
                cy={node.y - 20}
                r="4"
                fill={getStatusColor(node.status)}
                className={node.isActive ? "animate-ping" : ""}
              />
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>
            <span className="text-neutral-400">Active Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-gradient-to-r from-green-500 to-emerald-500"></div>
            <span className="text-neutral-400">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-neutral-400">Running</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-neutral-400">Success</span>
          </div>
        </div>

        {/* Agent labels */}
        <div className="mt-4 space-y-1">
          <h4 className="text-sm font-medium text-neutral-300 mb-2">Active Agents:</h4>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {nodes.map((node) => (
              <div 
                key={node.id} 
                className={`flex items-center gap-2 p-1 rounded ${
                  node.isActive ? 'bg-blue-500/10 text-blue-300' : 'text-neutral-500'
                }`}
              >
                <span>{node.emoji}</span>
                <span className="truncate">{node.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}