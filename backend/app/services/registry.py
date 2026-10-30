
from app.services.base import ModelProvider
from app.services.mock import MockProvider
from app.services.ollama import OllamaProvider


class ProviderRegistry:

    def __init__(self):
        self.providers: dict[str, ModelProvider] = {
            "mock": MockProvider(),
            "ollama": OllamaProvider(),
        }

    def get_provider(self, provider_name: str) -> ModelProvider:
        provider = self.providers.get(provider_name)

        if provider is None:
            raise ValueError(
                f"Provider '{provider_name}' is not registered."
            )

        return provider

    async def list_all_models(self) -> list[dict]:
        models = []

        for provider_name, provider in self.providers.items():
            try:
                provider_models = await provider.list_models()
                models.extend(provider_models)
            except Exception:
                # A provider can be unavailable without breaking the registry.
                continue

        return models


registry = ProviderRegistry()
