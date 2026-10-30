
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.services.registry import registry


app = FastAPI(
    title="ModelBench AI",
    description="LLM benchmarking and evaluation platform",
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BenchmarkRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=10000)
    model: str = Field(min_length=1, max_length=100)
    repeat: int = Field(default=1, ge=1, le=10)


benchmark_results: list[dict] = []


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "modelbench-api",
        "version": "0.4.0",
    }


@app.get("/api/models")
async def list_models():
    models = await registry.list_all_models()

    return {
        "models": models,
        "count": len(models),
    }


@app.post("/api/benchmarks/run")
async def run_benchmark(request: BenchmarkRequest):

    if request.model == "mock-model":
        provider_name = "mock"
    else:
        provider_name = "ollama"

    provider = registry.get_provider(provider_name)

    results = []

    for run_number in range(1, request.repeat + 1):
        try:
            generation = await provider.generate(
                model=request.model,
                prompt=request.prompt,
            )

            result = {
                "id": str(uuid4()),
                "run_number": run_number,
                "model": request.model,
                "provider": provider_name,
                "prompt": request.prompt,
                "response": generation.text,

                # Request-level measurement
                "latency_ms": generation.latency_ms,

                # Token counts
                "input_tokens": generation.input_tokens,
                "output_tokens": generation.output_tokens,
                "output_words": len(generation.text.split()),

                # Provider timing measurements
                "total_duration_ms": generation.total_duration_ms,
                "load_duration_ms": generation.load_duration_ms,
                "prompt_eval_duration_ms": (
                    generation.prompt_eval_duration_ms
                ),
                "generation_duration_ms": (
                    generation.generation_duration_ms
                ),
                "tokens_per_second": generation.tokens_per_second,
                "time_to_first_token_ms": (
                    generation.time_to_first_token_ms
                ),

                "success": True,
                "created_at": datetime.now(
                    timezone.utc
                ).isoformat(),
            }

        except Exception as exc:
            result = {
                "id": str(uuid4()),
                "run_number": run_number,
                "model": request.model,
                "provider": provider_name,
                "prompt": request.prompt,
                "response": None,
                "latency_ms": None,
                "input_tokens": None,
                "output_tokens": None,
                "output_words": None,
                "total_duration_ms": None,
                "load_duration_ms": None,
                "prompt_eval_duration_ms": None,
                "generation_duration_ms": None,
                "tokens_per_second": None,
                "time_to_first_token_ms": None,
                "success": False,
                "error": str(exc),
                "created_at": datetime.now(
                    timezone.utc
                ).isoformat(),
            }

        benchmark_results.append(result)
        results.append(result)

    successful_runs = [
        item for item in results if item["success"]
    ]

    return {
        "run_count": len(results),
        "successful_runs": len(successful_runs),
        "failed_runs": len(results) - len(successful_runs),
        "results": results,
        "note": (
            "Latency includes the complete provider request. "
            "Ollama timing fields are reported separately."
        ),
    }


@app.get("/api/benchmarks/results")
async def get_benchmark_results():
    return {
        "count": len(benchmark_results),
        "results": benchmark_results,
    }
