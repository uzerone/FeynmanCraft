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

"""FeynmanCraft ADK sample agent."""

import logging
import warnings
import sys
import uuid
from typing import Any, Dict, Optional

from google.adk.agents import Agent

from . import MODEL
from .sub_agents.planner_agent import PlannerAgent
from .sub_agents.kb_retriever_agent import KBRetrieverAgent
from .sub_agents.diagram_generator_agent import DiagramGeneratorAgent
from .sub_agents.tikz_validator_agent import TikZValidatorAgent
from .sub_agents.physics_validator_agent import PhysicsValidatorAgent
from .sub_agents.feedback_agent import FeedbackAgent
from .sub_agents.deep_research_agent import DeepResearchAgent
from .tracing_wrapper import TracingContext, TracedAgent, emit_workflow_stage, emit_agent_transfer

warnings.filterwarnings("ignore", category=UserWarning, module=".*pydantic.*")

logger = logging.getLogger(__name__)
logger.debug("Using MODEL: %s", MODEL)


# Create the base root agent
_base_root_agent = Agent(
    model=MODEL,
    name="root_agent",
    description=(
        "Use tools and other agents provided to generate TikZ Feynman diagrams "
        "from natural language descriptions of physics processes."
    ),
    instruction="""You are the master controller of the FeynmanCraft system, responsible for orchestrating an advanced workflow that includes a **conditional correction loop**. Your goal is to ensure the generated Feynman diagram code is not only physically correct but also 100% compilable.

**TRACING INTEGRATION:**
All your operations now include automatic correlation tracking. Each user request gets a unique sessionId and traceId for end-to-end observability. When transferring between agents, correlation IDs are maintained for complete workflow visibility.

**CONTINUOUS CONVERSATION SUPPORT:**
You support continuous conversation - after completing one diagram generation, you can immediately process new user requests for additional diagrams. Each new request starts a fresh workflow while maintaining conversation context.

**Your Team of Expert Agents:**
* `PlannerAgent`: The task planner.
* `KBRetrieverAgent`: The knowledge base expert.
* `DeepResearchAgent`: The deep web research specialist (activated when KB has insufficient data).
* `PhysicsValidatorAgent`: The physics theorist.
* `DiagramGeneratorAgent`: The **Code Generation and Correction Engineer**.
* `TikZValidatorAgent`: The **Local Compiler**.
* `FeedbackAgent`: The final report analyst.

**Your Enhanced Workflow - Now with a Validation-Correction Loop:**

1.  **Receive User Request**: e.g., "Draw a diagram for electron-positron annihilation." (Can be a new request after previous completion)
2.  **Plan and Prepare**: 
    - Call `PlannerAgent` to analyze the request.
    - Call `KBRetrieverAgent` to search for relevant examples.
    - **If KB returns insufficient results** (empty list or low relevance):
        - Call `DeepResearchAgent` to perform comprehensive web research.
        - Use the research results to supplement or replace KB examples.
    - Call `PhysicsValidatorAgent` to validate the physics.

3.  **Enter the Generation-Validation Loop (Max 3 attempts):**
    a. **Generate Code**: Call `DiagramGeneratorAgent` to generate the TikZ code.
    b. **Validate Code**: Pass the generated code to `TikZValidatorAgent` for local compilation.
    c. **Check the Result**:
        - **If validation succeeds (`'success': true`)**: The code compiled! Exit the loop and proceed to step 4.
        - **If validation fails (`'success': false`)**:
            i. **Do not give up!** Take the detailed **error report** (`tikz_compilation_report`) and the **failed code** (`failed_tikz_code`) from the `TikZValidatorAgent`.
            ii. **Re-invoke the `DiagramGeneratorAgent`** with this new information.
            iii. Instruct it to enter "Correction Mode" to fix the code based on the error report.
            iv. Repeat steps `a` through `c`.

4.  **Final Feedback**:
    - If the loop succeeded, pass the final, validated TikZ code and all reports to the `FeedbackAgent`.
    - If the loop still fails after 3 attempts, pass the **last error report** and the corresponding code to the `FeedbackAgent` so it can explain the issue to the user.

5.  **Return Result**: The `FeedbackAgent` will synthesize all information into a final, user-friendly response.

**State Flow Reminder**:
`plan` → `examples` → (optional: `deep_research_results`) → `physics_report` → [ `tikz_code` → `tikz_compilation_report` ] (loop) → `final_response`

**Loop Management Guidelines:**
- Keep track of the current attempt number (1, 2, or 3).
- Always pass both the error report AND the failed code to the DiagramGeneratorAgent for correction.
- If after 3 attempts the code still doesn't compile, proceed to FeedbackAgent with failure information.
- Maintain all previous context (plan, examples, physics_report) throughout the loop.
""",
    tools=[],
    sub_agents=[
        PlannerAgent,
        KBRetrieverAgent,
        DeepResearchAgent,
        PhysicsValidatorAgent,
        DiagramGeneratorAgent,
        TikZValidatorAgent,
        FeedbackAgent,
    ],
)

# Create a traced version that will be wrapped at runtime
def create_traced_root_agent(session_id: str = None, user_request: str = ""):
    """Create a traced root agent with correlation tracking."""
    if not session_id:
        session_id = str(uuid.uuid4())
    
    # Create tracing context
    tracing_context = TracingContext(session_id, user_request)
    
    # Wrap the base agent with tracing
    traced_agent = TracedAgent(_base_root_agent, tracing_context)
    
    # Emit initial workflow stage
    emit_workflow_stage(
        trace_id=tracing_context.trace_id,
        step_id=tracing_context.get_next_step_id(),
        stage="initialization",
        status="started",
        session_id=session_id,
        details={"user_request": user_request}
    )
    
    return traced_agent

# Export the traced root agent as the default
root_agent = _base_root_agent  # Keep backward compatibility


# Support for --input flag when running with ADK CLI
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="FeynmanCraft ADK Agent")
    parser.add_argument(
        "--input", 
        type=str, 
        help="Input request for generating Feynman diagram",
        default="Generate a Feynman diagram for electron-positron annihilation"
    )
    
    args = parser.parse_args()
    
    # This allows testing the agent directly
    if args.input:
        print(f"Processing request: {args.input}")
        # Note: In actual ADK run, this would be handled by the ADK framework
        # This is just for standalone testing 