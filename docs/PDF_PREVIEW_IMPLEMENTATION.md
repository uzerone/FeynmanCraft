# PDF 预览功能实施文档

## 概述

本文档描述了在 FeynmanCraft ADK 系统中实现基于 LuaLaTeX 的 TikZ 验证与图像生成功能的技术方案。该功能将允许用户实时预览生成的 Feynman 图，支持 PDF、SVG、PNG 多种格式输出。

## 系统架构

### 整体流程

```
用户输入描述
    ↓
DiagramGeneratorAgent 生成 TikZ 代码
    ↓
TikZValidatorAgent 编译验证（集成 LaTeX 编译）
    ↓                    ↙ 调用 ↘
LaTeX 编译器 (lualatex)    格式转换 (dvisvgm/ImageMagick)
    ↓
生成 PDF/SVG/PNG 文件 + 错误分析
    ↓
FeedbackAgent 汇总结果（包含图像文件ID）
    ↓
前端接收：PDF.js 显示图像 + ErrorPanel 显示错误
```

### 核心组件

1. **LaTeX 编译服务** (`feynmancraft_adk/tools/latex_compiler.py`)
2. **重构后的 TikZValidatorAgent** (`feynmancraft_adk/sub_agents/tikz_validator_agent.py`)
3. **文件管理模块** (`feynmancraft_adk/tools/file_manager.py`)
4. **前端预览组件** (`frontend/src/components/diagram-preview/`)
5. **API 端点** (ADK 后端新增)

## 后端实现

### 1. LaTeX 编译服务

#### 数据结构

```python
@dataclass
class CompilationResult:
    success: bool
    file_id: str
    pdf_path: Optional[str]
    svg_path: Optional[str]
    png_path: Optional[str]
    errors: List[CompilerError]
    warnings: List[CompilerWarning]
    suggestions: List[str]
    compilation_time: float
    latex_log: str

@dataclass
class CompilerError:
    line_number: Optional[int]
    error_type: str
    message: str
    suggestion: Optional[str]

@dataclass
class CompilerWarning:
    line_number: Optional[int]
    message: str
    suggestion: Optional[str]
```

#### 核心功能模块

##### 文档生成器
```python
def build_latex_document(tikz_code: str, packages: List[str] = None) -> str:
    """将 TikZ 代码封装为完整的 LaTeX 文档"""
    standard_packages = [
        "tikz", "tikz-feynman", "amsmath", "physics", 
        "siunitx", "xcolor", "graphicx"
    ]
    
    template = """
\\documentclass[border=1pt]{standalone}
\\usepackage{packages_here}
\\begin{document}
tikz_code_here
\\end{document}
"""
    
    # 实现模板填充逻辑
```

##### LuaLaTeX 编译器
```python
async def compile_tikz(tikz_code: str, timeout: int = 30) -> CompilationResult:
    """编译 TikZ 代码生成 PDF"""
    
    # 1. 创建临时工作目录
    work_dir = create_temp_workspace()
    
    # 2. 生成 LaTeX 文档
    latex_doc = build_latex_document(tikz_code)
    
    # 3. 调用 lualatex 编译
    cmd = [
        "lualatex",
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-file-line-error",
        "document.tex"
    ]
    
    # 4. 执行编译并处理结果
    proc = await asyncio.create_subprocess_exec(
        *cmd, cwd=work_dir, 
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    # 5. 解析结果和错误
    result = await parse_compilation_result(proc, work_dir)
    
    # 6. 格式转换
    if result.success:
        await convert_to_multiple_formats(result, work_dir)
    
    return result
```

##### 错误日志解析
```python
def parse_latex_log(log_content: str) -> Tuple[List[CompilerError], List[CompilerWarning]]:
    """解析 LaTeX 编译日志，提取错误和警告"""
    
    errors = []
    warnings = []
    
    # 错误模式匹配
    error_patterns = [
        r"^! (.+)",  # LaTeX 错误
        r"^(.+):(\d+): (.+)",  # 文件行号错误
    ]
    
    # 警告模式匹配  
    warning_patterns = [
        r"Package .* Warning: (.+)",
        r"LaTeX Warning: (.+)",
    ]
    
    # 实现解析逻辑
    # 返回结构化错误和警告信息
```

