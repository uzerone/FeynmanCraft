"""Configuration settings for FeynmanCraft ADK."""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


@dataclass
class ModelConfig:
    """Model configuration settings."""
    # ADK Model Configuration
    model_name: str = field(default_factory=lambda: os.getenv("ADK_MODEL_NAME", "gemini-2.5-flash"))
    temperature: float = field(default_factory=lambda: float(os.getenv("MODEL_TEMPERATURE", "0.3")))
    max_tokens: int = field(default_factory=lambda: int(os.getenv("MODEL_MAX_TOKENS", "8192")))
    
    # Embedding Model
    embedding_model: str = field(default_factory=lambda: os.getenv("EMBEDDING_MODEL", "text-embedding-004"))
    embedding_dim: int = 768
    
    # Model-specific configurations for different agents
    # Complex agents use gemini-2.5-pro for better reasoning
    planner_model: str = field(default_factory=lambda: os.getenv("PLANNER_MODEL", "gemini-2.5-pro"))
    generator_model: str = field(default_factory=lambda: os.getenv("GENERATOR_MODEL", "gemini-2.5-pro"))
    physics_validator_model: str = field(default_factory=lambda: os.getenv("PHYSICS_VALIDATOR_MODEL", "gemini-2.5-pro"))
    deep_research_model: str = field(default_factory=lambda: os.getenv("DEEP_RESEARCH_MODEL", "gemini-2.5-pro"))
    
    # Simple agents use gemini-2.5-flash for speed
    kb_retriever_model: str = field(default_factory=lambda: os.getenv("KB_RETRIEVER_MODEL", "gemini-2.5-flash"))
    tikz_validator_model: str = field(default_factory=lambda: os.getenv("TIKZ_VALIDATOR_MODEL", "gemini-2.5-flash"))
    feedback_model: str = field(default_factory=lambda: os.getenv("FEEDBACK_MODEL", "gemini-2.5-flash"))
    research_query_model: str = field(default_factory=lambda: os.getenv("RESEARCH_QUERY_MODEL", "gemini-2.0-flash"))


@dataclass
class KnowledgeBaseConfig:
    """Knowledge base configuration."""
    # KB Mode Selection - now defaults to local only
    mode: str = field(default_factory=lambda: os.getenv("KB_MODE", "local").lower())
    
    # Local KB Configuration
    data_dir: Path = field(default_factory=lambda: Path(__file__).parent.parent / "data")
    local_kb_path: Path = field(default_factory=lambda: Path(__file__).parent.parent / "data" / "feynman_kb.json")
    local_index_path: Path = field(default_factory=lambda: Path(__file__).parent.parent / "data" / "feynman_kb.ann")
    local_id_map_path: Path = field(default_factory=lambda: Path(__file__).parent.parent / "data" / "feynman_kb_id_map.json")
    
    @property
    def use_bigquery(self) -> bool:
        return False  # BigQuery functionality removed
    
    @property
    def use_local_kb(self) -> bool:
        return True  # Always use local KB
    
    @property
    def has_local_index(self) -> bool:
        return self.local_index_path.exists()


@dataclass
class SearchConfig:
    """Search and retrieval configuration."""
    default_k: int = field(default_factory=lambda: int(os.getenv("DEFAULT_SEARCH_K", "5")))
    max_k: int = field(default_factory=lambda: int(os.getenv("MAX_SEARCH_K", "20")))
    timeout_seconds: int = field(default_factory=lambda: int(os.getenv("SEARCH_TIMEOUT", "30")))
    similarity_threshold: float = field(default_factory=lambda: float(os.getenv("SIMILARITY_THRESHOLD", "0.7")))
    
    # Search weights for hybrid search
    vector_weight: float = field(default_factory=lambda: float(os.getenv("VECTOR_WEIGHT", "0.6")))
    keyword_weight: float = field(default_factory=lambda: float(os.getenv("KEYWORD_WEIGHT", "0.4")))


@dataclass
class ValidationConfig:
    """Validation configuration for TikZ and Physics."""
    # TikZ Validation
    latex_executable: str = field(default_factory=lambda: os.getenv("LATEX_EXECUTABLE", "pdflatex"))
    latex_timeout: int = field(default_factory=lambda: int(os.getenv("LATEX_TIMEOUT", "30")))
    
    # Physics Validation
    physics_rules_path: Path = field(default_factory=lambda: Path(__file__).parent.parent / "data" / "pprules.json")
    enable_physics_validation: bool = field(default_factory=lambda: os.getenv("ENABLE_PHYSICS_VALIDATION", "true").lower() == "true")
    strict_physics_mode: bool = field(default_factory=lambda: os.getenv("STRICT_PHYSICS_MODE", "false").lower() == "true")


