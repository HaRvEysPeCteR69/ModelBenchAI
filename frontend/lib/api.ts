const API_BASE_URL = "http://localhost:8000";

export type HealthStatus = {
  status: string;
  service: string;
  version: string;
};

export type ModelRegistry = {
  models: string[];
  message: string;
};

async function fetchAPI<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getHealth() {
  return fetchAPI<HealthStatus>("/api/health");
}

export function getModels() {
  return fetchAPI<ModelRegistry>("/api/models");
}
