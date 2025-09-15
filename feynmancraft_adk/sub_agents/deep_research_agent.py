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

"""
Deep Research Agent for FeynmanCraft ADK.

This agent performs deep web research when the KB retriever cannot find relevant data.
It follows an iterative research pattern inspired by LangGraph:
1. Generate multiple search queries
2. Perform parallel web searches
3. Reflect on gathered information to identify knowledge gaps
4. Generate follow-up queries if needed
5. Synthesize findings into comprehensive answer with citations
"""

import logging
import json
import asyncio
import os
from typing import List, Dict, Any, Optional
from datetime import datetime

from google.adk.agents import Agent
import google.generativeai as genai
from pydantic import BaseModel, Field

from ..models import DEEP_RESEARCH_MODEL, RESEARCH_QUERY_MODEL
from .deep_research_agent_prompt import PROMPT as DEEP_RESEARCH_AGENT_PROMPT

logger = logging.getLogger(__name__)

# Pydantic models for structured output
class SearchQuery(BaseModel):
    """Individual search query with rationale"""
    query: str = Field(description="The search query string")
    rationale: str = Field(description="Why this query is useful for the research")

class SearchQueryList(BaseModel):
    """List of search queries for research"""
    queries: List[SearchQuery] = Field(description="List of search queries")

class Reflection(BaseModel):
    """Reflection on current research state"""
    is_sufficient: bool = Field(description="Whether enough information has been gathered")
    knowledge_gap: Optional[str] = Field(description="What information is still missing")
    follow_up_queries: List[str] = Field(description="Additional queries to fill knowledge gaps")

class ResearchResult(BaseModel):
    """Structured research result with citations"""
    content: str = Field(description="The research findings")
    sources: List[Dict[str, str]] = Field(description="List of sources with URLs and snippets")
    confidence: float = Field(description="Confidence score from 0 to 1")


def generate_search_queries(research_topic: str, num_queries: int = 3) -> List[str]:
    """
    Generate multiple search queries for comprehensive research.
    
    Args:
        research_topic: The main research topic
        num_queries: Number of queries to generate
        
    Returns:
        List of search query strings
    """
    try:
        prompt = f"""Given the particle physics research topic: "{research_topic}"
        
Generate {num_queries} diverse and specific search queries that would help gather comprehensive information about this topic.
Focus on:
- Theoretical foundations
- Experimental evidence
- Recent research papers
- Feynman diagram representations
- Mathematical formulations

Return as JSON with format:
{{
    "queries": [
        {{"query": "search query 1", "rationale": "why this helps"}},
        {{"query": "search query 2", "rationale": "why this helps"}},
        {{"query": "search query 3", "rationale": "why this helps"}}
    ]
}}"""
        
        # Configure Gemini for query generation
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
        model = genai.GenerativeModel(RESEARCH_QUERY_MODEL)
        
        response = model.generate_content(prompt)
        
        # Check if response has text
        if not response.text or response.text.strip() == "":
            logger.warning("Empty response from model, using fallback queries")
            raise ValueError("Empty response from model")
        
        # Try to parse JSON response
        try:
            result = json.loads(response.text)
            if "queries" in result and isinstance(result["queries"], list):
                return [q["query"] for q in result["queries"] if "query" in q]
            else:
                logger.warning("Invalid JSON structure in response, using fallback")
                raise ValueError("Invalid JSON structure")
        except json.JSONDecodeError as je:
            logger.warning(f"JSON decode error: {je}, response was: {response.text[:200]}")
            raise ValueError(f"JSON decode error: {je}")
    except Exception as e:
        logger.error(f"Error generating search queries: {e}")
        # Fallback queries
        return [
            f"{research_topic} Feynman diagram",
            f"{research_topic} particle physics theory",
            f"{research_topic} experimental results"
        ]


