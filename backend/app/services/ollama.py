
from time import perf_counter

import httpx

from app.services.base import GenerationResult, ModelProvider


class OllamaProvider(ModelProvider):
    """
    Provider adapter for locally hosted Ollama models.

    Supports:
    - Model discovery
    - Text generation
    - Request latency measurement
    - Token usage measurement
    - Model loading duration
    - Prompt evaluation duration
    - Generation duration
    - Output token throughput
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
    ):
        self.base_url = base_url.rstrip("/")

    @staticmethod
    def _nanoseconds_to_ms(value):
        """Convert nanoseconds to milliseconds."""
        if value is None:
            return None

        return round(value / 1_000_000, 3)

    async def generate(
        self,
        model: str,
        prompt: str,
    ) -> GenerationResult:

        # Measure complete request latency.
        start = perf_counter()

        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                },
            )

            response.raise_for_status()
            data = response.json()

        latency_ms = (perf_counter() - start) * 1000

        # Extract token counts.
        input_tokens = data.get("prompt_eval_count")
        output_tokens = data.get("eval_count")

        # Extract Ollama timing measurements.
        total_duration_ms = self._nanoseconds_to_ms(
            data.get("total_duration")
        )

        load_duration_ms = self._nanoseconds_to_ms(
            data.get("load_duration")
        )

        prompt_eval_duration_ms = self._nanoseconds_to_ms(
            data.get("prompt_eval_duration")
        )

        generation_duration_ms = self._nanoseconds_to_ms(
            data.get("eval_duration")
        )

        # Calculate generation throughput.
        tokens_per_second = None

        generation_duration_ns = data.get("eval_duration")

        if (
            output_tokens is not None
            and generation_duration_ns
            and generation_duration_ns > 0
        ):
            tokens_per_second = round(
                output_tokens
                / (generation_duration_ns / 1_000_000_000),
                3,
            )

        return GenerationResult(
            text=data.get("response", ""),
            latency_ms=round(latency_ms, 3),

            input_tokens=input_tokens,
            output_tokens=output_tokens,

            total_duration_ms=total_duration_ms,
            load_duration_ms=load_duration_ms,
            prompt_eval_duration_ms=prompt_eval_duration_ms,
            generation_duration_ms=generation_duration_ms,

            tokens_per_second=tokens_per_second,

            # Non-streaming generation cannot measure true TTFT.
            time_to_first_token_ms=None,
        )

    async def list_models(self) -> list:
        """
        Retrieve installed models from the local Ollama instance.
        """

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.base_url}/api/tags"
            )

            response.raise_for_status()
            data = response.json()

        models = []

        for model in data.get("models", []):
            details = model.get("details", {})

            models.append(
                {
                    "id": model["name"],
                    "name": model["name"],
                    "provider": "ollama",
                    "configured": True,
                    "size": model.get("size"),
                    "parameter_size": details.get(
                        "parameter_size"
                    ),
                    "quantization_level": details.get(
                        "quantization_level"
                    ),
                    "family": details.get("family"),
                }
            )

        return models
