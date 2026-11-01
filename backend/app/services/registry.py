from typing import Optional

from app.services.base import ModelProvider
from app.services.mock import MockProvider
from app.services.ollama import OllamaProvider


class ProviderRegistry:

    def __init__(self):
        self.providers: dict[str, ModelProvider] = {
            "mock": MockProvider(),
            "ollama": OllamaProvider(),
        }

    @staticmethod
    def classify_model(model: dict) -> list:
        """
        Provide heuristic capability labels.

        These are metadata hints, not benchmark-verified capabilities.
        """

        name = model.get("name", "").lower()
        family = model.get("family", "").lower()

        capabilities = ["general"]

        if "coder" in name or "code" in name:
            capabilities.append("coding")

        if (
            "reasoning" in name
            or "deepseek-r1" in name
            or "qwen3" in name
            or "phi" in name
        ):
            capabilities.append("reasoning")

        if "vision" in name or "gemma3" in family:
            capabilities.append("vision")

        if "embed" in name:
            capabilities.append("embeddings")

        return list(dict.fromkeys(capabilities))

    @staticmethod
    def enrich_model(model: dict) -> dict:
        """
        Normalize provider model metadata while preserving
        the existing API fields.
        """

        enriched = dict(model)

        enriched.setdefault("id", enriched.get("name"))
        enriched.setdefault("name", enriched.get("id"))

        enriched["provider"] = enriched.get("provider", "unknown")
        enriched["configured"] = bool(
            enriched.get("configured", False)
        )

        enriched["parameter_size"] = enriched.get(
            "parameter_size"
        )

        enriched["quantization_level"] = enriched.get(
            "quantization_level"
        )

        enriched["family"] = enriched.get("family")

        size_bytes = enriched.get("size")

        enriched["size_bytes"] = size_bytes

        if isinstance(size_bytes, (int, float)):
            enriched["size_gb"] = round(
                size_bytes / (1024 ** 3), 2
            )
        else:
            enriched["size_gb"] = None

        enriched["capabilities"] = (
            ProviderRegistry.classify_model(enriched)
        )

        return enriched

    def get_provider(self, provider_name: str) -> ModelProvider:
        provider = self.providers.get(provider_name)

        if provider is None:
            raise ValueError(
                f"Provider '{provider_name}' is not registered."
            )

        return provider

    async def resolve_model(self, model_identifier: str):
        """
        Resolve a model using either its ID or display name.
        """

        for provider_name, provider in self.providers.items():
            try:
                models = await provider.list_models()

                for model in models:
                    model_id = model.get("id")
                    model_name = model.get("name")

                    if (
                        model_identifier == model_id
                        or model_identifier == model_name
                    ):
                        return provider_name, provider

            except Exception:
                continue

        raise ValueError(
            f"Model '{model_identifier}' was not found "
            "in any registered provider."
        )

    async def list_all_models(
        self,
        provider_filter: Optional[str] = None,
        capability_filter: Optional[str] = None,
    ) -> list:
        """
        Discover and enrich models across registered providers.

        Optional filters:
        - provider_filter: ollama, mock, etc.
        - capability_filter: general, coding, reasoning, vision.
        """

        models = []

        providers = self.providers.items()

        if provider_filter:
            provider = self.providers.get(provider_filter)

            if provider is None:
                raise ValueError(
                    f"Provider '{provider_filter}' is not registered."
                )

            providers = [(provider_filter, provider)]

        for provider_name, provider in providers:
            try:
                provider_models = await provider.list_models()

                for model in provider_models:
                    enriched = self.enrich_model(model)
                    enriched["provider"] = provider_name
                    models.append(enriched)

            except Exception:
                continue

        if capability_filter:
            models = [
                model
                for model in models
                if capability_filter in model["capabilities"]
            ]

        return models

    async def get_model(
        self,
        model_identifier: str,
    ) -> dict:
        """
        Retrieve enriched metadata for one installed model.
        """

        models = await self.list_all_models()

        for model in models:
            if (
                model.get("id") == model_identifier
                or model.get("name") == model_identifier
            ):
                return model

        raise ValueError(
            f"Model '{model_identifier}' was not found."
        )

    async def get_registry_summary(self) -> dict:
        """
        Return model registry statistics.
        """

        models = await self.list_all_models()

        providers = sorted({
            model["provider"] for model in models
        })

        capabilities = {}

        for model in models:
            for capability in model["capabilities"]:
                capabilities[capability] = (
                    capabilities.get(capability, 0) + 1
                )

        return {
            "total_models": len(models),
            "providers": providers,
            "capability_counts": capabilities,
            "models": models,
        }


registry = ProviderRegistry()
