#!/bin/bash

# FeynmanCraft Service Status Check Script

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

# Check process status
check_process_status() {
    local service_name="$1"
    local pid_file="$2"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "🟢 $service_name: Running (PID: $pid)"
            return 0
        else
            echo "🔴 $service_name: Stopped (PID file exists but process doesn't exist)"
            return 1
        fi
    else
        echo "🔴 $service_name: Stopped (no PID file)"
        return 1
    fi
}

# Check port status
check_port_status() {
    local port="$1"
    local service_name="$2"
    
    if lsof -i :"$port" >/dev/null 2>&1; then
        local process_info=$(lsof -i :"$port" | tail -n +2 | head -1)
        echo "🟢 Port $port ($service_name): Occupied"
        echo "   Process info: $process_info"
        return 0
    else
        echo "🔴 Port $port ($service_name): Not occupied"
        return 1
    fi
}

# Check network connection
check_network_status() {
    local url="$1"
    local service_name="$2"
    
    if curl -s --connect-timeout 3 "$url" >/dev/null 2>&1; then
        echo "🟢 $service_name Network: Accessible"
        return 0
    else
        echo "🔴 $service_name Network: Not accessible"
        return 1
    fi
}

# Get system resource usage
get_system_resources() {
    echo ""
    echo "💻 System Resource Usage:"
    
    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    echo "   CPU Usage: ${cpu_usage}%"
    
    # Memory usage
    local mem_info=$(free | grep Mem)
    local total_mem=$(echo $mem_info | awk '{print $2}')
    local used_mem=$(echo $mem_info | awk '{print $3}')
    local mem_percent=$(echo "scale=1; $used_mem * 100 / $total_mem" | bc 2>/dev/null || echo "N/A")
    echo "   Memory Usage: ${mem_percent}%"
    
    # Disk usage
    local disk_usage=$(df -h . | tail -1 | awk '{print $5}')
    echo "   Disk Usage: $disk_usage"
}

# Display log statistics
show_log_stats() {
    echo ""
    echo "📊 Log Statistics:"
    
    if [ -f "logs/backend.log" ]; then
        local backend_lines=$(wc -l < logs/backend.log)
        local backend_size=$(du -sh logs/backend.log | cut -f1)
        local backend_errors=$(grep -c "ERROR\|Error\|error" logs/backend.log 2>/dev/null || echo "0")
        echo "   Backend Log: $backend_lines lines, $backend_size, $backend_errors errors"
    else
        echo "   Backend Log: Does not exist"
    fi
    
    if [ -f "logs/frontend.log" ]; then
        local frontend_lines=$(wc -l < logs/frontend.log)
        local frontend_size=$(du -sh logs/frontend.log | cut -f1)
        local frontend_errors=$(grep -c "ERROR\|Error\|error" logs/frontend.log 2>/dev/null || echo "0")
        echo "   Frontend Log: $frontend_lines lines, $frontend_size, $frontend_errors errors"
    else
        echo "   Frontend Log: Does not exist"
    fi
    
    # Backup log statistics
    if [ -d "logs/archive" ] && [ "$(ls -A logs/archive)" ]; then
        local archive_count=$(ls logs/archive/*.log 2>/dev/null | wc -l)
        local archive_size=$(du -sh logs/archive 2>/dev/null | cut -f1 || echo "0")
        echo "   Backup Logs: $archive_count files, $archive_size"
    else
        echo "   Backup Logs: None"
    fi
}

# Display recent logs
show_recent_logs() {
    echo ""
    echo "📋 Recent Logs (Last 5 lines):"
    
    if [ -f "logs/backend.log" ]; then
        echo ""
        echo "Backend Log:"
        echo "----------------------------------------"
        tail -5 logs/backend.log | sed 's/^/   /'
    fi
    
    if [ -f "logs/frontend.log" ]; then
        echo ""
        echo "Frontend Log:"
        echo "----------------------------------------"
        tail -5 logs/frontend.log | sed 's/^/   /'
    fi
}

# Check generated files
check_generated_files() {
    echo ""
    echo "📁 Generated Files Statistics:"
    
    if [ -d "frontend/public/generated" ]; then
        local file_count=$(find frontend/public/generated -type f 2>/dev/null | wc -l)
        local dir_count=$(find frontend/public/generated -type d -mindepth 1 2>/dev/null | wc -l)
        local total_size=$(du -sh frontend/public/generated 2>/dev/null | cut -f1 || echo "0")
        echo "   Generated Directory: $dir_count folders, $file_count files, $total_size"
        
        # Show recently generated files
        if [ $dir_count -gt 0 ]; then
            echo "   Recently Generated:"
            find frontend/public/generated -type d -mindepth 1 | tail -3 | sed 's/^/     /'
        fi
    else
        echo "   Generated Directory: Does not exist"
    fi
}

# Main status check
main_status_check() {
    echo ""
    echo "========================================="
    echo "       FeynmanCraft Service Status"
    echo "========================================="
    echo ""
    
    # Process status
    echo "🔍 Process Status:"
    local backend_running=false
    local frontend_running=false
    
    if check_process_status "Backend Service" "logs/backend.pid"; then
        backend_running=true
    fi
    
    if check_process_status "Frontend Service" "logs/frontend.pid"; then
        frontend_running=true
    fi
    
    echo ""
    
    # Port status
    echo "🌐 Port Status:"
    check_port_status "8000" "Backend"
    check_port_status "5174" "Frontend"
    
    echo ""
    
    # Network connection status
    echo "🔗 Network Connection:"
    check_network_status "http://localhost:8000" "Backend API"
    check_network_status "http://localhost:5174" "Frontend UI"
    
    # System resources
    get_system_resources
    
    # Log statistics
    show_log_stats
    
    # Generated files statistics
    check_generated_files
    
    # Recent logs
    if [ "$1" = "--verbose" ] || [ "$1" = "-v" ]; then
        show_recent_logs
    fi
    
    echo ""
    echo "========================================="
    echo ""
    
    # Status summary
    if [ "$backend_running" = true ] && [ "$frontend_running" = true ]; then
        print_success "✅ All services are running normally"
        echo ""
        echo "🌐 Access URLs:"
        echo "   Frontend UI: http://localhost:5174"
        echo "   Backend API: http://localhost:8000"
    elif [ "$backend_running" = true ] || [ "$frontend_running" = true ]; then
        print_warning "⚠️  Some services are not running"
        echo ""
        echo "🔧 Suggested Actions:"
        echo "   Restart: ./start.sh"
        echo "   Stop All: ./stop.sh"
    else
        print_info "ℹ️  All services are stopped"
        echo ""
        echo "🚀 Start Services: ./start.sh"
    fi
    
    echo ""
    echo "🔧 Available Commands:"
    echo "   Start Services:    ./start.sh"
    echo "   Stop Services:     ./stop.sh"
    echo "   Detailed Status:   ./status.sh --verbose"
    echo "   Real-time Logs:    tail -f logs/backend.log"
    echo "                  or  tail -f logs/frontend.log"
    echo ""
}

# Main function
main() {
    echo ""
    echo "📊 FeynmanCraft Service Status Check"
    echo "========================================="
    
    main_status_check "$@"
    
    print_success "Status check completed"
    echo ""
}

# Run main function
main "$@"