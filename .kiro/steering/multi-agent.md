---
inclusion: fileMatch
fileMatchPattern: "feynmancraft_adk/sub_agents/**/*"
---

# Multi-Agent Development Standards

## Agent Architecture Principles

1. **Single Responsibility**: Each agent focuses on one specific task domain
2. **Chain Collaboration**: Execute in fixed workflow sequence with clear handoffs
3. **State Management**: Pass intermediate results through shared state objects
4. **Error Recovery**: Include retry mechanisms and graceful degradation strategies
5. **Conditional Correction Loop**: Support iterative refinement until quality targets met

## Code Organization Structure

```
sub_agents/
├── {agent_name}_agent.py          # Agent implementation
├── {agent_name}_agent_prompt.py   # Prompt templates and instructions
└── __init__.py                    # Agent exports
```

## Agent Implementation Standards

- **Base Class**: Inherit from `google.adk.agents.Agent`
- **Model Configuration**: Prefer `GEMINI_2_0_FLASH` unless complex reasoning required
- **Error Handling**: Comprehensive error handling with informative messages
- **State Validation**: Validate input state and ensure proper output state structure
- **Logging**: Use structured logging for debugging and monitoring
- **Documentation**: Clear docstrings explaining agent purpose and workflow

## Prompt Engineering Standards

- **Role Definition**: Clear, specific role descriptions for each agent
- **Output Format**: Explicit JSON schema requirements for structured responses
- **Error Instructions**: Detailed error handling and recovery procedures
- **Physics Accuracy**: Emphasis on particle physics terminology precision
- **Context Awareness**: Leverage knowledge base examples and physics rules
- **Chain-of-Thought**: Structured reasoning process for complex decisions

## Inter-Agent Communication Protocol

- **State Schema**: Use Pydantic models for type-safe state management
- **Transfer Points**: Clear conditions for agent-to-agent handoffs
- **Validation Gates**: Quality checkpoints before proceeding to next agent
- **Rollback Capability**: Ability to return to previous agents for corrections

## Testing Standards

- **Unit Tests**: Each agent should have comprehensive unit tests
- **Integration Tests**: Test complete agent chains with realistic inputs
- **Physics Validation**: Verify physics accuracy with known test cases
- **Performance Tests**: Monitor response times and resource usage