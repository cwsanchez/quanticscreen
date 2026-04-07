'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PRESETS,
  DEFAULT_WEIGHTS,
  DEFAULT_LOGIC,
  FLAG_NAMES,
  NEGATIVE_FLAGS,
} from '@/lib/processor';
import type { ProcessorConfig, LogicConfig } from '@/types';
import {
  Download,
  Upload,
  Trash2,
  BookOpen,
  Users,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

function PresetCard({
  name,
  logic,
  isBuiltIn,
  onUse,
  onExport,
  onDelete,
}: {
  name: string;
  logic: LogicConfig;
  isBuiltIn: boolean;
  onUse: () => void;
  onExport: () => void;
  onDelete?: () => void;
}) {
  return (
    <Card className="border-border/30 bg-card/50 transition-all hover:border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{name}</CardTitle>
          {isBuiltIn && (
            <Badge variant="secondary" className="text-[10px]">
              <Star className="mr-0.5 h-2.5 w-2.5" /> Built-in
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {FLAG_NAMES.map((flag) => {
            const conf = logic[flag];
            if (!conf) return null;
            return (
              <Badge
                key={flag}
                variant={
                  conf.boost > 0 ? 'success' : conf.boost < 0 ? 'destructive' : 'outline'
                }
                className="text-[10px]"
              >
                {flag} {conf.boost > 0 ? '+' : ''}{conf.boost}%
              </Badge>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={onUse} className="flex-1">
            Use in Screener
          </Button>
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="h-3 w-3" />
          </Button>
          {!isBuiltIn && onDelete && (
            <Button size="sm" variant="outline" onClick={onDelete}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PresetsPage() {
  const router = useRouter();
  const [savedConfigs, setSavedConfigs] = useState<Record<string, ProcessorConfig>>(() => {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem('quanticscreen_configs');
    if (stored) {
      try { return JSON.parse(stored); } catch { /* ignore */ }
    }
    return {};
  });

  const exportConfig = (name: string, config: ProcessorConfig | { logic: LogicConfig }) => {
    const full: ProcessorConfig = {
      weights: (config as ProcessorConfig).weights ?? DEFAULT_WEIGHTS,
      metrics: (config as ProcessorConfig).metrics ?? Object.keys(DEFAULT_WEIGHTS),
      logic: config.logic,
    };
    const blob = new Blob([JSON.stringify(full, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${name}`);
  };

  const deleteConfig = (name: string) => {
    const updated = { ...savedConfigs };
    delete updated[name];
    setSavedConfigs(updated);
    localStorage.setItem('quanticscreen_configs', JSON.stringify(updated));
    toast.success(`Deleted ${name}`);
  };

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target?.result as string) as ProcessorConfig;
        const name = file.name.replace('.json', '');
        const updated = { ...savedConfigs, [name]: config };
        setSavedConfigs(updated);
        localStorage.setItem('quanticscreen_configs', JSON.stringify(updated));
        toast.success(`Imported "${name}"`);
      } catch {
        toast.error('Invalid config file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Preset Strategies</h1>
          <p className="text-sm text-muted-foreground">
            Built-in and custom scoring configurations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="mr-1 h-3 w-3" />
                Import JSON
              </span>
            </Button>
            <input type="file" accept=".json" className="hidden" onChange={importConfig} />
          </label>
          <Button size="sm" onClick={() => router.push('/builder')}>
            Create New
          </Button>
        </div>
      </div>

      <Tabs defaultValue="builtin">
        <TabsList>
          <TabsTrigger value="builtin" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Built-in ({Object.keys(PRESETS).length})
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-1.5">
            <Star className="h-3.5 w-3.5" />
            Saved ({Object.keys(savedConfigs).length})
          </TabsTrigger>
          <TabsTrigger value="community" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Community
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builtin">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(PRESETS).map(([name, logic]) => (
              <PresetCard
                key={name}
                name={name}
                logic={logic}
                isBuiltIn
                onUse={() => router.push(`/screener?preset=${name}`)}
                onExport={() => exportConfig(name, { logic })}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="saved">
          {Object.keys(savedConfigs).length === 0 ? (
            <Card className="border-border/30 bg-card/50">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <Star className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">No saved configurations yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create one in the Builder or import a JSON file.
                </p>
                <Button className="mt-4" onClick={() => router.push('/builder')}>
                  Open Builder
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(savedConfigs).map(([name, config]) => (
                <PresetCard
                  key={name}
                  name={name}
                  logic={config.logic}
                  isBuiltIn={false}
                  onUse={() => router.push(`/screener?preset=${name}`)}
                  onExport={() => exportConfig(name, config)}
                  onDelete={() => deleteConfig(name)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="community">
          <Card className="border-border/30 bg-card/50">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Users className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Community Presets Coming Soon</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Share and discover scoring strategies from other users.
                This feature requires authentication.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
