
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class GenerationResult:
    text: str
    latency_ms: float

    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None

    total_duration_ms: Optional[float] = None
    load_duration_ms: Optional[float] = None
    prompt_eval_duration_ms: Optional[float] = None
    generation_duration_ms: Optional[float] = None
    tokens_per_second: Optional[float] = None

    time_to_first_token_ms: Optional[float] = None


class ModelProvider(ABC):

    @abstractmethod
    async def generate(
        self,
        model: str,
        prompt: str,
    ) -> GenerationResult:
        pass

    @abstractmethod
    async def list_models(self) -> list:
        pass
