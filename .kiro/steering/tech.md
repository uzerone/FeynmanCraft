---
inclusion: always
---

# FeynmanCraft ADK Technology Architecture

## Core Framework

- **Google ADK 1.0.0**: Multi-agent orchestration framework
- **Pydantic**: Data models and validation
- **Python 3.11+**: Primary programming language
- **FastAPI**: Web framework for production deployment

## Multi-Agent System Architecture

- **PlannerAgent**: Natural language parsing and task planning
- **KBRetrieverAgent**: Vector search knowledge base retrieval
- **DeepResearchAgent**: Web search for unknown physics processes
- **PhysicsValidatorAgent**: MCP tools-based physics validation
- **DiagramGeneratorAgent**: TikZ-Feynman code generation
- **TikZValidatorAgent**: LaTeX compilation and validation
- **FeedbackAgent**: Result aggregation and user feedback synthesis

## AI Model Strategy

- **gemini-2.5-pro**: Used ONLY for DeepResearchAgent (complex web research)
- **gemini-2.0-flash**: All other agents (cost-optimized approach)
- **Reasoning**: Balance capability with cost - simple agents don't need the most powerful model

## Frontend Technology Stack

- **React 19** + **TypeScript** + **Vite**
- **TailwindCSS**: Utility-first CSS framework
- **Custom React Hooks**: ADK integration and real-time workflow visualization
- **React Markdown**: LaTeX code display and formatting

## Data Storage & Retrieval

- **Local Knowledge Base**: 150+ physics examples stored as JSON
- **Annoy Vector Search**: Semantic similarity retrieval for diagram examples
- **Physics Rules Database**: Particle physics constraints and validation rules
- **Embedding Cache**: Pre-computed embeddings for fast retrieval

## Integration & Tools

- **LaTeX Compilation**: pdflatex/lualatex with comprehensive error analysis
- **MCP Protocol**: 20+ physics validation tools and external integrations
- **Docker**: Containerized deployment with all dependencies included
- **GitHub Integration**: Open source codebase with OSI licensing

## Development Philosophy

- **Cost Efficiency**: Gemini Flash model as primary choice
- **Local-First**: No BigQuery dependency, fully self-contained
- **Modular Design**: Each agent operates independently with clear interfaces
- **Prompt Engineering Focus**: Prioritize prompt optimization over external physics libraries
- **Continuous Conversation**: Support multi-turn interactions for iterative refinement