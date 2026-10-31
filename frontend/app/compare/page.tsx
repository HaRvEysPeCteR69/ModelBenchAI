
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Cpu,
  Play,
  RefreshCw,
  Server,
  Sparkles,
  Zap,
} from "lucide-react";

import AppShell from "../components/AppShell";

const API_URL = "http://localhost:8000";

type Model = {
  id: string;
  name: string;
  provider: string;
  configured: boolean;
  parameter_size?: string;
  size?: number;
  quantization_level?: string;
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
  tokens_per_second: number | null;
  total_duration_ms: number | null;
  success: boolean;
  error?: string | null;
  created_at: string;
};

type ModelComparison = {
  model: string;
  provider: string;
  run_count: number;
  successful_runs: number;
  failed_runs: number;
  average_latency_ms: number | null;
  median_latency_ms: number | null;
  average_tokens_per_second: number | null;
  results: BenchmarkResult[];
};

type ComparisonResponse = {
  comparison_id: string;
  prompt: string;
  repeat: number;
  model_count: number;
  created_at: string;
  models: ModelComparison[];
};

export default function ComparePage() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(
    "Explain the difference between TCP and UDP in three sentences."
  );
  const [repeat, setRepeat] = useState(2);

  const [comparison, setComparison] =
    useState<ComparisonResponse | null>(null);

  const [loadingModels, setLoadingModels] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/models`);

      if (!response.ok) {
        throw new Error("Could not retrieve available models.");
      }

      const data = await response.json();
      const availableModels: Model[] = data.models ?? [];

      setModels(availableModels);

      setSelectedModels((current) => {
        const validSelections = current.filter((id) =>
          availableModels.some((item) => item.id === id)
        );

        if (validSelections.length >= 2) {
          return validSelections;
        }

        return availableModels
          .filter((item) => item.configured)
          .slice(0, 2)
          .map((item) => item.id);
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load available models."
      );
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const toggleModel = (modelId: string) => {
    setSelectedModels((current) => {
      if (current.includes(modelId)) {
        return current.filter((id) => id !== modelId);
      }

      if (current.length >= 5) {
        setError("You can compare a maximum of five models.");
        return current;
      }

      setError("");
      return [...current, modelId];
    });

    setComparison(null);
  };

  const runComparison = async () => {
    if (!prompt.trim()) {
      setError("Enter a prompt before starting the comparison.");
      return;
    }

    if (selectedModels.length < 2) {
      setError("Select at least two models to compare.");
      return;
    }

    setComparing(true);
    setError("");
    setComparison(null);

    try {
      const response = await fetch(
        `${API_URL}/api/benchmarks/compare`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            prompt: prompt.trim(),
            models: selectedModels,
            repeat,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Model comparison failed."
        );
      }

      setComparison(data as ComparisonResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong during comparison."
      );
    } finally {
      setComparing(false);
    }
  };

  const successfulModels = useMemo(
    () =>
      comparison?.models.filter(
        (item) => item.successful_runs > 0
      ) ?? [],
    [comparison]
  );

  const fastestModel = useMemo(() => {
    const valid = successfulModels.filter(
      (item) => item.average_latency_ms != null
    );

    return [...valid].sort(
      (a, b) =>
        (a.average_latency_ms ?? Infinity) -
        (b.average_latency_ms ?? Infinity)
    )[0];
  }, [successfulModels]);

  const highestThroughputModel = useMemo(() => {
    const valid = successfulModels.filter(
      (item) => item.average_tokens_per_second != null
    );

    return [...valid].sort(
      (a, b) =>
        (b.average_tokens_per_second ?? 0) -
        (a.average_tokens_per_second ?? 0)
    )[0];
  }, [successfulModels]);

  const formatLatency = (value: number | null) => {
    if (value == null) return "N/A";
    return `${value.toFixed(2)} ms`;
  };

  const formatThroughput = (value: number | null) => {
    if (value == null) return "N/A";
    return `${value.toFixed(2)} tok/s`;
  };

  const formatTokens = (value: number | null) => {
    if (value == null) return "N/A";
    return value.toLocaleString();
  };

  return (
    <AppShell
      eyebrow="PERFORMANCE ANALYTICS"
      title="Model Comparison"
      description="Compare language models under identical prompts and experiment conditions."
      actions={
        <button
          onClick={fetchModels}
          disabled={loadingModels || comparing}
          className="secondary-button"
        >
          <RefreshCw
            size={14}
            className={loadingModels ? "animate-spin" : ""}
          />
          Refresh models
        </button>
      }
    >
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Configuration */}

      <section className="glass-panel p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="metric-icon tone-violet">
            <BarChart3 size={18} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Configure comparison
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Select models and define a shared evaluation prompt.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">
              Select models
            </label>

            <span className="text-[10px] text-slate-500">
              {selectedModels.length}/5 selected
            </span>
          </div>

          {loadingModels ? (
            <div className="flex items-center gap-2 py-5 text-xs text-slate-400">
              <RefreshCw size={14} className="animate-spin" />
              Discovering available models...
            </div>
          ) : models.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-black/20 p-5 text-xs text-slate-400">
              No models discovered. Check that Ollama and the backend are running.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {models.map((model) => {
                const selected = selectedModels.includes(model.id);

                return (
                  <button
                    type="button"
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    disabled={!model.configured || comparing}
                    className={`rounded-xl border p-4 text-left transition duration-200 ${
                      selected
                        ? "border-violet-400/40 bg-violet-500/10 shadow-[0_0_25px_rgba(139,92,246,0.08)]"
                        : "border-white/5 bg-black/20 hover:border-violet-400/20 hover:bg-white/[0.03]"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`rounded-lg p-2 ${
                            selected
                              ? "bg-violet-400/15 text-violet-300"
                              : "bg-white/5 text-slate-400"
                          }`}
                        >
                          <Cpu size={17} />
                        </div>

                        <div>
                          <p className="break-all text-xs font-semibold text-slate-100">
                            {model.name}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {model.provider}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          selected
                            ? "border-violet-400 bg-violet-500 text-white"
                            : "border-white/15 text-transparent"
                        }`}
                      >
                        {selected && <CheckCircle2 size={14} />}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">
                        {model.parameter_size ?? "Model"}
                      </span>

                      <span className="flex items-center gap-1.5 text-[10px]">
                        <span
                          className={`status-dot ${
                            model.configured ? "online" : "offline"
                          }`}
                        />
                        <span className="text-slate-400">
                          {model.configured ? "Available" : "Unavailable"}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-3 text-[10px] text-slate-500">
            Select between 2 and 5 configured models.
          </p>
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium text-slate-300">
            Shared evaluation prompt
          </label>

          <textarea
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              setComparison(null);
            }}
            rows={5}
            maxLength={10000}
            placeholder="Enter the same prompt for every selected model..."
            className="w-full resize-y rounded-xl border border-white/10 bg-[#0b1020]/80 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10"
          />

          <p className="mt-2 text-right text-[10px] text-slate-500">
            {prompt.length.toLocaleString()} / 10,000 characters
          </p>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <label className="mb-2 block text-xs font-medium text-slate-300">
              Repetitions per model
            </label>

            <select
              value={repeat}
              onChange={(event) => {
                setRepeat(Number(event.target.value));
                setComparison(null);
              }}
              disabled={comparing}
              className="w-full rounded-xl border border-white/10 bg-[#151827] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-violet-400/50"
            >
              {[1, 2, 3, 5, 10].map((number) => (
                <option key={number} value={number}>
                  {number} {number === 1 ? "run" : "runs"}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500">
            <span className="font-semibold text-violet-300">
              {selectedModels.length * repeat}
            </span>{" "}
            total executions
          </div>
        </div>

        <button
          onClick={runComparison}
          disabled={
            comparing ||
            loadingModels ||
            selectedModels.length < 2 ||
            !prompt.trim()
          }
          className="primary-button mt-6 w-full py-3.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {comparing ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Comparing models...
            </>
          ) : (
            <>
              <Play size={16} />
              Run model comparison
            </>
          )}
        </button>

        <p className="mt-3 text-center text-[10px] text-slate-500">
          Each model receives the same prompt and repetition count.
        </p>
      </section>

      {/* Results */}

      {comparison && (
        <section className="quick-section">
          <div className="quick-heading">
            <div>
              <p className="eyebrow">COMPARISON RESULTS</p>
              <h2>Performance breakdown</h2>
              <p className="mt-1 text-xs text-slate-500">
                Comparison ID: {comparison.comparison_id}
              </p>
            </div>

            <span>
              <Activity size={13} />
              {comparison.model_count} models
            </span>
          </div>

          {/* Highlights */}

          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Zap size={15} className="text-violet-300" />
                Lowest average latency
              </div>

              <p className="mt-3 break-all text-base font-semibold text-slate-100">
                {fastestModel?.model ?? "N/A"}
              </p>

              <p className="mt-1 text-xs text-violet-300">
                {fastestModel
                  ? formatLatency(fastestModel.average_latency_ms)
                  : "No successful measurements"}
              </p>
            </div>

            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Activity size={15} className="text-violet-300" />
                Highest average throughput
              </div>

              <p className="mt-3 break-all text-base font-semibold text-slate-100">
                {highestThroughputModel?.model ?? "N/A"}
              </p>

              <p className="mt-1 text-xs text-violet-300">
                {highestThroughputModel
                  ? formatThroughput(
                      highestThroughputModel.average_tokens_per_second
                    )
                  : "No throughput measurements"}
              </p>
            </div>
          </div>

          {/* Model cards */}

          <div className="grid gap-4 xl:grid-cols-2">
            {comparison.models.map((item) => (
              <article
                key={item.model}
                className="glass-panel overflow-hidden p-5"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-violet-400/15 bg-violet-400/10 p-2 text-violet-300">
                      <Cpu size={18} />
                    </div>

                    <div>
                      <h3 className="break-all text-sm font-semibold text-slate-100">
                        {item.model}
                      </h3>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {item.provider}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] ${
                      item.failed_runs === 0
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                        : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                    }`}
                  >
                    {item.successful_runs}/{item.run_count} successful
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ResultMetric
                    label="Average latency"
                    value={formatLatency(item.average_latency_ms)}
                  />

                  <ResultMetric
                    label="Median latency"
                    value={formatLatency(item.median_latency_ms)}
                  />

                  <ResultMetric
                    label="Throughput"
                    value={formatThroughput(
                      item.average_tokens_per_second
                    )}
                  />

                  <ResultMetric
                    label="Successful runs"
                    value={`${item.successful_runs}/${item.run_count}`}
                  />
                </div>

                {item.failed_runs > 0 && (
                  <div className="mt-4 rounded-lg border border-red-400/15 bg-red-400/5 p-3 text-xs text-red-300">
                    {item.failed_runs} execution(s) failed.
                  </div>
                )}

                <div className="mt-5 border-t border-white/5 pt-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Individual executions
                  </p>

                  <div className="space-y-2">
                    {item.results.map((result) => (
                      <details
                        key={result.id}
                        className="rounded-lg border border-white/5 bg-black/20 p-3"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs">
                          <span className="text-slate-300">
                            Run {result.run_number}
                          </span>

                          <span
                            className={
                              result.success
                                ? "text-emerald-300"
                                : "text-red-300"
                            }
                          >
                            {result.success ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                Successful
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <AlertCircle size={12} />
                                Failed
                              </span>
                            )}
                          </span>
                        </summary>

                        {result.success ? (
                          <div className="mt-4 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <SmallMetric
                                label="Latency"
                                value={formatLatency(result.latency_ms)}
                              />
                              <SmallMetric
                                label="Throughput"
                                value={formatThroughput(
                                  result.tokens_per_second
                                )}
                              />
                              <SmallMetric
                                label="Input tokens"
                                value={formatTokens(result.input_tokens)}
                              />
                              <SmallMetric
                                label="Output tokens"
                                value={formatTokens(result.output_tokens)}
                              />
                            </div>

                            <div>
                              <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                                Model response
                              </p>

                              <p className="whitespace-pre-wrap text-xs leading-6 text-slate-300">
                                {result.response ?? "No response returned."}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-red-300">
                            {result.error ?? "Unknown execution error."}
                          </p>
                        )}
                      </details>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Comparison details */}

          <div className="glass-panel mt-5 p-5">
            <div className="title-with-icon">
              <Clock3 size={16} />
              <h2>Experiment details</h2>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <SmallMetric
                label="Comparison ID"
                value={comparison.comparison_id.slice(0, 12)}
              />
              <SmallMetric
                label="Repetitions"
                value={comparison.repeat.toString()}
              />
              <SmallMetric
                label="Created"
                value={new Date(comparison.created_at).toLocaleString()}
              />
            </div>

            <div className="mt-4 border-t border-white/5 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Shared prompt
              </p>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-300">
                {comparison.prompt}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center text-[10px] text-slate-500">
            <Server size={13} />
            Measurements are generated by the model providers.
            <Sparkles size={13} className="text-violet-300" />
            Quality scoring is a separate evaluation stage.
          </div>
        </section>
      )}

      {!comparison && !comparing && (
        <section className="quick-section">
          <div className="quick-heading">
            <div>
              <p className="eyebrow">ANALYTICS WORKSPACE</p>
              <h2>Ready to compare</h2>
              <p className="mt-1 text-xs text-slate-500">
                Your comparison results will appear here.
              </p>
            </div>
          </div>

          <div className="glass-panel empty-activity">
            <div className="empty-orbit">
              <BarChart3 size={23} />
            </div>
            <strong>No comparison generated yet</strong>
            <p>
              Select at least two models, configure your prompt and start
              an experiment.
            </p>
          </div>
        </section>
      )}

      {comparing && (
        <div className="glass-panel mt-5 flex flex-col items-center gap-3 p-10 text-center">
          <RefreshCw
            size={25}
            className="animate-spin text-violet-300"
          />
          <strong className="text-sm text-slate-100">
            Running model comparison
          </strong>
          <p className="max-w-md text-xs leading-6 text-slate-500">
            Models are being evaluated sequentially. Local inference can
            take some time, especially during the first model load.
          </p>
          <div className="text-xs text-violet-300">
            {selectedModels.length} models · {repeat} repetitions each
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ResultMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold tabular-nums text-slate-100">
        {value}
      </p>
    </div>
  );
}

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-1 break-all text-xs font-semibold text-slate-200">
        {value}
      </p>
    </div>
  );
}