##### 格式转换器
```python
async def convert_to_svg(pdf_path: str, output_dir: str) -> Optional[str]:
    """PDF 转 SVG"""
    # 优先使用 dvisvgm
    # 备选 pdf2svg
    # 备选 inkscape
    
async def convert_to_png(pdf_path: str, output_dir: str, dpi: int = 300) -> Optional[str]:
    """PDF 转 PNG"""
    # 使用 ImageMagick convert
    # 或 Poppler pdftoppm
```

### 2. TikZValidatorAgent 重构

#### 新的工具函数

```python
async def tikz_compile_and_validate_tool(
    tikz_code: str, 
    additional_packages: str = "",
    output_formats: str = "pdf,svg"
) -> str:
    """
    编译并验证 TikZ 代码，生成图像和验证报告
    
    Args:
        tikz_code: TikZ 代码
        additional_packages: 额外的 LaTeX 包，逗号分隔
        output_formats: 输出格式，逗号分隔 (pdf,svg,png)
        
    Returns:
        包含编译结果、错误分析和文件ID的详细报告
    """
    
    # 1. 静态语法检查（保留现有功能）
    static_result = _validate_tikz_syntax(tikz_code, [])
    
    # 2. 实际 LaTeX 编译
    compilation_result = await compile_tikz(tikz_code)
    
    # 3. 生成综合报告
    report = generate_validation_report(static_result, compilation_result)
    
    # 4. 将结果存入 Agent 状态
    # state.tikz_compilation_result = compilation_result
    
    return report

def generate_validation_report(
    static_result: dict, 
    compilation_result: CompilationResult
) -> str:
    """生成综合验证报告"""
    
    report = f"""
# TikZ 代码编译验证报告

## 编译状态
- **编译结果**: {'成功' if compilation_result.success else '失败'}
- **编译时间**: {compilation_result.compilation_time:.2f}s
- **文件ID**: {compilation_result.file_id}

## 可用格式
"""
    
    if compilation_result.pdf_path:
        report += "- ✅ PDF (矢量格式，推荐预览)\n"
    if compilation_result.svg_path:
        report += "- ✅ SVG (矢量格式，Web友好)\n"  
    if compilation_result.png_path:
        report += "- ✅ PNG (位图格式，通用性好)\n"
    
    # 添加错误信息
    if compilation_result.errors:
        report += "\n## 编译错误\n"
        for error in compilation_result.errors:
            report += f"- **{error.error_type}** (第{error.line_number}行): {error.message}\n"
            if error.suggestion:
                report += f"  💡 建议: {error.suggestion}\n"
    
    # 添加警告信息  
    if compilation_result.warnings:
        report += "\n## 编译警告\n"
        for warning in compilation_result.warnings:
            report += f"- {warning.message}\n"
    
    # 添加改进建议
    if compilation_result.suggestions:
        report += "\n## 改进建议\n"
        for suggestion in compilation_result.suggestions:
            report += f"- {suggestion}\n"
    
    return report
```

#### Agent 配置更新

```python
TikZValidatorAgent = Agent(
    model=TIKZ_VALIDATOR_MODEL,
    name="tikz_validator_agent", 
    description="通过实际 LaTeX 编译验证 TikZ 代码并生成多格式图像",
    instruction=TIKZ_VALIDATOR_AGENT_PROMPT,
    tools=[
        tikz_compile_and_validate_tool,
    ],
    output_key="tikz_compilation_result",
)
```

### 3. 文件管理模块

#### 文件存储结构
```
/tmp/feynman_diagrams/
├── {file_id}/
│   ├── document.tex
│   ├── document.pdf
│   ├── document.svg
│   ├── document.png
│   ├── compilation.log
│   └── metadata.json
```

#### 文件管理器
```python
class DiagramFileManager:
    """Feynman 图文件管理器"""
    
    BASE_DIR = "/tmp/feynman_diagrams"
    CLEANUP_HOURS = 24
    
    @staticmethod
    def create_workspace(file_id: str) -> str:
        """创建工作空间"""
        
    @staticmethod 
    def save_metadata(file_id: str, result: CompilationResult):
        """保存元数据"""
        
    @staticmethod
    def get_file_path(file_id: str, format: str) -> Optional[str]:
        """获取文件路径"""
        
    @staticmethod
    async def cleanup_old_files():
        """清理过期文件"""
```

### 4. API 端点

#### ADK 后端新增端点

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

@app.get("/api/diagrams/{file_id}/{format}")
async def get_diagram_file(file_id: str, format: str):
    """获取图表文件"""
    
    if format not in ["pdf", "svg", "png"]:
        raise HTTPException(400, "不支持的格式")
    
    file_path = DiagramFileManager.get_file_path(file_id, format)
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(404, "文件不存在")
    
    return FileResponse(
        file_path,
        media_type=get_media_type(format),
        filename=f"feynman_diagram.{format}"
    )

