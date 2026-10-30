
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Cpu,
  Play,
  RefreshCw,
  Server,
  Terminal,
  Zap,
} from "lucide-react";

import AppShell from "../components/AppShell";

const API_URL = "http://localhost:8000";

type Model = {
  id: string;
  name: string;
  provider: string;
  configured: boolean;
  size?: number;
  parameter_size?: string;
  quantization_level?: string;
  family?: string;
};

type BenchmarkResult = {
  id: string;
  run_number: number;
  model: string;
  provider: string;
  prompt: string;
  response: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  output_words: number | null;
  total_duration_ms: number | null;
  load_duration_ms: number | null;
  prompt_eval_duration_ms: number | null;
  generation_duration_ms: number | null;
  tokens_per_second: number | null;
  time_to_first_token_ms: number | null;
  success: boolean;
  error?: string;
  created_at: string;
};

type BenchmarkResponse = {
  run_count: number;
  successful_runs: number;
  failed_runs: number;
  results: BenchmarkResult[];
};

export default function BenchmarksPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState(
    "Explain how TCP differs from UDP in three sentences."
  );
  const [repeat, setRepeat] = useState(2);

  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchModels = useCallback(async () => {
    setModelsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/models`);

      if (!response.ok) {
        throw new Error("Could not retrieve available models.");
      }

      const data = await response.json();
      const availableModels: Model[] = data.models ?? [];

      setModels(availableModels);

      setModel((current) => {
        if (
          current &&
          availableModels.some((item) => item.id === current)
        ) {
          return current;
        }

        const ollamaModel = availableModels.find(
          (item) => item.provider === "ollama"
        );

        return ollamaModel?.id ?? availableModels[0]?.id ?? "";
      });

      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load available models."
      );
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const fetchResults = useCallback(async () => {
    setResultsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/benchmarks/results`
      );

      if (!response.ok) {
        throw new Error("Could not retrieve benchmark history.");
      }

      const data = await response.json();
      setResults(data.results ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load benchmark results."
      );
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
    fetchResults();
  }, [fetchModels, fetchResults]);

  const runBenchmark = async () => {
    if (!prompt.trim()) {
      setError("Enter a prompt before running the benchmark.");
      return;
    }

    if (!model) {
      setError("Select an available model first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/benchmarks/run`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            prompt: prompt.trim(),
            model,
            repeat,
          }),
        }
      );

      const data: BenchmarkResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          "detail" in data
            ? String(data.detail)
            : "Benchmark execution failed."
        );
      }

      setResults((previous) => [
        ...data.results,
        ...previous,
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while running the benchmark."
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedModel = models.find(
    (item) => item.id === model
  );

  const successfulResults = useMemo(
    () => results.filter((item) => item.success),
    [results]
  );

  const averageLatency =
    successfulResults.length > 0
      ? successfulResults.reduce(
          (sum, item) => sum + (item.latency_ms ?? 0),
          0
        ) / successfulResults.length
      : 0;

  const averageThroughput =
    successfulResults.filter(
      (item) => item.tokens_per_second != null
    );

  const throughputValue =
    averageThroughput.length > 0
      ? averageThroughput.reduce(
          (sum, item) => sum + (item.tokens_per_second ?? 0),
          0
        ) / averageThroughput.length
      : 0;

  const formatTime = (value: number | null) => {
    if (value === null || value === undefined) return "N/A";
    return `${value.toFixed(2)} ms`;
  };

  const formatTokens = (value: number | null) => {
    if (value === null || value === undefined) return "N/A";
    return value.toLocaleString();
  };

  const formatThroughput = (value: number | null) => {
    if (value === null || value === undefined) return "N/A";
    return `${value.toFixed(2)} tok/s`;
  };

  return (
    <AppShell
      eyebrow="MODEL EVALUATION"
      title="Benchmark Runner"
      description="Configure experiments, execute model benchmarks and analyse performance."
      actions={
        <button
          onClick={() => {
            fetchModels();
            fetchResults();
          }}
          disabled={modelsLoading || resultsLoading}
          className="secondary-button"
        >
          <RefreshCw
            size={14}
            className={
              modelsLoading || resultsLoading
                ? "animate-spin"
                : ""
            }
          />
          Refresh data
        </button>
      }
    >
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Benchmark configuration and overview */}

      <section className="grid items-stretch gap-4 lg:grid-cols-[1.25fr_0.85fr]">
        <div className="glass-panel p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="metric-icon tone-violet">
              <Terminal size={18} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Configure benchmark
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Define your experiment parameters.
              </p>
            </div>
          </div>

          <label className="mb-2 block text-xs font-medium text-slate-300">
            Input prompt
          </label>

          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={6}
            maxLength={10000}
            placeholder="Enter the prompt you want to evaluate..."
            className="w-full resize-y rounded-xl border border-white/10 bg-[#0b1020]/80 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10"
          />

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-300">
                Select model
              </label>

              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={modelsLoading || models.length === 0}
                className="w-full rounded-xl border border-white/10 bg-[#151827] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-violet-400/50 disabled:opacity-50"
              >
                {modelsLoading && (
                  <option value="">Loading models...</option>
                )}

                {!modelsLoading && models.length === 0 && (
                  <option value="">No models available</option>
                )}

                {models.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.provider})
                  </option>
                ))}
              </select>

              <p className="mt-2 text-[10px] text-slate-500">
                {models.length} discovered models
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-300">
                Number of repetitions
              </label>

              <select
                value={repeat}
                onChange={(event) =>
                  setRepeat(Number(event.target.value))
                }
                className="w-full rounded-xl border border-white/10 bg-[#151827] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-violet-400/50"
              >
                {[1, 2, 3, 5, 10].map((number) => (
                  <option key={number} value={number}>
                    {number} {number === 1 ? "run" : "runs"}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-[10px] text-slate-500">
                Maximum 10 repetitions per request
              </p>
            </div>
          </div>

          <button
            onClick={runBenchmark}
            disabled={
              loading ||
              modelsLoading ||
              !model ||
              !prompt.trim()
            }
            className="primary-button mt-7 w-full py-3.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Running experiment...
              </>
            ) : (
              <>
                <Play size={16} />
                Run benchmark
              </>
            )}
          </button>

          <p className="mt-3 text-center text-[10px] text-slate-500">
            {repeat} execution{repeat === 1 ? "" : "s"} will be performed
            against {selectedModel?.name ?? "the selected model"}.
          </p>
        </div>

        {/* Experiment overview */}

        <div className="flex flex-col gap-4">
          <div className="glass-panel p-5">
            <div className="panel-heading">
              <div>
                <div className="title-with-icon">
                  <Cpu size={17} />
                  <h2>Selected model</h2>
                </div>
                <p>Active provider configuration.</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Model
              </p>

              <p className="mt-2 break-all text-base font-semibold text-slate-100">
                {selectedModel?.name ?? "No model selected"}
              </p>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Provider
                </span>
                <span className="text-xs font-medium text-violet-300">
                  {selectedModel?.provider ?? "N/A"}
                </span>
              </div>

              {selectedModel?.parameter_size && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Parameters
                  </span>
                  <span className="text-xs text-slate-300">
                    {selectedModel.parameter_size}
                  </span>
                </div>
              )}

              {selectedModel?.quantization_level && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Quantization
                  </span>
                  <span className="text-xs text-slate-300">
                    {selectedModel.quantization_level}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs">
              <span
                className={`status-dot ${
                  selectedModel?.configured ? "online" : "offline"
                }`}
              />
              <span className="text-slate-400">
                {selectedModel?.configured
                  ? "Provider available"
                  : "Provider unavailable"}
              </span>
            </div>
          </div>

          <div className="glass-panel p-5">
            <div className="title-with-icon">
              <Activity size={17} />
              <h2>Experiment statistics</h2>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniMetric
                label="Total executions"
                value={results.length.toString()}
              />

              <MiniMetric
                label="Successful"
                value={successfulResults.length.toString()}
              />

              <MiniMetric
                label="Average latency"
                value={
                  successfulResults.length
                    ? `${averageLatency.toFixed(0)} ms`
                    : "N/A"
                }
              />

              <MiniMetric
                label="Average throughput"
                value={
                  averageThroughput.length
                    ? `${throughputValue.toFixed(1)} tok/s`
                    : "N/A"
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* Execution history */}

      <section className="quick-section">
        <div className="quick-heading">
          <div>
            <p className="eyebrow">EXPERIMENT DATA</p>
            <h2>Execution history</h2>
            <p className="mt-1 text-xs text-slate-500">
              Individual responses and performance measurements.
            </p>
          </div>

          <span>
            <Activity size={13} />
            {results.length} recorded runs
          </span>
        </div>

        {resultsLoading ? (
          <div className="glass-panel empty-activity">
            <RefreshCw
              size={22}
              className="animate-spin text-violet-300"
            />
            <strong>Loading benchmark history...</strong>
          </div>
        ) : results.length === 0 ? (
          <div className="glass-panel empty-activity">
            <div className="empty-orbit">
              <Activity size={22} />
            </div>

            <strong>No benchmark results yet</strong>

            <p>
              Run your first experiment to start building your model
              performance history.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {[...results].reverse().map((result) => (
              <article
                key={result.id}
                className="glass-panel overflow-hidden p-5 transition hover:border-violet-400/25"
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-violet-400/15 bg-violet-400/10 p-2 text-violet-300">
                      <Cpu size={17} />
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        {result.model}
                      </h3>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {result.provider} · Run {result.run_number}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500">
                      {new Date(result.created_at).toLocaleString()}
                    </span>

                    <span
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] ${
                        result.success
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                          : "border-red-400/20 bg-red-400/10 text-red-300"
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <AlertCircle size={12} />
                      )}
                      {result.success ? "Successful" : "Failed"}
                    </span>
                  </div>
                </div>

                {result.success ? (
                  <>
                    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                      <Metric
                        label="Latency"
                        value={formatTime(result.latency_ms)}
                      />

                      <Metric
                        label="Throughput"
                        value={formatThroughput(
                          result.tokens_per_second
                        )}
                      />

                      <Metric
                        label="Input tokens"
                        value={formatTokens(result.input_tokens)}
                      />

                      <Metric
                        label="Output tokens"
                        value={formatTokens(result.output_tokens)}
                      />

                      <Metric
                        label="Generation time"
                        value={formatTime(
                          result.generation_duration_ms
                        )}
                      />

                      <Metric
                        label="Model load"
                        value={formatTime(result.load_duration_ms)}
                      />

                      <Metric
                        label="Prompt evaluation"
                        value={formatTime(
                          result.prompt_eval_duration_ms
                        )}
                      />

                      <Metric
                        label="Total duration"
                        value={formatTime(
                          result.total_duration_ms
                        )}
                      />

                      <Metric
                        label="Output words"
                        value={formatTokens(result.output_words)}
                      />

                      <Metric
                        label="Time to first token"
                        value={formatTime(
                          result.time_to_first_token_ms
                        )}
                      />
                    </div>
                  </>
                ) : (
                  <div className="mb-4 rounded-xl border border-red-400/15 bg-red-400/5 p-4 text-xs text-red-300">
                    {result.error ?? "Unknown benchmark error."}
                  </div>
                )}

                <div className="border-t border-white/5 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Prompt
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-300">
                    {result.prompt}
                  </p>

                  {result.response && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs font-medium text-violet-300 transition hover:text-violet-200">
                        View model response
                      </summary>

                      <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-4">
                        <p className="whitespace-pre-wrap text-xs leading-6 text-slate-300">
                          {result.response}
                        </p>
                      </div>
                    </details>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-center text-[10px] text-slate-500">
        <Server size={13} />
        Benchmark results are currently stored in backend memory and reset
        when FastAPI restarts.
        <Zap size={13} className="text-violet-300" />
        Streaming TTFT measurement is not implemented yet.
      </div>
    </AppShell>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold tabular-nums text-slate-100">
        {value}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold tabular-nums text-slate-200">
        {value}
      </p>
    </div>
  );
}
