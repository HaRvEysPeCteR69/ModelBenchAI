
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

    async def resolve_model(self, model_identifier: str):
        """
        Resolve a model using either its ID or its name.

        Frontend model selections use model IDs, while model
        providers may expose a different display name.
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

    async def list_all_models(self) -> list[dict]:
        models = []

        for provider_name, provider in self.providers.items():
            try:
                provider_models = await provider.list_models()
                models.extend(provider_models)

            except Exception:
                continue

        return models


registry = ProviderRegistry()