@app.get("/api/diagrams/{file_id}/info")
async def get_diagram_info(file_id: str):
    """获取图表信息"""
    
    metadata_path = f"{DiagramFileManager.BASE_DIR}/{file_id}/metadata.json"
    if not os.path.exists(metadata_path):
        raise HTTPException(404, "图表不存在")
    
    with open(metadata_path) as f:
        metadata = json.load(f)
    
    return {
        "file_id": file_id,
        "available_formats": metadata["available_formats"],
        "compilation_time": metadata["compilation_time"],
        "created_at": metadata["created_at"],
        "success": metadata["success"]
    }

def get_media_type(format: str) -> str:
    """获取媒体类型"""
    return {
        "pdf": "application/pdf",
        "svg": "image/svg+xml", 
        "png": "image/png"
    }[format]
```

## 前端实现

### 1. 组件结构

```
frontend/src/components/diagram-preview/
├── FeynmanDiagramPreview.tsx    # 主预览组件
├── PDFViewer.tsx                # PDF 预览器
├── SVGViewer.tsx                # SVG 预览器  
├── CompilationErrorPanel.tsx    # 错误显示面板
├── FormatSelector.tsx           # 格式选择器
├── DownloadManager.tsx          # 下载管理器
└── types.ts                     # TypeScript 类型定义
```

### 2. 主要组件实现

#### FeynmanDiagramPreview 主组件

```typescript
interface FeynmanDiagramPreviewProps {
  fileId: string;
  compilationResult: CompilationResult;
  onRetry?: () => void;
}

export function FeynmanDiagramPreview({
  fileId,
  compilationResult,
  onRetry
}: FeynmanDiagramPreviewProps) {
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'svg' | 'png'>('pdf');
  const [isLoading, setIsLoading] = useState(false);

  // 如果编译失败，显示错误面板
  if (!compilationResult.success) {
    return (
      <CompilationErrorPanel
        errors={compilationResult.errors}
        warnings={compilationResult.warnings}
        suggestions={compilationResult.suggestions}
        onRetry={onRetry}
      />
    );
  }

  // 成功则显示预览界面
  return (
    <div className="diagram-preview-container">
      <div className="preview-header">
        <FormatSelector
          availableFormats={getAvailableFormats(compilationResult)}
          selectedFormat={selectedFormat}
          onFormatChange={setSelectedFormat}
        />
        <DownloadManager fileId={fileId} />
      </div>
      
      <div className="preview-content">
        {selectedFormat === 'pdf' && <PDFViewer fileId={fileId} />}
        {selectedFormat === 'svg' && <SVGViewer fileId={fileId} />}
        {selectedFormat === 'png' && <img src={`/api/diagrams/${fileId}/png`} />}
      </div>
    </div>
  );
}
```

#### PDF 预览器

```typescript
import { Document, Page, pdfjs } from 'react-pdf';

// 配置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  fileId: string;
}

export function PDFViewer({ fileId }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  const pdfUrl = `/api/diagrams/${fileId}/pdf`;

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-controls">
        <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
          缩小
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(3.0, s + 0.1))}>
          放大
        </button>
      </div>
      
      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div>加载 PDF 中...</div>}
        error={<div>PDF 加载失败</div>}
      >
        <Page 
          pageNumber={pageNumber} 
          scale={scale}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  );
}
```

#### 错误显示面板

```typescript
interface CompilationErrorPanelProps {
  errors: CompilerError[];
  warnings: CompilerWarning[];
  suggestions: string[];
  onRetry?: () => void;
}

