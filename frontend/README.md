# FeynmanCraft Frontend

React-based web interface for the FeynmanCraft system.

## Quick Start

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Ensure ADK backend is running:**
   ```bash
   # In the project root directory
   adk web . --port 8000
   ```

4. **Open browser:**
   - Frontend: http://localhost:5174
   - Backend API: http://localhost:8000

## Features

- **Real-time Agent Monitoring**: Track the 6-agent workflow in real-time
- **Feynman Diagram Generation**: Generate TikZ diagrams from natural language
- **Responsive Design**: Modern UI with dark theme
- **Copy to Clipboard**: Easy copying of generated LaTeX code

## Architecture

- **React 19** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **Radix UI** for accessible components
- **LangGraph SDK** for ADK communication

## Agent Flow Visualization

The frontend tracks these agent stages:
1. **Planning Request** - Parse natural language
2. **Knowledge Base Search** - Find similar examples
3. **Physics Validation** - Validate particle interactions
4. **Diagram Generation** - Generate TikZ code
5. **LaTeX Compilation** - Compile and validate
6. **Final Response** - Present results

## Example Queries

- "Generate Feynman diagram for electron-positron annihilation"
- "Draw a Z boson decay to lepton pair diagram"
- "Show muon decay process"
- "Create diagram for photon-electron scattering"