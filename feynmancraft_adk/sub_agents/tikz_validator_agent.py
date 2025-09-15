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

"""TikZ Validator Agent for FeynmanCraft ADK - MCP Version."""

from google.adk.agents import Agent
from ..models import TIKZ_VALIDATOR_MODEL
from .tikz_validator_agent_prompt import PROMPT as TIKZ_VALIDATOR_AGENT_PROMPT
from ..integrations.mcp.latex_stdio_mcp_client import compile_tikz_mcp


async def tikz_compile_and_validate_tool(
    tikz_code: str, 
    engine: str = "pdflatex",
    format: str = "all",
    timeout: int = 30
) -> str:
    """
    Compile and validate TikZ code through MCP LaTeX service.
    
    Args:
        tikz_code: TikZ code to compile and validate
        engine: LaTeX engine (pdflatex, lualatex)
        timeout: Compilation timeout in seconds
        
    Returns:
        Comprehensive compilation and validation report
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Force print to ensure we see this in logs
        print(f"[TIKZ_DEBUG] tikz_compile_and_validate_tool called with engine={engine}, format={format}")
        print(f"[TIKZ_DEBUG] TikZ code length: {len(tikz_code)} characters")
        logger.info(f"tikz_compile_and_validate_tool called with engine={engine}, format={format}")
        logger.info(f"TikZ code length: {len(tikz_code)} characters")
        
        # Compile TikZ code using MCP service
        print("[TIKZ_DEBUG] Calling compile_tikz_mcp...")
        logger.info("Calling compile_tikz_mcp...")
        compilation_result = await compile_tikz_mcp(tikz_code, engine, format)
        print(f"[TIKZ_DEBUG] compile_tikz_mcp returned: {compilation_result}")
        logger.info(f"compile_tikz_mcp returned: {compilation_result}")
        
        if not compilation_result:
            print("[TIKZ_DEBUG] compile_tikz_mcp returned None or empty result")
            logger.error("compile_tikz_mcp returned None or empty result")
            return """
# TikZ MCP Compilation Report

## Compilation Status
- **Success**: No
- **Status**: error
- **Compilation Time**: 0ms
- **Engine**: """ + engine + """

## Critical Error
- **Error**: compile_tikz_mcp returned None or empty result
- **Debug Info**: This indicates a fundamental communication issue with the MCP service
- **ADK Context**: Tool executed but MCP client returned no data

## Troubleshooting
- Check MCP service status: curl http://localhost:8003/health
- Review ADK tool execution logs for exceptions
- Verify that compile_tikz_mcp function is working correctly
- Check ADK async execution context

## Generated Files
- No files generated due to compilation errors
"""
        
        # Generate comprehensive validation report
        report = f"""
# TikZ MCP Compilation Report

## Compilation Status
- **Success**: {'Yes' if compilation_result['success'] else 'No'}
- **Status**: {compilation_result['status']}
- **Compilation Time**: {compilation_result['compilation_time_ms']}ms
- **Engine**: {engine}