export function CompilationErrorPanel({
  errors,
  warnings, 
  suggestions,
  onRetry
}: CompilationErrorPanelProps) {
  return (
    <div className="compilation-error-panel">
      <div className="error-header">
        <h3>编译失败</h3>
        {onRetry && (
          <button onClick={onRetry} className="retry-button">
            重试编译
          </button>
        )}
      </div>

      {errors.length > 0 && (
        <div className="error-section">
          <h4>错误信息</h4>
          {errors.map((error, index) => (
            <div key={index} className="error-item">
              <div className="error-message">
                <strong>{error.error_type}</strong>
                {error.line_number && ` (第${error.line_number}行)`}: {error.message}
              </div>
              {error.suggestion && (
                <div className="error-suggestion">
                  💡 {error.suggestion}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="warning-section">
          <h4>警告信息</h4>
          {warnings.map((warning, index) => (
            <div key={index} className="warning-item">
              {warning.message}
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="suggestion-section">
          <h4>改进建议</h4>
          {suggestions.map((suggestion, index) => (
            <div key={index} className="suggestion-item">
              • {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3. 样式设计

```css
.diagram-preview-container {
  @apply unified-card p-4;
  min-height: 400px;
}

.preview-header {
  @apply flex justify-between items-center mb-4 pb-2 border-b border-border;
}

.preview-content {
  @apply flex justify-center items-center;
  min-height: 300px;
}

.pdf-viewer {
  @apply w-full;
}

.pdf-controls {
  @apply flex items-center justify-center gap-2 mb-4;
}

.compilation-error-panel {
  @apply unified-card p-4 border-red-200 bg-red-50 dark:bg-red-950;
}

.error-item {
  @apply mb-3 p-3 bg-red-100 dark:bg-red-900 rounded-lg;
}

.error-suggestion {
  @apply mt-2 text-sm text-green-600 dark:text-green-400;
}
```

## 安全考虑

### 1. LaTeX 编译安全

- **沙盒化**: 每次编译在隔离的临时目录进行
- **禁用 shell-escape**: 不启用 `--shell-escape` 参数
- **资源限制**: CPU 时间、内存使用、文件系统访问限制
- **超时控制**: 编译超时 30 秒自动终止

### 2. 文件访问安全

- **路径验证**: 严格验证文件路径，防止路径遍历攻击
- **文件类型检查**: 只允许访问指定格式的文件
- **访问日志**: 记录文件访问日志用于审计

## 性能优化

### 1. 缓存策略

- **代码哈希**: 相同 TikZ 代码使用 SHA-256 哈希避免重复编译
- **结果缓存**: 编译结果缓存 24 小时
- **并发控制**: 限制同时编译任务数量

### 2. 前端优化

- **懒加载**: PDF.js 按需加载
- **格式选择**: 根据设备性能选择最优格式
- **渐进加载**: 优先显示 PDF，后台准备其他格式

## 监控与日志

### 1. 编译监控

- **成功率统计**: 编译成功/失败统计
- **性能监控**: 编译时间分布
- **错误分析**: 常见错误模式统计

### 2. 使用统计

- **格式偏好**: 用户格式选择统计
- **下载统计**: 各格式下载次数
- **错误率**: 前端加载错误率

## 部署要求

### 1. 系统依赖

```bash
# LaTeX 环境
sudo apt-get install texlive-full

# 转换工具
sudo apt-get install dvisvgm pdf2svg imagemagick poppler-utils

# 字体支持
sudo apt-get install fonts-cmu fonts-latin-modern
```

### 2. 权限配置

```bash
# 创建工作目录
sudo mkdir -p /tmp/feynman_diagrams
sudo chmod 755 /tmp/feynman_diagrams

# ImageMagick PDF 策略配置
sudo nano /etc/ImageMagick-6/policy.xml
# 允许 PDF 处理
```

## 测试策略

### 1. 单元测试

- LaTeX 编译器模块测试
- 错误解析器测试  
- 格式转换器测试
- 文件管理器测试

### 2. 集成测试

- 端到端编译流程测试
- 多格式生成测试
- 错误处理流程测试
- 前端预览功能测试

### 3. 性能测试

- 编译性能压测
- 并发编译测试
- 缓存效果测试
- 内存泄露测试

## 实施计划

### Phase 1: 后端核心 (1-2 天)
1. 迁移 experimental 代码到生产环境
2. 实现 LaTeX 编译服务
3. 重构 TikZValidatorAgent  
4. 添加 API 端点

### Phase 2: 前端预览 (1-2 天)
1. 创建预览组件框架
2. 集成 PDF.js
3. 实现错误显示界面
4. 添加格式选择和下载功能

### Phase 3: 集成测试 (1 天)
1. 端到端功能测试
2. 性能调优
3. 安全加固
4. 文档完善

### Phase 4: 部署上线 (0.5 天)
1. 生产环境部署
2. 监控配置
3. 用户培训
4. 反馈收集

---

**总预期时间**: 4-5 天
**关键里程碑**: 
- Day 2: 后端编译功能可用
- Day 4: 前端预览功能完整
- Day 5: 生产就绪

这个实施方案将现有的实验性代码与生产系统完美集成，为 FeynmanCraft 用户提供强大的实时图形预览功能。