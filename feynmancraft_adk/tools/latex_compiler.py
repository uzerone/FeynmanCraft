# Copyright 2024-2025 The FeynmanCraft ADK Project Developers
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""LaTeX 编译服务模块 - 基于实验性代码改进版本"""

import os
import re
import shutil
import subprocess
import tempfile
import time
import asyncio
import uuid
import json
import hashlib
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger(__name__)

@dataclass
class CompilerError:
    """编译错误信息"""
    line_number: Optional[int]
    error_type: str
    message: str
    suggestion: Optional[str] = None

@dataclass
class CompilerWarning:
    """编译警告信息"""
    line_number: Optional[int] 
    message: str
    suggestion: Optional[str] = None

@dataclass
class CompilationResult:
    """编译结果"""
    success: bool
    file_id: str
    pdf_path: Optional[str] = None
    svg_path: Optional[str] = None
    png_path: Optional[str] = None
    errors: List[CompilerError] = None
    warnings: List[CompilerWarning] = None
    suggestions: List[str] = None
    compilation_time: float = 0.0
    latex_log: str = ""
    tikz_hash: str = ""

    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.warnings is None:
            self.warnings = []
        if self.suggestions is None:
            self.suggestions = []


class DiagramFileManager:
    """文件管理器"""
    
    def __init__(self, file_id: str):
        self.file_id = file_id
        self.workspace_path = self.get_workspace_path(file_id)
    
    @staticmethod
    def get_workspace_path(file_id: str) -> Path:
        """获取工作目录路径"""
        base_dir = Path(tempfile.gettempdir()) / "latex_compiler"
        return base_dir / file_id
    
    def create_workspace(self, tikz_hash: str, packages: Optional[List[str]] = None, output_formats: Optional[List[str]] = None):
        """创建工作目录并保存元数据"""
        self.workspace_path.mkdir(parents=True, exist_ok=True)
        
        # 保存元数据
        metadata = {
            "file_id": self.file_id,
            "tikz_hash": tikz_hash,
            "created_at": time.time(),
            "packages": packages or [],
            "output_formats": output_formats or []
        }
        
        metadata_path = self.workspace_path / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
            
        logger.debug(f"创建工作目录: {self.workspace_path}")
    
    def cleanup(self):
        """清理工作目录"""
        if self.workspace_path.exists():
            shutil.rmtree(self.workspace_path)
            logger.debug(f"清理工作目录: {self.workspace_path}")


def generate_tikz_hash(tikz_code: str) -> str:
    """生成TikZ代码哈希"""
    return hashlib.sha256(tikz_code.encode('utf-8')).hexdigest()


def create_latex_document(tikz_code: str, packages: Optional[List[str]] = None) -> str:
    """创建完整的LaTeX文档"""
    
    # 基础包（确保可用性）
    default_packages = [
        "amsmath", "amsfonts", "amssymb", "graphicx",
        "tikz", "xcolor"
    ]
    
    # 可选包（如果可用）
    optional_packages = ["tikz-feynman", "physics", "siunitx"]
    
    # 合并用户指定的包
    user_packages = packages or []
    all_packages = list(set(default_packages + user_packages))
    
    # 生成包导入
    package_imports = "\n".join([f"\\usepackage{{{pkg}}}" for pkg in all_packages])
    
    # 基础TikZ库
    tikz_libraries = """
\\usetikzlibrary{positioning}
\\usetikzlibrary{decorations.pathmorphing}
\\usetikzlibrary{arrows.meta}
"""
    
    # 检查是否包含tikz-feynman包
    feynman_setup = ""
    if "tikz-feynman" in all_packages:
        feynman_setup = """
\\tikzfeynmanset{
    fermion/.style={
        /tikzfeynman/with arrow=0.5,
        draw=black
    },
    anti fermion/.style={
        /tikzfeynman/with arrow=0.5,
        /tikzfeynman/with reversed arrow=0.5,
        draw=black
    },
    photon/.style={
        /tikzfeynman/with arrow=0.5,
        draw=blue,
        decoration={
            snake,
            segment length=5pt,
            amplitude=1pt
        },
        decorate
    },
    gluon/.style={
        /tikzfeynman/with arrow=0.5,
        draw=red,
        decoration={
            coil,
            segment length=4pt,
            amplitude=1.5pt
        },
        decorate
    }
}
"""
    
    document = f"""\\documentclass[tikz,border=2pt]{{standalone}}

{package_imports}
{tikz_libraries}
{feynman_setup}