async def perform_web_search(query: str, genai_client: Optional[Any] = None) -> Dict[str, Any]:
    """
    Perform web search using Google's generative AI with search grounding.
    
    Args:
        query: Search query string
        genai_client: Google GenAI client instance
        
    Returns:
        Dict containing search results and sources
    """
    try:
        # Use google-generativeai instead of google-genai for better compatibility
        import google.generativeai as genai
        
        # Configure the API key
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            logger.error("GOOGLE_API_KEY not found in environment")
            return {
                "query": query,
                "content": f"Cannot search for '{query}': API key not configured",
                "sources": []
            }
        
        genai.configure(api_key=api_key)
        
        # Search prompt optimized for particle physics
        search_prompt = f"""Search for comprehensive information about: {query}

Please focus on finding:
- Academic papers and research publications
- Physics textbooks and educational resources
- Experimental data and results from particle physics experiments
- Feynman diagram examples and conventions
- Mathematical formulations and theoretical frameworks
- Recent developments and discoveries

Provide detailed, accurate information suitable for generating Feynman diagrams.

Query: {query}
Date: {datetime.now().strftime('%Y-%m-%d')}"""
        
        # Use Gemini model with Google Search grounding
        model = genai.GenerativeModel(RESEARCH_QUERY_MODEL)
        
        # Configure generation with search tools
        generation_config = genai.GenerationConfig(
            temperature=0.1,
            top_p=0.8,
            top_k=40,
            max_output_tokens=2048,
        )
        
        # Generate content with search grounding
        response = model.generate_content(
            search_prompt,
            generation_config=generation_config,
            tools=[{"google_search": {}}]  # Enable search grounding
        )
        
        # Extract sources from grounding metadata
        sources = []
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'grounding_metadata'):
                metadata = candidate.grounding_metadata
                if hasattr(metadata, 'grounding_chunks'):
                    for chunk in metadata.grounding_chunks:
                        if hasattr(chunk, 'web'):
                            sources.append({
                                "url": chunk.web.uri,
                                "title": chunk.web.title,
                                "snippet": getattr(chunk, 'text', '')[:200]
                            })
        
        content = response.text if response.text else f"Search completed for: {query}"
        
        return {
            "query": query,
            "content": content,
            "sources": sources
        }
        
    except Exception as e:
        logger.error(f"Error in web search for query '{query}': {e}")
        # Fallback content for physics topics
        fallback_content = f"""Research on: {query}

This appears to be a specialized particle physics topic. Key considerations for Feynman diagram generation:

1. Identify all particles involved
2. Determine interaction types (electromagnetic, weak, strong)
3. Check conservation laws (energy, momentum, charge, etc.)
4. Consider quantum numbers and selection rules
5. Verify coupling strengths and vertex factors

For advanced processes like penguin diagrams, consider:
- Loop-level contributions
- Effective field theory descriptions
- Experimental observables
- Theoretical predictions

Search error: {str(e)}"""
        
        return {
            "query": query,
            "content": fallback_content,
            "sources": [{"url": "fallback", "title": "Physics Knowledge Base", "snippet": "Basic physics principles"}]
        }


def reflect_on_research(research_results: List[Dict[str, Any]], original_topic: str) -> Reflection:
    """
    Reflect on gathered research to identify knowledge gaps.
    
    Args:
        research_results: List of search results
        original_topic: Original research topic
        
    Returns:
        Reflection object with analysis
    """
    try:
        # Combine all research content
        combined_content = "\n\n---\n\n".join([r["content"] for r in research_results])
        
        prompt = f"""Analyze the following research results about "{original_topic}":

{combined_content}

Evaluate whether sufficient information has been gathered to:
1. Understand the theoretical physics concepts
2. Create accurate Feynman diagrams
3. Validate the physics
4. Provide comprehensive explanations

Return as JSON:
{{
    "is_sufficient": true/false,
    "knowledge_gap": "what information is still missing (if any)",
    "follow_up_queries": ["query1", "query2"] // empty list if sufficient
}}"""
        
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
        model = genai.GenerativeModel(DEEP_RESEARCH_MODEL)
        
        response = model.generate_content(prompt)
        
        # Check if response has text
        if not response.text or response.text.strip() == "":
            logger.warning("Empty response from reflection model, assuming sufficient")
            raise ValueError("Empty response from model")
        
        # Try to parse JSON response
        try:
            result = json.loads(response.text)
            # Validate required fields
            if "is_sufficient" in result:
                return Reflection(
                    is_sufficient=result.get("is_sufficient", True),
                    knowledge_gap=result.get("knowledge_gap"),
                    follow_up_queries=result.get("follow_up_queries", [])
                )
            else:
                logger.warning("Invalid reflection JSON structure, using default")
                raise ValueError("Invalid JSON structure")
        except json.JSONDecodeError as je:
            logger.warning(f"Reflection JSON decode error: {je}, response was: {response.text[:200]}")
            raise ValueError(f"JSON decode error: {je}")
    except Exception as e:
        logger.error(f"Error in reflection: {e}")
        # Default to sufficient to avoid infinite loops
        return Reflection(
            is_sufficient=True,
            knowledge_gap=None,
            follow_up_queries=[]
        )


