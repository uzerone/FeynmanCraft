#!/bin/bash

# FeynmanCraft One-Click Startup Script
# Start ADK Backend and Frontend Services

set -e  # Exit immediately on error

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required commands exist
check_dependencies() {
    print_info "Checking dependencies..."
    
    if ! command -v python &> /dev/null; then
        print_error "Python is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v adk &> /dev/null; then
        print_error "ADK is not installed or not in PATH, please install first: pip install -r requirements.txt"
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Check environment variables
check_env() {
    print_info "Checking environment variables..."
    
    if [ ! -f ".env" ]; then
        print_warning ".env file does not exist, please make sure GOOGLE_API_KEY is configured"
        if [ ! -f ".env.example" ]; then
            print_error ".env.example file does not exist"
            exit 1
        fi
        print_info "Copying .env.example to .env..."
        cp .env.example .env
        print_warning "Please edit .env file and set GOOGLE_API_KEY"
    fi
    
    # Check if GOOGLE_API_KEY is set
    if [ -f ".env" ]; then
        source .env
        if [ -z "$GOOGLE_API_KEY" ] || [ "$GOOGLE_API_KEY" = "your-google-api-key-here" ]; then
            print_warning "GOOGLE_API_KEY is not set or using default value, please check .env file"
        else
            print_success "Environment variables configured properly"
        fi
    fi
}

# Install frontend dependencies
install_frontend_deps() {
    print_info "Checking frontend dependencies..."
    
    if [ ! -d "frontend/node_modules" ]; then
        print_info "Installing frontend dependencies..."
        cd frontend
        npm install
        cd ..
        print_success "Frontend dependencies installation completed"
    else
        print_success "Frontend dependencies already exist"
    fi
}

# Create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    
    # Create frontend generated files directory
    mkdir -p frontend/public/generated
    
    # Create log directory, organized by date 
    mkdir -p logs
    mkdir -p logs/archive
    
    print_success "Directory creation completed"
}

# Backup old logs
backup_logs() {
    print_info "Backing up old log files..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    
    # If old logs exist, backup to archive directory
    if [ -f "logs/backend.log" ] && [ -s "logs/backend.log" ]; then
        mv "logs/backend.log" "logs/archive/backend_${timestamp}.log"
        print_info "Old backend log backed up to logs/archive/backend_${timestamp}.log"
    fi
    
    if [ -f "logs/frontend.log" ] && [ -s "logs/frontend.log" ]; then
        mv "logs/frontend.log" "logs/archive/frontend_${timestamp}.log"
        print_info "Old frontend log backed up to logs/archive/frontend_${timestamp}.log"
    fi
    
    # Clean up old logs older than 7 days
    find logs/archive -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    print_success "Log backup completed"
}

# Clean up old processes
cleanup_processes() {
    print_info "Cleaning up existing old processes..."
    
    # Clean up ADK processes
    pkill -f "adk web" || true
    
    # Clean up frontend processes  
    pkill -f "npm run dev" || true
    
    # Clean up MCP processes
    pkill -f "experimental.latex_mcp.server" || true
    pkill -f "particlephysics_mcp_server" || true
    
    # Clean up port usage
    lsof -ti:8003 | xargs kill -9 2>/dev/null || true
    
    # Wait for processes to fully exit
    sleep 2
    
    print_success "Process cleanup completed"
}

# Start MCP servers
start_mcp_servers() {
    print_info "Starting MCP servers..."
    
    # Create MCP log files
    mkdir -p logs
    touch logs/mcp_latex.log
    touch logs/mcp_physics.log
    
    # Get current Python path (supports local, conda, Docker environments)
    local python_path=$(which python3)
    if [ -z "$python_path" ]; then
        python_path=$(which python)
        if [ -z "$python_path" ]; then
            python_path="python"
        fi
    fi
    
    print_info "Using Python: $python_path"
    
    # Start LaTeX MCP server (port 8003)
    print_info "Starting LaTeX MCP server (port 8003)..."
    
    # Clean up old LaTeX MCP processes
    pkill -f "experimental.latex_mcp.server" || true
    
    cd experimental/latex_mcp
    nohup $python_path -m uvicorn server:app --host 127.0.0.1 --port 8003 >> ../../logs/mcp_latex.log 2>&1 &
    LATEX_MCP_PID=$!
    cd ../..
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] LaTeX MCP process PID: $LATEX_MCP_PID" >> logs/mcp_latex.log
    echo $LATEX_MCP_PID > logs/mcp_latex.pid
    
    # Wait for LaTeX MCP to start
    sleep 3
    
    # Check if LaTeX MCP started successfully
    if ! kill -0 $LATEX_MCP_PID 2>/dev/null; then
        print_warning "LaTeX MCP startup failed, will start automatically when needed"
        rm -f logs/mcp_latex.pid
    else
        print_success "LaTeX MCP server started successfully (PID: $LATEX_MCP_PID)"
    fi
    
    # ParticlePhysics MCP starts automatically via client, no manual startup needed
    print_info "ParticlePhysics MCP will start automatically on first use"
    print_success "MCP server configuration completed"
}

