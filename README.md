# FeynmanCraft

**Intelligent Multi-Agent TikZ Feynman Diagram Generation System** based on Google Agent Development Kit.

![Version](https://img.shields.io/badge/version-0.3.4-brightgreen)
![License](https://img.shields.io/badge/license-MIT%2FApache--2.0-blue)
![ADK](https://img.shields.io/badge/ADK-1.0.0-green)
![Python](https://img.shields.io/badge/python-3.9%2B-blue)
![Status](https://img.shields.io/badge/status-Hackathon-orange)

## Overview

FeynmanCraft is an **autonomous learning intelligent research assistant** built on Google Agent Development Kit, capable of automatically generating high-quality TikZ Feynman diagram code from natural language descriptions. This hackathon project demonstrates innovative **multi-agent collaboration** with AI-powered physics validation.

### Features

- **7-Agent Collaboration System**: Specialized agents working together intelligently
- **Local Knowledge Base**: Vector search + keyword search hybrid retrieval
- **Physics Validation**: AI-powered physics consistency checking
- **Natural Language Processing**: Supports Chinese and English descriptions
- **Smart AI Routing**: Automatic decision-making based on query complexity
- **TikZ Code Generation**: High-quality LaTeX Feynman diagram code

## System Architecture

### Intelligent Workflow

```
User Request → PlannerAgent → KBRetrieverAgent → PhysicsValidatorAgent
    ↓                              ↓                    ↓
Natural Language Parsing → Knowledge Base Search → AI Physics Validation
    ↓                              ↓                    ↓
DiagramGeneratorAgent → TikZValidatorAgent → FeedbackAgent
    ↓                              ↓                    ↓
TikZ Code Generation → AI Syntax Validation → Final Response Synthesis
```

**Key advantages of this AI-driven approach:**
- Pure prompt-based validation without external dependencies
- Intelligent physics consistency checking
- Streamlined deployment suitable for hackathon demonstrations

## System

### Core Agents 

1. **PlannerAgent** - Natural language parsing and task planning
2. **KBRetrieverAgent** - Local vector search and keyword retrieval
3. **PhysicsValidatorAgent** - MCP-enhanced physics correctness validation
4. **DiagramGeneratorAgent** - TikZ-Feynman code generation expert
5. **TikZValidatorAgent** - LaTeX compilation validation
6. **DeepResearchAgent** - Advanced research using Google Search API
7. **FeedbackAgent** - Result aggregation and user feedback


## One-Click Launch (Recommended)

For colleagues and testers to get started quickly, we provide complete one-click launch scripts:

###  Simple Launch

```bash
# 1. Configure environment variables (first time only)
cp .env.example .env
# Edit .env file and set your GOOGLE_API_KEY

# 2. One-click launch all services
./start.sh

# 3. Visit http://localhost:xxxx to start using!
```

###  Script Management


```bash
# Start services (auto log backup, dependency check, health check)
./start.sh

# Stop services (graceful shutdown, port cleanup)
./stop.sh  

# Check status (process status, resource usage, log statistics)
./status.sh

# View detailed status (including recent logs)
./status.sh --verbose
```

###  Real-time Monitoring

```bash
# View backend logs in real-time
tail -f logs/backend.log

# View frontend logs in real-time
tail -f logs/frontend.log

# Check error information
grep ERROR logs/backend.log
```

### Troubleshooting

```bash
# Check service status
./status.sh

# If ports are occupied
lsof -i :8000  # Check backend port
lsof -i :5174  # Check frontend port

# Force cleanup (if needed)
pkill -f "adk web"
pkill -f "npm run dev"

# Restart services
./stop.sh && ./start.sh
```

## Specification

### Core Frameworks
- **Google ADK 1.0.0** - Multi-agent orchestration framework
- **Google Gemini** - Language models (gemini-2.5-flash primary, gemini-2.5-pro for complex tasks)
- **MCP (Model Context Protocol)** - Enhanced tool communication protocol
- **Pydantic** - Data validation and serialization

### Frontend Stack
- **React 19** - UI framework with modern hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool with ADK proxy configuration
- **TailwindCSS** - Utility-first CSS framework
- **Lucide React** - Icon library

### Professional Tools
- **TikZ-Feynman** - Feynman diagram drawing
- **LaTeX** - Document compilation
- **MCP Particle Physics Tools** - 20+ professional particle physics tools
- **Annoy** - Local vector similarity search
- **Vertex AI** - Vector embedding generation

### Development Tools
- **Conda** - Environment management
- **pytest** - Testing framework


## 📄 License

This project is dual-licensed under MIT License and Apache License 2.0.

Please see the [LICENSE](LICENSE) file for details. You may choose either license when using this project.

## Maintainers

This project is developed and maintained by:
- [@uzerone](https://github.com/uzerone)
- [@bee4come](https://github.com/bee4come)

---