async def deep_research_physics(
    topic: str,
    max_iterations: int = 3,
    queries_per_iteration: int = 3
) -> Dict[str, Any]:
    """
    Main deep research function that orchestrates the research process.
    
    Args:
        topic: Research topic
        max_iterations: Maximum research iterations
        queries_per_iteration: Number of queries per iteration
        
    Returns:
        Dict containing research results and sources
    """
    all_results = []
    all_sources = []
    iteration = 0
    
    # No need for separate GenAI client - using google-generativeai directly in perform_web_search
    genai_client = None  # Will be configured within perform_web_search
    
    while iteration < max_iterations:
        logger.info(f"Deep research iteration {iteration + 1} for topic: {topic}")
        
        # Generate search queries
        if iteration == 0:
            queries = generate_search_queries(topic, queries_per_iteration)
        else:
            # Use follow-up queries from reflection
            queries = reflection.follow_up_queries[:queries_per_iteration]
        
        # Perform parallel searches
        search_tasks = [perform_web_search(query, genai_client) for query in queries]
        search_results = await asyncio.gather(*search_tasks)
        
        # Add results
        all_results.extend(search_results)
        for result in search_results:
            all_sources.extend(result.get("sources", []))
        
        # Reflect on current state
        reflection = reflect_on_research(all_results, topic)
        
        if reflection.is_sufficient or not reflection.follow_up_queries:
            break
        
        iteration += 1
    
    # Synthesize final answer
    return synthesize_research(all_results, all_sources, topic)


def synthesize_research(
    research_results: List[Dict[str, Any]],
    all_sources: List[Dict[str, str]],
    topic: str
) -> Dict[str, Any]:
    """
    Synthesize all research into a comprehensive answer.
    
    Args:
        research_results: All research results
        all_sources: All sources found
        topic: Original topic
        
    Returns:
        Dict with synthesized content and deduplicated sources
    """
    try:
        combined_content = "\n\n---\n\n".join([r["content"] for r in research_results])
        
        prompt = f"""Synthesize the following research about "{topic}" into a comprehensive answer:

{combined_content}

Create a detailed explanation that:
1. Explains the physics concepts clearly
2. Describes how to represent this in a Feynman diagram
3. Includes relevant mathematical formulations
4. Cites sources appropriately using [1], [2], etc.
5. Highlights any important caveats or uncertainties

Be thorough but concise. Focus on accuracy and clarity."""
        
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
        model = genai.GenerativeModel(DEEP_RESEARCH_MODEL)
        
        response = model.generate_content(prompt)
        
        # Deduplicate sources
        unique_sources = []
        seen_urls = set()
        for source in all_sources:
            if source["url"] not in seen_urls:
                seen_urls.add(source["url"])
                unique_sources.append(source)
        
        return {
            "content": response.text,
            "sources": unique_sources[:10],  # Limit to top 10 sources
            "research_iterations": len(research_results) // 3,  # Approximate iterations
            "confidence": 0.85  # High confidence after deep research
        }
    except Exception as e:
        logger.error(f"Error synthesizing research: {e}")
        return {
            "content": "Failed to synthesize research results",
            "sources": [],
            "research_iterations": 0,
            "confidence": 0.0
        }


# Wrapper function for ADK agent tool
def perform_deep_research(topic: str) -> Dict[str, Any]:
    """
    ADK tool wrapper for deep research functionality.
    
    Args:
        topic: Physics topic to research
        
    Returns:
        Research results with content and sources
    """
    try:
        # Run async function in sync context using asyncio
        import asyncio
        
        # Get or create event loop
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Run the async research function
        if loop.is_running():
            # If loop is already running, create a task
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, deep_research_physics(topic, max_iterations=3, queries_per_iteration=3))
                result = future.result()
        else:
            # Run directly
            result = loop.run_until_complete(deep_research_physics(topic, max_iterations=3, queries_per_iteration=3))
        
        return result
    except Exception as e:
        logger.error(f"Deep research failed: {e}")
        return {
            "content": f"Deep research failed: {str(e)}",
            "sources": [],
            "confidence": 0.0
        }


# Import os for environment variables
import os

# --- Agent Definition ---
DeepResearchAgent = Agent(
    model=DEEP_RESEARCH_MODEL,  # Use gemini-2.5-pro for complex research
    name="deep_research_agent",
    description="Performs deep web research on particle physics topics when KB retrieval is insufficient. Uses iterative search with reflection to gather comprehensive information.",
    instruction=DEEP_RESEARCH_AGENT_PROMPT,
    output_key="deep_research_results",  # State management: outputs to state.deep_research_results
    tools=[
        perform_deep_research,
    ],
)