## Generated Files"""
        
        if compilation_result['file_urls']:
            urls = compilation_result['file_urls']
            report += f"\n- **PDF**: [Download]({urls['pdf_url']})"
            report += f"\n- **SVG**: [Download]({urls['svg_url']})"
            report += f"\n- **PNG**: [Download]({urls['png_url']})" 
            report += f"\n- **File Info**: [Details]({urls['info_url']})"
            report += f"\n- **File ID**: `{compilation_result.get('file_id', 'unknown')}`"
        elif compilation_result['artifacts']:
            artifacts = compilation_result['artifacts']
            if artifacts.get('pdf_path'):
                report += f"\n- **PDF**: {artifacts['pdf_path']}"
            if artifacts.get('svg_path'):
                report += f"\n- **SVG**: {artifacts['svg_path']}"
        else:
            report += "\n- No files generated due to compilation errors"
            
        # Add error analysis
        if compilation_result['errors']:
            report += "\n\n## Compilation Errors\n"
            for i, error in enumerate(compilation_result['errors'], 1):
                report += f"\n### Error {i}\n"
                report += f"- **Message**: {error.get('message', 'Unknown error')}\n"
                if error.get('line'):
                    report += f"- **Line**: {error['line']}\n"
                if error.get('suggest'):
                    report += f"- **Suggestion**: {error['suggest']}\n"
        
        # Add warnings
        if compilation_result['warnings']:
            report += "\n\n## Compilation Warnings\n"
            for i, warning in enumerate(compilation_result['warnings'], 1):
                report += f"\n### Warning {i}\n"
                report += f"- **Message**: {warning.get('message', 'Unknown warning')}\n"
                if warning.get('line'):
                    report += f"- **Line**: {warning['line']}\n"
                if warning.get('suggest'):
                    report += f"- **Suggestion**: {warning['suggest']}\n"
        
        # Add general suggestions
        if compilation_result['suggestions']:
            report += "\n\n## Improvement Suggestions\n"
            for suggestion in compilation_result['suggestions']:
                report += f"- {suggestion}\n"
        
        # Add engine information
        report += f"\n\n## Engine Configuration\n"
        report += f"- **Engine Used**: {engine}\n"
        report += f"- **Service**: LaTeX MCP (isolated)\n"
        
        # Add best practices if compilation was successful
        if compilation_result['success']:
            report += "\n\n## TikZ-Feynman Best Practices\n"
            report += "- Use '\\feynmandiagram[...]' for simple diagrams\n"
            report += "- Use '\\begin{feynman}\\end{feynman}' for complex layouts\n"
            report += "- Ensure proper particle naming: \\(e^+\\), \\(\\gamma\\), \\(\\nu_e\\)\n"
            report += "- Use positioning library for relative placement\n"
            report += "- Include proper momentum labels and arrows\n"
            report += "\n**Note**: Files generated by MCP service are available for download."
        else:
            report += "\n\n## Next Steps\n"
            report += "- Check TikZ syntax and LaTeX package requirements\n"
            report += "- Consider switching between pdflatex and lualatex engines\n"
            report += "- Review error messages above for specific fixes\n"
        
        return report
        
    except Exception as e:
        # Error in MCP communication
        logger.error(f"Exception in tikz_compile_and_validate_tool: {str(e)}")
        logger.error(f"Exception type: {type(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        error_report = f"""
# TikZ MCP Communication Error

## Critical Error
- **Status**: MCP service communication failed
- **Error**: {str(e)}
- **Error Type**: {type(e).__name__}
- **Service**: LaTeX MCP at localhost:8003

## Troubleshooting
- Check if MCP service is running: curl http://localhost:8003/health
- Verify network connectivity and service availability
- Review MCP service logs for detailed error information
- Exception details logged for debugging

**Please check MCP service status and try again.**
"""
        return error_report


# Simple fallback validation function for basic syntax checking
def _validate_tikz_syntax(tikz_code: str, packages: list) -> dict:
    """Basic TikZ syntax validation."""
    syntax_valid = True
    structure_valid = True
    syntax_errors = []
    structure_issues = []
    
    # Basic syntax checks
    if '\\begin{tikzpicture}' not in tikz_code and '\\feynmandiagram' not in tikz_code:
        syntax_errors.append("Missing TikZ environment (\\begin{tikzpicture} or \\feynmandiagram)")
        syntax_valid = False
    
    # Check for balanced braces
    open_braces = tikz_code.count('{')
    close_braces = tikz_code.count('}')
    if open_braces != close_braces:
        syntax_errors.append(f"Unbalanced braces: {open_braces} open, {close_braces} close")
        syntax_valid = False
    
    # Structure checks
    if '\\end{tikzpicture}' in tikz_code and '\\begin{tikzpicture}' not in tikz_code:
        structure_issues.append("Found \\end{tikzpicture} without matching \\begin{tikzpicture}")
        structure_valid = False
    
    quality_score = 100
    if syntax_errors:
        quality_score -= len(syntax_errors) * 20
    if structure_issues:
        quality_score -= len(structure_issues) * 10
    
    return {
        'syntax_valid': syntax_valid,
        'structure_valid': structure_valid,
        'syntax_errors': syntax_errors,
        'structure_issues': structure_issues,
        'quality_score': max(0, quality_score)
    }


TikZValidatorAgent = Agent(
    model=TIKZ_VALIDATOR_MODEL,  # Use gemini-2.0-flash for MCP LaTeX compilation 
    name="tikz_validator_agent",
    description="Compiles and validates TikZ code through MCP LaTeX service with PDF/SVG/PNG generation.",
    instruction=TIKZ_VALIDATOR_AGENT_PROMPT,
    tools=[
        tikz_compile_and_validate_tool,
    ],
    output_key="tikz_compilation_report",  # State management: outputs to state.tikz_compilation_report
)