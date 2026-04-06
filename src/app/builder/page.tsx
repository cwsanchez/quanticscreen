'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_WEIGHTS,
  DEFAULT_LOGIC,
  PRESETS,
  DEFAULT_METRICS,
  FLAG_NAMES,
  NEGATIVE_FLAGS,
  processStock,
  formatLarge,
  getFloat,
} from '@/lib/processor';
import type { ScoringWeights, LogicConfig, ProcessedResult, ProcessorConfig, StockMetrics } from '@/types';
import {
  Save,
  Play,
  Download,
  Upload,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const ALL_METRICS = [
  'P/E', 'ROE', 'D/E', 'P/B', 'PEG',
  'Gross Margin', 'Net Profit Margin',
  'FCF % EV TTM', 'EBITDA % EV TTM',
  'Beta', 'Dividend Yield', 'Average Volume',
  'RSI', 'Revenue Growth', 'Earnings Growth', 'Forward P/E',
];

export default function BuilderPage() {
  const [configName, setConfigName] = useState('MyConfig');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([...DEFAULT_METRICS]);
  const [weights, setWeights] = useState<ScoringWeights>({ ...DEFAULT_WEIGHTS });
  const [logic, setLogic] = useState<LogicConfig>(
    JSON.parse(JSON.stringify(DEFAULT_LOGIC))
  );
  const [previewResults, setPreviewResults] = useState<ProcessedResult[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const totalWeight = selectedMetrics.reduce((sum, m) => sum + (weights[m] ?? 0), 0);

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
    );
    if (!weights[metric]) {
      setWeights((prev) => ({ ...prev, [metric]: 0.1 }));
    }
  };

  const updateWeight = (metric: string, value: number) => {
    setWeights((prev) => ({ ...prev, [metric]: Math.round(value * 100) / 100 }));
  };

  const updateFlagEnabled = (flag: string, enabled: boolean) => {
    setLogic((prev) => ({
      ...prev,
      [flag]: { ...prev[flag], enabled },
    }));
  };

  const updateFlagBoost = (flag: string, boost: number) => {
    setLogic((prev) => ({
      ...prev,
      [flag]: { ...prev[flag], boost },
    }));
  };

  const loadPreset = (presetName: string) => {
    setWeights({ ...DEFAULT_WEIGHTS });
    setSelectedMetrics([...DEFAULT_METRICS]);
    const presetLogic = PRESETS[presetName];
    if (presetLogic) {
      setLogic(JSON.parse(JSON.stringify(presetLogic)));
    }
    setConfigName(presetName);
    toast.success(`Loaded ${presetName} preset`);
  };

  const resetToDefaults = () => {
    setWeights({ ...DEFAULT_WEIGHTS });
    setSelectedMetrics([...DEFAULT_METRICS]);
    setLogic(JSON.parse(JSON.stringify(DEFAULT_LOGIC)));
    setConfigName('MyConfig');
    toast.success('Reset to defaults');
  };

  const runPreview = useCallback(async () => {
    setIsPreviewLoading(true);
    try {
      const res = await fetch('/api/stocks/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights, metrics: selectedMetrics, logic }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewResults(data.results.slice(0, 20));
        toast.success(`Preview ready: ${data.results.length} stocks scored`);
      }
    } catch {
      toast.error('Preview failed');
    } finally {
      setIsPreviewLoading(false);
    }
  }, [weights, selectedMetrics, logic]);

  const exportConfig = () => {
    const config: ProcessorConfig = { weights, metrics: selectedMetrics, logic };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${configName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Config exported');
  };

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target?.result as string) as ProcessorConfig;
        if (config.weights) setWeights(config.weights);
        if (config.metrics) setSelectedMetrics(config.metrics);
        if (config.logic) setLogic(config.logic);
        toast.success('Config imported');
      } catch {
        toast.error('Invalid config file');
      }
    };
    reader.readAsText(file);
  };

  const saveToLocal = () => {
    const config: ProcessorConfig = { weights, metrics: selectedMetrics, logic };
    const saved = JSON.parse(localStorage.getItem('quanticscreen_configs') ?? '{}');
    saved[configName] = config;
    localStorage.setItem('quanticscreen_configs', JSON.stringify(saved));
    toast.success(`Saved "${configName}" locally`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Custom Logic Builder</h1>
          <p className="text-sm text-muted-foreground">
            Build custom scoring strategies with configurable metrics, weights, and flags
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={exportConfig}>
            <Download className="mr-1 h-3 w-3" />
            Export
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="mr-1 h-3 w-3" />
                Import
              </span>
            </Button>
            <input type="file" accept=".json" className="hidden" onChange={importConfig} />
          </label>
          <Button size="sm" onClick={saveToLocal}>
            <Save className="mr-1 h-3 w-3" />
            Save
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Load preset:</Label>
        {Object.keys(PRESETS).map((p) => (
          <Button key={p} variant="outline" size="sm" className="text-xs" onClick={() => loadPreset(p)}>
            {p}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Label className="shrink-0">Config Name</Label>
        <Input
          value={configName}
          onChange={(e) => setConfigName(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">Metrics & Weights</TabsTrigger>
          <TabsTrigger value="flags">Flag Logic</TabsTrigger>
          <TabsTrigger value="preview">Preview Results</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <Card className="border-border/30 bg-card/50">
            <CardHeader>
              <CardTitle className="text-base">Select Metrics</CardTitle>
              <CardDescription>Choose which metrics to include in scoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {ALL_METRICS.map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleMetric(m)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      selectedMetrics.includes(m)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/50">
            <CardHeader>
              <CardTitle className="text-base">Adjust Weights</CardTitle>
              <CardDescription>
                Weights range 0.0–0.3. Sum:{' '}
                <span className={totalWeight > 1.05 || totalWeight < 0.85 ? 'text-amber-400' : 'text-primary'}>
                  {totalWeight.toFixed(2)}
                </span>{' '}
                (ideal ~1.0)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedMetrics.map((m) => (
                <div key={m} className="grid grid-cols-[1fr,2fr,60px] items-center gap-3">
                  <Label className="text-sm">{m}</Label>
                  <Slider
                    min={0}
                    max={0.3}
                    step={0.01}
                    value={[weights[m] ?? 0.1]}
                    onValueChange={([v]) => updateWeight(m, v)}
                  />
                  <span className="text-right text-sm tabular-nums text-muted-foreground">
                    {(weights[m] ?? 0.1).toFixed(2)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags" className="space-y-4">
          <Card className="border-border/30 bg-card/50">
            <CardHeader>
              <CardTitle className="text-base">Flag Logic Configuration</CardTitle>
              <CardDescription>
                Enable/disable flags and adjust boost percentages. Positive boosts increase score, negative boosts decrease it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {FLAG_NAMES.map((flag) => {
                const conf = logic[flag] ?? { enabled: true, boost: 0 };
                const isNeg = NEGATIVE_FLAGS.has(flag);
                return (
                  <div key={flag} className="space-y-2 rounded-lg border border-border/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={conf.enabled}
                          onCheckedChange={(v) => updateFlagEnabled(flag, v)}
                        />
                        <span className="font-medium">{flag}</span>
                        {isNeg && <Badge variant="destructive" className="text-[10px]">Risk</Badge>}
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${conf.boost > 0 ? 'text-emerald-400' : conf.boost < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {conf.boost > 0 ? '+' : ''}{conf.boost}%
                      </span>
                    </div>
                    <div className="grid grid-cols-[1fr,60px] items-center gap-3">
                      <Slider
                        min={-30}
                        max={30}
                        step={1}
                        value={[conf.boost]}
                        onValueChange={([v]) => updateFlagBoost(flag, v)}
                        disabled={!conf.enabled}
                      />
                      <Input
                        type="number"
                        value={conf.boost}
                        onChange={(e) => updateFlagBoost(flag, parseInt(e.target.value) || 0)}
                        className="h-7 text-xs"
                        disabled={!conf.enabled}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={runPreview} disabled={isPreviewLoading}>
              {isPreviewLoading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1 h-4 w-4" />
              )}
              Run Preview
            </Button>
            <span className="text-sm text-muted-foreground">
              Scores all stocks with your custom config (top 20 shown)
            </span>
          </div>

          {isPreviewLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : previewResults.length > 0 ? (
            <Card className="border-border/30 bg-card/50">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ticker</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Company</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Score</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Base</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewResults.map((r, i) => (
                        <tr key={r.metrics.Ticker} className="border-b border-border/20 hover:bg-muted/20">
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold text-primary">{r.metrics.Ticker}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate">{r.metrics['Company Name']}</td>
                          <td className="px-3 py-2 font-bold tabular-nums text-primary">{r.final_score.toFixed(1)}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.base_score.toFixed(1)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {r.flags.map((f) => (
                                <Badge
                                  key={f}
                                  variant={NEGATIVE_FLAGS.has(f) ? 'destructive' : 'success'}
                                  className="text-[10px]"
                                >
                                  {f}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/30 bg-card/50">
              <CardContent className="flex items-center justify-center p-12 text-muted-foreground">
                Click &quot;Run Preview&quot; to score stocks with your custom configuration
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
