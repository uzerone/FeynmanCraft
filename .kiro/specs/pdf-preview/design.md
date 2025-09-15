# PDF Preview Feature Design Document

## Overview

The PDF preview feature integrates real-time LaTeX compilation and PDF rendering into the FeynmanCraft ADK React frontend. This system leverages the existing TikZValidatorAgent for compilation while adding new frontend components for PDF display, error handling, and multi-format export capabilities.

## Architecture

### High-Level Flow
```
User Input → Multi-Agent Pipeline → TikZ Code → LaTeX Compilation → PDF Generation → Frontend Preview
```

### Component Integration
- **Backend**: Extend TikZValidatorAgent with PDF generation capabilities
- **Frontend**: New React components for PDF display using PDF.js
- **API**: FastAPI endpoints for compilation status and file downloads
- **File System**: Temporary file management for compilation artifacts

## Components and Interfaces

### Backend Components

#### Enhanced TikZValidatorAgent
```python
class TikZValidatorAgent(Agent):
    async def validate_and_generate_pdf(self, tikz_code: str) -> CompilationResult:
        # Existing validation logic
        # + PDF generation
        # + Multi-format export
        # + Error analysis with suggestions
```

#### LaTeX Compiler Service
```python
class LaTeXCompilerService:
    async def compile_to_pdf(self, tikz_code: str) -> CompilationResult
    async def convert_to_formats(self, pdf_path: str) -> Dict[str, str]
    def analyze_errors(self, log_content: str) -> List[ErrorSuggestion]
```

#### File Management Service
```python
class FileManagerService:
    def create_temp_workspace(self) -> str
    def cleanup_temp_files(self, workspace_id: str)
    async def generate_download_url(self, file_path: str) -> str
```

### Frontend Components

#### PDFPreviewContainer
```typescript
interface PDFPreviewProps {
  compilationStatus: CompilationStatus;
  pdfUrl?: string;
  errors?: CompilationError[];
}

const PDFPreviewContainer: React.FC<PDFPreviewProps>
```

#### ErrorDisplayPanel
```typescript
interface ErrorDisplayProps {
  errors: CompilationError[];
  suggestions: ErrorSuggestion[];
}

const ErrorDisplayPanel: React.FC<ErrorDisplayProps>
```

#### DownloadManager
```typescript
interface DownloadManagerProps {
  availableFormats: ExportFormat[];
  onDownload: (format: ExportFormat) => void;
}

const DownloadManager: React.FC<DownloadManagerProps>
```

### API Endpoints

#### Compilation Endpoints
```python
@app.post("/api/compile/tikz")
async def compile_tikz_to_pdf(request: TikZCompilationRequest)

@app.get("/api/compile/status/{compilation_id}")
async def get_compilation_status(compilation_id: str)

@app.get("/api/download/{file_id}")
async def download_file(file_id: str, format: ExportFormat)
```

## Data Models

### Compilation Models
```python
class CompilationRequest(BaseModel):
    tikz_code: str
    user_id: str
    compilation_options: Dict[str, Any] = {}

class CompilationResult(BaseModel):
    success: bool
    pdf_url: Optional[str]
    errors: List[CompilationError]
    suggestions: List[ErrorSuggestion]
    compilation_time: float
    available_formats: List[ExportFormat]

class CompilationError(BaseModel):
    line_number: Optional[int]
    error_type: str
    message: str
    severity: ErrorSeverity

class ErrorSuggestion(BaseModel):
    error_pattern: str
    suggestion: str
    fix_type: FixType
    confidence: float
```

### Frontend State Models
```typescript
interface CompilationState {
  status: 'idle' | 'compiling' | 'success' | 'error';
  result?: CompilationResult;
  progress: number;
}

interface PDFViewerState {
  currentPage: number;
  scale: number;
  isLoading: boolean;
}
```

## Error Handling

### LaTeX Error Analysis
- **Pattern Matching**: Common TikZ-Feynman error patterns
- **Package Detection**: Missing package identification
- **Syntax Validation**: TikZ syntax error analysis
- **Suggestion Engine**: Context-aware fix recommendations

### Error Categories
1. **Package Errors**: Missing or incompatible packages
2. **Syntax Errors**: Invalid TikZ/LaTeX syntax
3. **Physics Errors**: Invalid particle interactions
4. **Resource Errors**: Compilation timeouts or memory issues

### Frontend Error Display
- **Inline Annotations**: Line-specific error highlighting
- **Suggestion Cards**: Actionable fix recommendations
- **Error Severity**: Visual indicators for error importance
- **Quick Fixes**: One-click error resolution where possible

## Testing Strategy

### Unit Tests
- **LaTeX Compiler Service**: Test compilation with various TikZ inputs
- **Error Analysis**: Verify error pattern matching and suggestions
- **File Management**: Test temporary file creation and cleanup
- **React Components**: Component rendering and interaction tests

### Integration Tests
- **End-to-End Compilation**: Full pipeline from TikZ to PDF
- **Multi-Format Export**: Test PDF, SVG, PNG generation
- **Error Scenarios**: Test various compilation failure cases
- **Performance Tests**: Compilation time and resource usage

### Test Data
- **Physics Examples**: Use existing 150+ knowledge base examples
- **Error Cases**: Curated set of common LaTeX/TikZ errors
- **Complex Diagrams**: Multi-vertex interaction diagrams
- **Edge Cases**: Unusual physics processes and notation

## Performance Considerations

### Compilation Optimization
- **Caching**: Cache compiled results for identical TikZ code
- **Parallel Processing**: Handle multiple compilation requests
- **Resource Limits**: Memory and time constraints for compilation
- **Queue Management**: Priority-based compilation queue

### Frontend Optimization
- **Lazy Loading**: Load PDF.js only when needed
- **Progressive Rendering**: Show compilation progress
- **Debounced Updates**: Avoid excessive re-compilation
- **Memory Management**: Cleanup PDF viewer resources

## Security Considerations

### LaTeX Security
- **Sandboxed Compilation**: Isolated compilation environment
- **Input Validation**: Sanitize TikZ code input
- **Resource Limits**: Prevent resource exhaustion attacks
- **File Access**: Restrict file system access during compilation

### File Management
- **Temporary Files**: Secure temporary file handling
- **Download URLs**: Time-limited, authenticated download links
- **User Isolation**: Separate user compilation workspaces

## Implementation Phases

### Phase 1: Core Compilation
- Extend TikZValidatorAgent with PDF generation
- Implement LaTeX compiler service
- Basic error handling and analysis

### Phase 2: Frontend Integration
- PDF.js integration for preview display
- React components for PDF viewer
- Basic error display panel

### Phase 3: Enhanced Features
- Multi-format export (SVG, PNG)
- Advanced error suggestions
- Download management system

### Phase 4: Optimization
- Performance improvements
- Caching implementation
- Advanced error recovery