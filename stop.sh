#!/bin/bash

# FeynmanCraft Stop Services Script

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

# Log stop event
log_stop_event() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] 🛑 FeynmanCraft service stopped" | tee -a logs/backend.log logs/frontend.log 2>/dev/null || true
}

# Stop services
stop_services() {
    print_info "Stopping FeynmanCraft services..."
    
    local stopped_any=false
    
    # Stop backend service
    if [ -f "logs/backend.pid" ]; then
        local backend_pid=$(cat logs/backend.pid)
        if [ -n "$backend_pid" ] && kill -0 $backend_pid 2>/dev/null; then
            print_info "Stopping backend service (PID: $backend_pid)..."
            kill $backend_pid 2>/dev/null || true
            
            # Wait for process to stop
            local count=0
            while [ $count -lt 10 ] && kill -0 $backend_pid 2>/dev/null; do
                sleep 1
                count=$((count + 1))
            done
            
            # If process still exists, force kill
            if kill -0 $backend_pid 2>/dev/null; then
                print_warning "Backend process not responding, force stopping..."
                kill -9 $backend_pid 2>/dev/null || true
            fi
            
            print_success "Backend service stopped"
            stopped_any=true
        else
            print_warning "Backend process does not exist or already stopped"
        fi
        rm -f logs/backend.pid
    else
        print_warning "Backend PID file not found"
    fi
    
    # Stop frontend service
    if [ -f "logs/frontend.pid" ]; then
        local frontend_pid=$(cat logs/frontend.pid)
        if [ -n "$frontend_pid" ] && kill -0 $frontend_pid 2>/dev/null; then
            print_info "Stopping frontend service (PID: $frontend_pid)..."
            kill $frontend_pid 2>/dev/null || true
            
            # Wait for process to stop
            local count=0
            while [ $count -lt 10 ] && kill -0 $frontend_pid 2>/dev/null; do
                sleep 1
                count=$((count + 1))
            done
            
            # If process still exists, force kill
            if kill -0 $frontend_pid 2>/dev/null; then
                print_warning "Frontend process not responding, force stopping..."
                kill -9 $frontend_pid 2>/dev/null || true
            fi
            
            print_success "Frontend service stopped"
            stopped_any=true
        else
            print_warning "Frontend process does not exist or already stopped"
        fi
        rm -f logs/frontend.pid
    else
        print_warning "Frontend PID file not found"
    fi
    
    # Stop LaTeX MCP service
    if [ -f "logs/mcp_latex.pid" ]; then
        local latex_mcp_pid=$(cat logs/mcp_latex.pid)
        if [ -n "$latex_mcp_pid" ] && kill -0 $latex_mcp_pid 2>/dev/null; then
            print_info "Stopping LaTeX MCP service (PID: $latex_mcp_pid)..."
            kill $latex_mcp_pid 2>/dev/null || true
            
            # Wait for process to stop
            local count=0
            while [ $count -lt 5 ] && kill -0 $latex_mcp_pid 2>/dev/null; do
                sleep 1
                count=$((count + 1))
            done
            
            # If process still exists, force kill
            if kill -0 $latex_mcp_pid 2>/dev/null; then
                kill -9 $latex_mcp_pid 2>/dev/null || true
            fi
            
            print_success "LaTeX MCP service stopped"
            stopped_any=true
        else
            print_warning "LaTeX MCP process does not exist or already stopped"
        fi
        rm -f logs/mcp_latex.pid
    else
        print_info "LaTeX MCP PID file not found"
    fi
    
    # Additional cleanup: kill possible missed processes by process name
    print_info "Cleaning up possible missed processes..."
    pkill -f "adk web" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "experimental.latex_mcp.server" 2>/dev/null || true
    pkill -f "particlephysics_mcp_server" 2>/dev/null || true
    
    # Log stop event
    log_stop_event
    
    if [ "$stopped_any" = true ]; then
        print_success "All services stopped"
    else
        print_info "No running services to stop"
    fi
}

# Check port usage
check_ports() {
    print_info "Checking port usage..."
    
    # Check port 8000 (backend)
    if lsof -i :8000 >/dev/null 2>&1; then
        print_warning "Port 8000 is still occupied:"
        lsof -i :8000 | head -5
        print_info "To force cleanup, run: lsof -ti :8000 | xargs kill -9"
    else
        print_success "Port 8000 released"
    fi
    
    # Check port 5174 (frontend)
    if lsof -i :5174 >/dev/null 2>&1; then
        print_warning "Port 5174 is still occupied:"
        lsof -i :5174 | head -5
        print_info "To force cleanup, run: lsof -ti :5174 | xargs kill -9"
    else
        print_success "Port 5174 released"
    fi
    
    # Check port 8003 (LaTeX MCP)
    if lsof -i :8003 >/dev/null 2>&1; then
        print_warning "Port 8003 is still occupied:"
        lsof -i :8003 | head -5
        print_info "To force cleanup, run: lsof -ti :8003 | xargs kill -9"
    else
        print_success "Port 8003 released"
    fi
}

# Display service status
show_status() {
    echo ""
    echo "========================================="
    echo "       FeynmanCraft Service Status"
    echo "========================================="
    echo ""
    
    # Check service status
    local backend_running=false
    local frontend_running=false
    
    if [ -f "logs/backend.pid" ]; then
        local backend_pid=$(cat logs/backend.pid)
        if [ -n "$backend_pid" ] && kill -0 $backend_pid 2>/dev/null; then
            backend_running=true
            echo "🟢 Backend Service:    Running (PID: $backend_pid)"
        else
            echo "🔴 Backend Service:    Stopped"
        fi
    else
        echo "🔴 Backend Service:    Stopped"
    fi
    
    if [ -f "logs/frontend.pid" ]; then
        local frontend_pid=$(cat logs/frontend.pid)
        if [ -n "$frontend_pid" ] && kill -0 $frontend_pid 2>/dev/null; then
            frontend_running=true
            echo "🟢 Frontend Service:    Running (PID: $frontend_pid)"
        else
            echo "🔴 Frontend Service:    Stopped"
        fi
    else
        echo "🔴 Frontend Service:    Stopped"
    fi
    
    echo ""
    
    if [ "$backend_running" = false ] && [ "$frontend_running" = false ]; then
        echo "✅ All services stopped"
        echo ""
        echo "💡 To start next time, run: ./start.sh"
    else
        echo "⚠️  Some services are still running"
        echo ""
        echo "🔧 Management Commands:"
        echo "   Stop Again:      ./stop.sh"
        echo "   Check Status:    ./status.sh"
        echo "   Force Cleanup:   pkill -f 'adk web' && pkill -f 'npm run dev'"
    fi
    
    echo ""
    echo "📋 Log Files:"
    echo "   Backend Log:    logs/backend.log"
    echo "   Frontend Log:   logs/frontend.log"
    echo "   Log Backup:     logs/archive/"
    echo ""
    echo "========================================="
    echo ""
}

# Main function
main() {
    echo ""
    echo "🛑 FeynmanCraft Service Stop Script"
    echo "========================================="
    echo ""
    
    stop_services
    sleep 1
    check_ports
    show_status
    
    print_success "Stop script execution completed"
    echo ""
}

# Run main function
main "$@"