\\begin{{document}}
{tikz_code}
\\end{{document}}
"""
    
    return document


def parse_latex_log(log_content: str) -> Tuple[List[CompilerError], List[CompilerWarning]]:
    """解析LaTeX日志文件"""
    errors = []
    warnings = []
    
    lines = log_content.split('\n')
    
    error_patterns = [
        (r'! (.+)', 'LaTeX Error'),
        (r'(.+):\d+: (.+)', 'Compilation Error'),
        (r'Package tikz-feynman Error: (.+)', 'TikZ-Feynman Error'),
        (r'Package tikz Error: (.+)', 'TikZ Error')
    ]
    
    warning_patterns = [
        (r'LaTeX Warning: (.+)', 'LaTeX Warning'),
        (r'Package (.+) Warning: (.+)', 'Package Warning'),
        (r'Overfull \\hbox (.+)', 'Overfull HBox'),
        (r'Underfull \\hbox (.+)', 'Underfull HBox')
    ]
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # 检查错误
        for pattern, error_type in error_patterns:
            match = re.search(pattern, line)
            if match:
                message = match.group(1) if len(match.groups()) == 1 else match.group(2)
                suggestion = generate_error_suggestion(error_type, message)
                errors.append(CompilerError(
                    line_number=i + 1,
                    error_type=error_type,
                    message=message,
                    suggestion=suggestion
                ))
                break
        
        # 检查警告
        for pattern, warning_type in warning_patterns:
            match = re.search(pattern, line)
            if match:
                message = match.group(1) if len(match.groups()) == 1 else match.group(2)
                suggestion = generate_warning_suggestion(warning_type, message)
                warnings.append(CompilerWarning(
                    line_number=i + 1,
                    message=f"{warning_type}: {message}",
                    suggestion=suggestion
                ))
                break
    
    return errors, warnings


def generate_error_suggestion(error_type: str, message: str) -> Optional[str]:
    """生成错误修复建议"""
    suggestions_map = {
        'LaTeX Error': {
            'Undefined control sequence': '检查命令拼写，确保导入了正确的包',
            'Missing $ inserted': '缺少数学模式标记，添加$...$或\\(...\\)',
            'Extra alignment tab': '表格列数不匹配，检查&符号数量',
        },
        'TikZ-Feynman Error': {
            'Unknown particle': '使用标准粒子名称，如electron, photon, gluon等',
            'Invalid vertex': '检查顶点定义和连接语法',
            'Missing diagram': '确保TikZ代码包含在\\feynmandiagram{}中',
        },
        'TikZ Error': {
            'Package pgf Error': '检查TikZ语法和库导入',
            'Dimension too large': '坐标值过大，使用相对坐标',
        }
    }
    
    if error_type in suggestions_map:
        for key, suggestion in suggestions_map[error_type].items():
            if key.lower() in message.lower():
                return suggestion
    
    return "检查LaTeX和TikZ-Feynman语法"


def generate_warning_suggestion(warning_type: str, message: str) -> Optional[str]:
    """生成警告修复建议"""
    if 'overfull' in warning_type.lower():
        return "内容过宽，考虑调整图形尺寸或边距"
    elif 'underfull' in warning_type.lower():
        return "内容过窄，可能需要调整布局"
    elif 'font' in message.lower():
        return "字体相关问题，检查字体设置"
    
    return "检查相关设置和语法"


async def convert_to_svg(pdf_path: str, output_dir: str) -> Optional[str]:
    """转换PDF为SVG"""
    svg_path = os.path.join(output_dir, "document.svg")
    
    # 尝试多种转换方法
    conversion_commands = [
        ["dvisvgm", "--pdf", "--exact", "--font-format=woff", pdf_path, "-o", svg_path],
        ["pdf2svg", pdf_path, svg_path],
        ["inkscape", "--pdf-poppler", pdf_path, "--export-type=svg", f"--export-filename={svg_path}"]
    ]
    
    for cmd in conversion_commands:
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await proc.communicate()
            
            if proc.returncode == 0 and os.path.exists(svg_path):
                logger.info(f"SVG转换成功: {svg_path}")
                return svg_path
                
        except FileNotFoundError:
            continue
        except Exception as e:
            logger.warning(f"SVG转换失败 {' '.join(cmd)}: {e}")
            continue
    
    logger.error("所有SVG转换方法都失败了")
    return None


async def convert_to_png(pdf_path: str, output_dir: str, dpi: int = 300) -> Optional[str]:
    """转换PDF为PNG"""
    png_path = os.path.join(output_dir, "document.png")
    
    # 尝试多种转换方法
    conversion_commands = [
        ["pdftoppm", "-png", "-singlefile", "-r", str(dpi), pdf_path, os.path.join(output_dir, "document")],
        ["convert", "-density", str(dpi), pdf_path, png_path],
        ["gs", "-dNOPAUSE", "-dBATCH", "-sDEVICE=png16m", f"-r{dpi}", f"-sOutputFile={png_path}", pdf_path]
    ]
    
    for cmd in conversion_commands:
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await proc.communicate()
            
            if proc.returncode == 0 and os.path.exists(png_path):
                logger.info(f"PNG转换成功: {png_path}")
                return png_path
                
        except FileNotFoundError:
            continue
        except Exception as e:
            logger.warning(f"PNG转换失败 {' '.join(cmd)}: {e}")
            continue
    
    logger.error("所有PNG转换方法都失败了")
    return None


async def compile_tikz(
    tikz_code: str, 
    packages: Optional[List[str]] = None,
    output_formats: Optional[List[str]] = None,
    timeout: int = 30
) -> CompilationResult:
    """
    编译TikZ代码
    
    Args:
        tikz_code: TikZ代码
        packages: 额外的LaTeX包
        output_formats: 输出格式列表 ["pdf", "svg", "png"]
        timeout: 超时时间（秒）
    
    Returns:
        CompilationResult: 编译结果
    """
    start_time = time.time()
    
    # 生成文件ID和哈希
    tikz_hash = generate_tikz_hash(tikz_code)
    file_id = str(uuid.uuid4())
    
    # 创建文件管理器
    file_manager = DiagramFileManager(file_id)
    
    # 设置默认输出格式
    if output_formats is None:
        output_formats = ["pdf"]
    
    # 创建工作目录
    file_manager.create_workspace(tikz_hash, packages, output_formats)
    
    # 创建完整的LaTeX文档
    latex_content = create_latex_document(tikz_code, packages)
    
    # 工作目录
    work_dir = str(file_manager.workspace_path)
    tex_file = os.path.join(work_dir, "document.tex")
    pdf_path = os.path.join(work_dir, "document.pdf")
    
    # 写入LaTeX文件
    with open(tex_file, 'w', encoding='utf-8') as f:
        f.write(latex_content)
    
    # 编译命令 - 使用pdflatex更稳定
    compile_cmd = [
        "pdflatex",
        "--interaction=nonstopmode",
        "--halt-on-error",
        f"--output-directory={work_dir}",
        tex_file
    ]
    
    try:
        # 执行编译
        proc = await asyncio.create_subprocess_exec(
            *compile_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=work_dir
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            result = CompilationResult(success=False, file_id=file_id, tikz_hash=tikz_hash)
            result.errors = [CompilerError(
                line_number=None,
                error_type="Timeout",
                message=f"编译超时 ({timeout}秒)",
                suggestion="简化TikZ代码或增加超时时间"
            )]
            result.compilation_time = time.time() - start_time
            return result
        
        # 读取日志文件
        log_path = os.path.join(work_dir, "document.log")
        latex_log = ""
        if os.path.exists(log_path):
            with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
                latex_log = f.read()
        else:
            latex_log = stdout.decode('utf-8', errors='ignore') + '\n' + stderr.decode('utf-8', errors='ignore')
        
        # 解析错误和警告
        errors, warnings = parse_latex_log(latex_log)
        
        # 检查编译是否成功
        success = proc.returncode == 0 and os.path.exists(pdf_path)
        
        # 创建结果对象
        result = CompilationResult(
            success=success,
            file_id=file_id,
            tikz_hash=tikz_hash,
            compilation_time=time.time() - start_time,
            errors=errors,
            warnings=warnings,
            latex_log=latex_log
        )
        
        if success:
            result.pdf_path = pdf_path
            logger.info(f"PDF编译成功: {pdf_path}")
            
            # 格式转换
            conversion_tasks = []
            
            if "svg" in output_formats:
                conversion_tasks.append(convert_to_svg(pdf_path, work_dir))
            
            if "png" in output_formats:
                conversion_tasks.append(convert_to_png(pdf_path, work_dir))
            
            # 并行执行转换
            if conversion_tasks:
                converted_files = await asyncio.gather(*conversion_tasks, return_exceptions=True)
                
                for i, converted_file in enumerate(converted_files):
                    if isinstance(converted_file, Exception):
                        logger.error(f"格式转换失败: {converted_file}")
                    else:
                        if "svg" in output_formats and i == 0 and converted_file:
                            result.svg_path = converted_file
                        elif "png" in output_formats and converted_file:
                            if "svg" in output_formats and i == 1:
                                result.png_path = converted_file
                            elif "svg" not in output_formats and i == 0:
                                result.png_path = converted_file
        
        else:
            logger.error(f"PDF编译失败: {proc.returncode}")
            if not errors:  # 如果没有解析到具体错误，添加通用错误信息
                result.errors = [CompilerError(
                    line_number=None,
                    error_type="Compilation Error",
                    message="LaTeX编译失败，请检查代码语法",
                    suggestion="检查TikZ-Feynman语法和包导入"
                )]
        
        return result
        
    except Exception as e:
        logger.error(f"编译过程出错: {e}")
        result = CompilationResult(success=False, file_id=file_id, tikz_hash=tikz_hash)
        result.errors = [CompilerError(
            line_number=None,
            error_type="System Error",
            message=f"系统错误: {str(e)}",
            suggestion="检查LaTeX安装和系统资源"
        )]
        result.compilation_time = time.time() - start_time
        return result


# 导出主要函数
__all__ = [
    'CompilationResult', 'CompilerError', 'CompilerWarning',
    'DiagramFileManager', 'compile_tikz'
]


# 兼容旧版本接口 
def validate_tikz_compilation(tikz_code: str, packages: Optional[List[str]] = None) -> Dict:
    """
    兼容旧版本的同步验证接口
    
    Args:
        tikz_code: TikZ code to validate
        packages: Additional packages to include
        
    Returns:
        Validation results dictionary
    """
    import asyncio
    
    # 在异步环境中运行编译
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    result = loop.run_until_complete(compile_tikz(tikz_code, packages))
    
    # 转换为旧格式
    return {
        "success": result.success,
        "pdf_generated": result.success and result.pdf_path is not None,
        "pdf_path": result.pdf_path,
        "file_id": result.file_id,
        "compilation_time": result.compilation_time,
        "errors": [asdict(e) for e in result.errors],
        "warnings": [asdict(w) for w in result.warnings], 
        "suggestions": result.suggestions,
        "latex_log": result.latex_log,
        "analysis": {
            "error_type": result.errors[0].error_type if result.errors else None,
            "errors": [e.message for e in result.errors],
            "warnings": [w.message for w in result.warnings],
            "suggestions": result.suggestions,
            "quality_score": 100 - len(result.errors) * 20 - len(result.warnings) * 5
        }
    }


def get_diagram_file_path(file_id: str, file_format: str) -> Optional[str]:
    """
    Get the file path for a compiled diagram.
    
    Args:
        file_id: The unique file identifier from compilation
        file_format: The format (pdf, svg, png)
        
    Returns:
        File path if it exists, None otherwise
    """
    try:
        # Get the workspace path from file_id
        workspace_path = Path(tempfile.gettempdir()) / "latex_compiler" / file_id
        if not workspace_path.exists():
            return None
        
        # Check for the requested format
        format_files = {
            "pdf": "document.pdf",
            "svg": "document.svg", 
            "png": "document.png"
        }
        
        if file_format not in format_files:
            return None
            
        file_path = workspace_path / format_files[file_format]
        return str(file_path) if file_path.exists() else None
        
    except Exception as e:
        logger.error(f"Error getting diagram file path: {e}")
        return None


def list_cached_diagrams() -> List[Dict[str, Any]]:
    """
    List all cached diagram files.
    
    Returns:
        List of diagram information dictionaries
    """
    try:
        diagrams = []
        
        # Get all workspace directories
        workspace_base = Path(tempfile.gettempdir()) / "latex_compiler"
        if not workspace_base.exists():
            return diagrams
        
        for workspace_dir in workspace_base.glob("*"):
            if not workspace_dir.is_dir():
                continue
                
            file_id = workspace_dir.name
            
            # Get metadata if available
            metadata_path = workspace_dir / "metadata.json"
            metadata = {}
            if metadata_path.exists():
                try:
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                except Exception:
                    pass
            
            # Check available formats
            available_formats = []
            file_sizes = {}
            
            format_files = {
                "pdf": "document.pdf",
                "svg": "document.svg",
                "png": "document.png"
            }
            
            for format_name, filename in format_files.items():
                file_path = workspace_dir / filename
                if file_path.exists():
                    available_formats.append(format_name)
                    file_sizes[format_name] = file_path.stat().st_size
            
            # Only include diagrams that have at least one format available
            if available_formats:
                diagrams.append({
                    "file_id": file_id,
                    "tikz_hash": metadata.get("tikz_hash", ""),
                    "created_at": metadata.get("created_at", ""),
                    "available_formats": available_formats,
                    "file_sizes": file_sizes,
                    "compilation_time": metadata.get("compilation_time", 0)
                })
        
        # Sort by creation time (newest first)
        diagrams.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return diagrams
        
    except Exception as e:
        logger.error(f"Error listing cached diagrams: {e}")
        return []