@dataclass
class APIConfig:
    """API and credentials configuration."""
    google_api_key: Optional[str] = field(default_factory=lambda: os.getenv("GOOGLE_API_KEY"))
    google_credentials_path: Optional[str] = field(default_factory=lambda: os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
    
    # Rate limiting
    requests_per_minute: int = field(default_factory=lambda: int(os.getenv("REQUESTS_PER_MINUTE", "60")))
    retry_attempts: int = field(default_factory=lambda: int(os.getenv("RETRY_ATTEMPTS", "3")))


@dataclass
class LoggingConfig:
    """Logging configuration."""
    level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    format: str = field(default_factory=lambda: os.getenv("LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    file_path: Optional[str] = field(default_factory=lambda: os.getenv("LOG_FILE"))
    max_file_size: int = field(default_factory=lambda: int(os.getenv("LOG_MAX_SIZE", "10485760")))  # 10MB


@dataclass
class FeynmanCraftConfig:
    """Main configuration class combining all settings."""
    models: ModelConfig = field(default_factory=ModelConfig)
    knowledge_base: KnowledgeBaseConfig = field(default_factory=KnowledgeBaseConfig)
    search: SearchConfig = field(default_factory=SearchConfig)
    validation: ValidationConfig = field(default_factory=ValidationConfig)
    api: APIConfig = field(default_factory=APIConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary."""
        return {
            "models": self.models.__dict__,
            "knowledge_base": {
                **self.knowledge_base.__dict__,
                "data_dir": str(self.knowledge_base.data_dir),
                "local_kb_path": str(self.knowledge_base.local_kb_path),
                "local_index_path": str(self.knowledge_base.local_index_path),
                "local_id_map_path": str(self.knowledge_base.local_id_map_path),
            },
            "search": self.search.__dict__,
            "validation": {
                **self.validation.__dict__,
                "physics_rules_path": str(self.validation.physics_rules_path),
            },
            "api": self.api.__dict__,
            "logging": self.logging.__dict__,
        }
    
    def validate(self) -> List[str]:
        """Validate configuration and return list of issues."""
        issues = []
        
        # API validation
        if not self.api.google_api_key:
            issues.append("GOOGLE_API_KEY not set - some features may not work")
        
        # BigQuery functionality removed - no validation needed
        
        # Local KB validation
        if self.knowledge_base.use_local_kb and not self.knowledge_base.local_kb_path.exists():
            issues.append(f"Local KB enabled but file not found: {self.knowledge_base.local_kb_path}")
        
        # Physics validation
        if self.validation.enable_physics_validation and not self.validation.physics_rules_path.exists():
            issues.append(f"Physics validation enabled but rules file not found: {self.validation.physics_rules_path}")
        
        return issues


# Global configuration instance
config = FeynmanCraftConfig()

# Backward compatibility - keep existing variables for legacy code
KB_MODE = config.knowledge_base.mode
USE_BIGQUERY = False  # BigQuery functionality removed
USE_LOCAL_KB = config.knowledge_base.use_local_kb
LOCAL_KB_PATH = config.knowledge_base.local_kb_path
LOCAL_INDEX_PATH = config.knowledge_base.local_index_path
LOCAL_ID_MAP_PATH = config.knowledge_base.local_id_map_path
EMBEDDING_MODEL = config.models.embedding_model
EMBEDDING_DIM = config.models.embedding_dim
DEFAULT_SEARCH_K = config.search.default_k
SEARCH_TIMEOUT = config.search.timeout_seconds
GOOGLE_API_KEY = config.api.google_api_key
LOG_LEVEL = config.logging.level


def get_kb_config():
    """Get current knowledge base configuration."""
    return {
        "mode": config.knowledge_base.mode,
        "use_bigquery": False,  # BigQuery functionality removed
        "use_local": config.knowledge_base.use_local_kb,
        "local": {
            "kb_path": str(config.knowledge_base.local_kb_path),
            "index_path": str(config.knowledge_base.local_index_path),
            "has_index": config.knowledge_base.has_local_index,
        },
    }


def validate_config():
    """Validate configuration settings."""
    return config.validate()


def get_model_for_agent(agent_type: str) -> str:
    """Get appropriate model for specific agent type."""
    model_map = {
        # Complex agents - use gemini-2.5-pro
        "planner": config.models.planner_model,
        "generator": config.models.generator_model,
        "physics_validator": config.models.physics_validator_model,
        "deep_research": config.models.deep_research_model,
        
        # Simple agents - use gemini-2.5-flash
        "kb_retriever": config.models.kb_retriever_model,
        "tikz_validator": config.models.tikz_validator_model,
        "feedback": config.models.feedback_model,
        "research_query": config.models.research_query_model,
        
        # Legacy mappings
        "validator": config.models.physics_validator_model,
        "default": config.models.model_name,
    }
    return model_map.get(agent_type, config.models.model_name)