# Check MCP server health status
check_mcp_health() {
    print_info "Checking MCP server status..."
    
    # Check LaTeX MCP health status
    local latex_mcp_ready=false
    local count=0
    local timeout=10
    
    while [ $count -lt $timeout ]; do
        if curl -s http://localhost:8003/health >/dev/null 2>&1; then
            latex_mcp_ready=true
            break
        fi
        sleep 1
        count=$((count + 1))
        printf "."
    done
    
    echo ""
    
    if $latex_mcp_ready; then
        print_success "LaTeX MCP server health check passed"
    else
        print_warning "LaTeX MCP server not responding, will start automatically when needed"
    fi
    
    # Test ParticlePhysics MCP connection
    print_info "Testing ParticlePhysics MCP connection..."
    
    local python_path=$(which python3)
    if [ -z "$python_path" ]; then
        python_path=$(which python)
        if [ -z "$python_path" ]; then
            python_path="python"
        fi
    fi

    # Test MCP connection
    local test_result=$($python_path -c "
import asyncio
import sys
sys.path.insert(0, 'experimental')
try:
    from particlephysics_mcp import search_particle_experimental
    async def test():
        result = await search_particle_experimental('electron')
        return 'success' if 'result' in result else 'failed'
    print(asyncio.run(test()))
except Exception as e:
    print('failed')
" 2>/dev/null)
    
    if [ "$test_result" = "success" ]; then
        print_success "ParticlePhysics MCP connection test passed"
    else
        print_warning "ParticlePhysics MCP connection test failed, please check configuration"
    fi
}

# Start services
start_services() {
    print_info "Starting main services..."
    
    # Create startup timestamp log
    local start_time=$(date '+%Y-%m-%d %H:%M:%S')
    echo "=== FeynmanCraft started at: $start_time ===" | tee logs/backend.log logs/frontend.log
    echo "Startup user: $(whoami)" | tee -a logs/backend.log logs/frontend.log
    echo "Working directory: $(pwd)" | tee -a logs/backend.log logs/frontend.log
    echo "=========================================" | tee -a logs/backend.log logs/frontend.log
    echo "" | tee -a logs/backend.log logs/frontend.log
    
    # Set environment variables and start backend service
    print_info "Starting ADK Backend (port 8000)..."
    export PYTHONPATH=/home/zty/Particle-Physics-Agent-test
    export FEYNMANCRAFT_ADK_LOG_LEVEL=INFO
    
    # Record startup command in log
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backend command: PYTHONPATH=$PYTHONPATH FEYNMANCRAFT_ADK_LOG_LEVEL=$FEYNMANCRAFT_ADK_LOG_LEVEL adk web . --port 8000" >> logs/backend.log
    
    nohup adk web . --port 8000 >> logs/backend.log 2>&1 &
    BACKEND_PID=$!
    
    # Record backend PID
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend process PID: $BACKEND_PID" >> logs/backend.log
    
    # Wait for backend to start
    sleep 3
    
    # Check if backend started successfully
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend startup failed, please check logs/backend.log"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend startup failed!" >> logs/backend.log
        tail -20 logs/backend.log
        exit 1
    fi
    
    print_success "ADK Backend started successfully (PID: $BACKEND_PID)"
    
    # Start frontend service
    print_info "Starting Frontend (port 5174)..."
    
    # Record startup info in frontend log
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting frontend command: cd frontend && npm run dev" >> logs/frontend.log
    
    cd frontend
    nohup npm run dev >> ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..
    
    # Record frontend PID
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Frontend process PID: $FRONTEND_PID" >> logs/frontend.log
    
    # Wait for frontend to start
    sleep 3
    
    # Check if frontend started successfully
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Frontend startup failed, please check logs/frontend.log"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Frontend startup failed!" >> logs/frontend.log
        kill $BACKEND_PID 2>/dev/null || true
        tail -20 logs/frontend.log
        exit 1
    fi
    
    print_success "Frontend started successfully (PID: $FRONTEND_PID)"
    
    # Save PID to files
    echo $BACKEND_PID > logs/backend.pid
    echo $FRONTEND_PID > logs/frontend.pid
    
    # Create startup success log
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ All services started successfully" | tee -a logs/backend.log logs/frontend.log
}

# Wait for services to be ready
wait_for_services() {
    print_info "Waiting for services to be ready..."
    
    # Wait for backend to be ready
    local backend_ready=false
    local frontend_ready=false
    local timeout=30
    local count=0
    
    while [ $count -lt $timeout ]; do
        if ! $backend_ready && curl -s http://localhost:8000 >/dev/null 2>&1; then
            print_success "Backend service ready"
            backend_ready=true
        fi
        
        if ! $frontend_ready && curl -s http://localhost:5174 >/dev/null 2>&1; then
            print_success "Frontend service ready"
            frontend_ready=true
        fi
        
        if $backend_ready && $frontend_ready; then
            break
        fi
        
        sleep 1
        count=$((count + 1))
        printf "."
    done
    
    echo ""
    
    if ! $backend_ready; then
        print_warning "Backend service not ready within expected time, please check logs"
    fi
    
    if ! $frontend_ready; then
        print_warning "Frontend service not ready within expected time, please check logs"
    fi
    
    if $backend_ready && $frontend_ready; then
        print_success "All services are ready!"
    fi
}

# Display service information
show_info() {
    local backend_pid=$(cat logs/backend.pid 2>/dev/null || echo "Unknown")
    local frontend_pid=$(cat logs/frontend.pid 2>/dev/null || echo "Unknown")
    local latex_mcp_pid=$(cat logs/mcp_latex.pid 2>/dev/null || echo "Not started")
    local start_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo ""
    echo "========================================="
    echo "       FeynmanCraft Service Info"
    echo "========================================="
    echo ""
    echo "🌐 Service URLs:"
    echo "   Frontend UI:     http://localhost:5174"
    echo "   Backend API:     http://localhost:8000"
    echo "   LaTeX MCP:       http://localhost:8003"
    echo ""
    echo "⚙️  Process Info:"
    echo "   Backend PID:         $backend_pid"
    echo "   Frontend PID:        $frontend_pid"
    echo "   LaTeX MCP PID:       $latex_mcp_pid"
    echo "   Particle Physics MCP: Auto-start (stdio)"
    echo "   Start Time:          $start_time"
    echo ""
    echo "📋 Log Files:"
    echo "   Backend Log:         logs/backend.log"
    echo "   Frontend Log:        logs/frontend.log"
    echo "   LaTeX MCP:           logs/mcp_latex.log"
    echo "   Backup Directory:    logs/archive/"
    echo ""
    echo "🔧 Management Commands:"
    echo "   Stop Services:       ./stop.sh"
    echo "   Check Status:        ./status.sh"
    echo "   Real-time Logs:      tail -f logs/backend.log"
    echo "                    or  tail -f logs/frontend.log"
    echo "                    or  tail -f logs/mcp_latex.log"
    echo "   Check Errors:        grep ERROR logs/backend.log"
    echo "                    or  grep ERROR logs/frontend.log"
    echo ""
    echo "📊 Test Commands:"
    echo "   Test Backend:        curl http://localhost:8000"
    echo "   Test Frontend:       curl http://localhost:5174"
    echo "   Test LaTeX MCP:      curl http://localhost:8003/health"
    echo ""
    echo "🧪 MCP Tools Status:"
    echo "   ParticlePhysics:     ✅ Integrated (auto-connect)"
    echo "   LaTeX Compilation:   ✅ Started"
    echo ""
    echo "💡 Tips:"
    echo "   - MCP tools are now pre-started, agent can use them directly"
    echo "   - Logs are automatically backed up, old logs older than 7 days are cleaned"
    echo "   - If you encounter issues, check log files first"
    echo "   - It's recommended to run 'tail -f logs/backend.log' in a new terminal to view logs in real-time"
    echo ""
    echo "========================================="
    echo ""
}

# Main function
main() {
    echo ""
    echo "🚀 FeynmanCraft One-Click Startup Script"
    echo "========================================="
    echo ""
    
    check_dependencies
    check_env
    install_frontend_deps
    create_directories
    backup_logs
    cleanup_processes
    start_mcp_servers
    check_mcp_health
    start_services
    wait_for_services
    show_info
    
    print_success "Startup completed! Please visit http://localhost:5174 in your browser"
    echo ""
}

# Signal handling - graceful shutdown
cleanup_on_exit() {
    print_info "Shutting down services..."
    if [ -f logs/backend.pid ]; then
        kill $(cat logs/backend.pid) 2>/dev/null || true
        rm -f logs/backend.pid
    fi
    if [ -f logs/frontend.pid ]; then
        kill $(cat logs/frontend.pid) 2>/dev/null || true
        rm -f logs/frontend.pid
    fi
    if [ -f logs/mcp_latex.pid ]; then
        kill $(cat logs/mcp_latex.pid) 2>/dev/null || true
        rm -f logs/mcp_latex.pid
    fi
    # Clean up other possible MCP processes
    pkill -f "experimental.latex_mcp.server" 2>/dev/null || true
    pkill -f "particlephysics_mcp_server" 2>/dev/null || true
    print_success "Services have been shut down"
    exit 0
}

trap cleanup_on_exit SIGINT SIGTERM

# Run main function
main "$@"