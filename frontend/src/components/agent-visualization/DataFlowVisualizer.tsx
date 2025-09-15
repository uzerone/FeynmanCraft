import { useMemo, useState } from 'react';
import { AgentStageStatus, ORDERED_AGENTS } from './types';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Clock, Database, Zap, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataPacket {
  id: string;
  source: string;
  target: string;
  type: 'physics_request' | 'kb_results' | 'validation_result' | 'diagram_code' | 'compiled_result';
  content: string;
  timestamp: number;
  processingTime?: number;
}

interface HandoffProcess {
  id: string;
  fromAgent: string;
  toAgent: string;
  status: 'pending' | 'transferring' | 'completed' | 'failed';
  data: DataPacket;
  startTime: number;
  endTime?: number;
}

interface DataFlowVisualizerProps {
  agents: AgentStageStatus[];
  isActive?: boolean;
  className?: string;
}

export function DataFlowVisualizer({ 
  agents, 
  isActive = false, 
  className 
}: DataFlowVisualizerProps) {
  const [expandedPackets, setExpandedPackets] = useState<Set<string>>(new Set());

  // Generate mock data packets based on agent states
  const dataPackets = useMemo((): DataPacket[] => {
    const packets: DataPacket[] = [];
    const now = Date.now();

    // Simulate data flow between agents
    const agentFlow = [
      'planner_agent',
      'kb_retriever_agent',
      'physics_validator_agent', 
      'diagram_generator_agent',
      'tikz_validator_agent',
      'feedback_agent'
    ];

    agentFlow.forEach((agentId, index) => {
      const agent = agents.find(a => a.id === agentId);
      if (!agent || agent.status === 'idle') return;

      const nextAgentId = agentFlow[index + 1];
      if (!nextAgentId) return;

      let packetType: DataPacket['type'];
      let content: string;

      switch (agentId) {
        case 'planner_agent':
          packetType = 'physics_request';
          content = 'Parsed request: electron-positron scattering, particles=[e-, e+, γ], interaction_type=QED';
          break;
        case 'kb_retriever_agent':
          packetType = 'kb_results';
          content = 'Retrieved 5 examples: similarity_scores=[0.95, 0.87, 0.82, 0.79, 0.76]';
          break;
        case 'physics_validator_agent':
          packetType = 'validation_result';
          content = 'Validation passed: charge_conservation=✓, energy_conservation=✓, lepton_number=✓';
          break;
        case 'diagram_generator_agent':
          packetType = 'diagram_code';
          content = 'Generated TikZ code: 47 lines, 3 vertices, 4 fermion lines, 1 photon line';
          break;
        case 'tikz_validator_agent':
          packetType = 'compiled_result';
          content = 'LaTeX compilation successful: diagram.pdf (2.3KB), compile_time=1.2s';
          break;
        default:
          packetType = 'physics_request';
          content = 'Processing data...';
      }

      packets.push({
        id: `${agentId}-${index}`,
        source: agentId,
        target: nextAgentId,
        type: packetType,
        content,
        timestamp: now - (5 - index) * 1000,
        processingTime: Math.random() * 2000 + 500
      });
    });

    return packets;
  }, [agents]);

  // Generate handoff processes
  const handoffProcesses = useMemo((): HandoffProcess[] => {
    return dataPackets.map((packet, index) => ({
      id: `handoff-${index}`,
      fromAgent: packet.source,
      toAgent: packet.target,
      status: getHandoffStatus(packet.source, agents),
      data: packet,
      startTime: packet.timestamp,
      endTime: packet.timestamp + (packet.processingTime || 1000)
    }));
  }, [dataPackets, agents]);

  function getHandoffStatus(sourceAgentId: string, agents: AgentStageStatus[]): HandoffProcess['status'] {
    const sourceAgent = agents.find(a => a.id === sourceAgentId);
    if (!sourceAgent) return 'pending';
    
    switch (sourceAgent.status) {
      case 'running': return 'transferring';
      case 'success': return 'completed';
      case 'error': return 'failed';
      default: return 'pending';
    }
  }

  const togglePacketExpansion = (packetId: string) => {
    setExpandedPackets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(packetId)) {
        newSet.delete(packetId);
      } else {
        newSet.add(packetId);
      }
      return newSet;
    });
  };

  const getPacketTypeIcon = (type: DataPacket['type']) => {
    switch (type) {
      case 'physics_request': return <FileText className="w-4 h-4 text-blue-400" />;
      case 'kb_results': return <Database className="w-4 h-4 text-purple-400" />;
      case 'validation_result': return <Zap className="w-4 h-4 text-green-400" />;
      case 'diagram_code': return <FileText className="w-4 h-4 text-orange-400" />;
      case 'compiled_result': return <FileText className="w-4 h-4 text-emerald-400" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPacketTypeLabel = (type: DataPacket['type']) => {
    switch (type) {
      case 'physics_request': return 'Physics Request';
      case 'kb_results': return 'Knowledge Base Results';  
      case 'validation_result': return 'Validation Result';
      case 'diagram_code': return 'TikZ Diagram Code';
      case 'compiled_result': return 'Compiled Result';
      default: return 'Data';
    }
  };

  const getStatusColor = (status: HandoffProcess['status']) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'transferring': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/30';
      default: return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30';
    }
  };

  const getAgentDisplayName = (agentId: string) => {
    const config = ORDERED_AGENTS.find(a => a.id === agentId);
    return config ? `${config.emoji} ${config.name}` : agentId;
  };

  return (
    <div className={className}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-neutral-100">
            Data Flow Visualization
          </h3>
          <Badge variant="outline" className="text-neutral-300 border-neutral-600">
            {handoffProcesses.filter(h => h.status === 'transferring').length} Active
          </Badge>
        </div>
        <p className="text-sm text-neutral-400">
          Real-time visualization of data transfer and processing between agents
        </p>
      </div>

      <div className="space-y-4">
        {/* Active Transfers */}
        {handoffProcesses.filter(h => h.status === 'transferring').length > 0 && (
          <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4">
            <h4 className="text-sm font-medium text-neutral-200 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Active Data Transfers
            </h4>
            
            {handoffProcesses
              .filter(h => h.status === 'transferring')
              .map((handoff) => (
                <div key={handoff.id} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-300">
                          {getAgentDisplayName(handoff.fromAgent)}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-8 h-0.5 bg-blue-500 animate-pulse rounded" />
                          <ChevronRight className="w-3 h-3 text-blue-400" />
                        </div>
                        <span className="text-sm text-neutral-300">
                          {getAgentDisplayName(handoff.toAgent)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPacketTypeIcon(handoff.data.type)}
                      <span className="text-xs text-blue-400 animate-pulse">
                        Transferring...
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Data Packets History */}
        <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4">
          <h4 className="text-sm font-medium text-neutral-200 mb-3">
            Data Transfer History
          </h4>
          
          <div className="space-y-2">
            {handoffProcesses.map((handoff) => (
              <div key={handoff.id}>
                <div 
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-colors",
                    getStatusColor(handoff.status)
                  )}
                  onClick={() => togglePacketExpansion(handoff.data.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {expandedPackets.has(handoff.data.id) ? (
                          <ChevronDown className="w-4 h-4 text-neutral-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-neutral-400" />
                        )}
                        {getPacketTypeIcon(handoff.data.type)}
                      </div>
                      
                      <div>
                        <div className="text-sm font-medium">
                          {getPacketTypeLabel(handoff.data.type)}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {getAgentDisplayName(handoff.fromAgent)} → {getAgentDisplayName(handoff.toAgent)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="w-3 h-3 text-neutral-500" />
                      <span className="text-neutral-400">
                        {new Date(handoff.startTime).toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" size="sm" className={getStatusColor(handoff.status)}>
                        {handoff.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedPackets.has(handoff.data.id) && (
                    <div className="mt-3 pt-3 border-t border-neutral-600">
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-neutral-500 uppercase tracking-wide">Content:</span>
                          <p className="text-sm text-neutral-300 mt-1 bg-neutral-800 p-2 rounded font-mono text-xs">
                            {handoff.data.content}
                          </p>
                        </div>
                        
                        {handoff.data.processingTime && (
                          <div className="flex justify-between text-xs text-neutral-500">
                            <span>Processing Time: {(handoff.data.processingTime / 1000).toFixed(2)}s</span>
                            <span>Packet Size: {Math.ceil(handoff.data.content.length / 10)}KB</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {handoffProcesses.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data transfers yet</p>
                <p className="text-xs">Start a diagram generation to see data flow</p>
              </div>
            )}
          </div>
        </div>

        {/* Transfer Statistics */}
        {handoffProcesses.length > 0 && (
          <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4">
            <h4 className="text-sm font-medium text-neutral-200 mb-3">Transfer Statistics</h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center p-2 bg-neutral-800 rounded">
                <div className="text-lg font-semibold text-green-400">
                  {handoffProcesses.filter(h => h.status === 'completed').length}
                </div>
                <div className="text-xs text-neutral-400">Completed</div>
              </div>
              
              <div className="text-center p-2 bg-neutral-800 rounded">
                <div className="text-lg font-semibold text-blue-400">
                  {handoffProcesses.filter(h => h.status === 'transferring').length}
                </div>
                <div className="text-xs text-neutral-400">Active</div>
              </div>
              
              <div className="text-center p-2 bg-neutral-800 rounded">
                <div className="text-lg font-semibold text-red-400">
                  {handoffProcesses.filter(h => h.status === 'failed').length}
                </div>
                <div className="text-xs text-neutral-400">Failed</div>
              </div>
              
              <div className="text-center p-2 bg-neutral-800 rounded">
                <div className="text-lg font-semibold text-neutral-300">
                  {(handoffProcesses.reduce((sum, h) => sum + (h.data.processingTime || 0), 0) / 1000).toFixed(1)}s
                </div>
                <div className="text-xs text-neutral-400">Total Time</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}