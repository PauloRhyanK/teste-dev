import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import {
  UploadCloud,
  FileSpreadsheet,
  Play,
  CheckCircle2,
  Loader2,
  Circle,
  Download,
  X,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Processador de Lotes PIX" },
      {
        name: "description",
        content: "Envie sua planilha para validação e liquidação via Stark Bank.",
      },
    ],
  }),
  component: Index,
});

type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
type LogEntry = { id: number; level: LogLevel; message: string; time: string };

const STEPS = [
  { id: 1, title: "Lendo e Validando Planilha" },
  { id: 2, title: "Consolidando Pagamentos" },
  { id: 3, title: "Enviando PIX via Stark Bank" },
  { id: 4, title: "Finalizado" },
] as const;

const MOCK_SCRIPT: { delay: number; step?: number; log?: Omit<LogEntry, "id" | "time"> }[] = [
  { delay: 0, step: 1, log: { level: "INFO", message: "Abrindo planilha enviada..." } },
  { delay: 500, log: { level: "INFO", message: "Lendo linha 1 — cabeçalho detectado." } },
  { delay: 500, log: { level: "INFO", message: "Lendo linha 2 — Maria Souza • R$ 1.250,00" } },
  { delay: 500, log: { level: "SUCCESS", message: "Linha 2 validada com sucesso." } },
  { delay: 500, log: { level: "INFO", message: "Lendo linha 3 — Carlos Lima • R$ 320,00" } },
  { delay: 500, log: { level: "WARNING", message: "Linha 4: CPF com dígito divergente, ignorando." } },
  { delay: 500, log: { level: "INFO", message: "Lendo linha 5 — João da Silva • R$ 1.500,00" } },
  { delay: 800, step: 2, log: { level: "INFO", message: "Consolidando 42 pagamentos por chave PIX..." } },
  { delay: 600, log: { level: "INFO", message: "Agrupados 3 pagamentos duplicados para Maria Souza." } },
  { delay: 600, log: { level: "SUCCESS", message: "Lote consolidado: 39 transações prontas." } },
  { delay: 800, step: 3, log: { level: "INFO", message: "Autenticando com Stark Bank..." } },
  { delay: 500, log: { level: "SUCCESS", message: "Sessão autenticada." } },
  { delay: 500, log: { level: "SUCCESS", message: "PIX enviado — João da Silva • R$ 1.500,00" } },
  { delay: 500, log: { level: "SUCCESS", message: "PIX enviado — Maria Souza • R$ 1.250,00" } },
  { delay: 500, log: { level: "ERROR", message: "Falha — Pedro Alves: limite diário excedido." } },
  { delay: 500, log: { level: "SUCCESS", message: "PIX enviado — Carlos Lima • R$ 320,00" } },
  { delay: 500, log: { level: "SUCCESS", message: "PIX enviado — Ana Paula • R$ 780,00" } },
  { delay: 500, log: { level: "WARNING", message: "Beatriz Rocha: chave PIX não encontrada, pulando." } },
  { delay: 500, log: { level: "SUCCESS", message: "37 pagamentos liquidados com sucesso." } },
  { delay: 600, step: 4, log: { level: "SUCCESS", message: "Processamento concluído. Relatório gerado." } },
];

function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      setError("Formato inválido. Envie um arquivo .xlsx");
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  };

  const reset = () => {
    setFile(null);
    setStarted(false);
    setCurrentStep(0);
    setLogs([]);
    setDone(false);
    setError(null);
  };

  const startProcessing = () => {
    setStarted(true);
    setCurrentStep(1);
  };

  // Mock SSE
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let acc = 0;
    MOCK_SCRIPT.forEach((event) => {
      acc += event.delay;
      timeouts.push(
        setTimeout(() => {
          if (cancelled) return;
          if (event.step) setCurrentStep(event.step);
          if (event.log) {
            logIdRef.current += 1;
            const now = new Date();
            const time = now.toTimeString().slice(0, 8);
            setLogs((prev) => [...prev, { id: logIdRef.current, time, ...event.log! }]);
          }
        }, acc),
      );
    });
    timeouts.push(
      setTimeout(() => {
        if (cancelled) return;
        setDone(true);
        confetti({
          particleCount: 140,
          spread: 80,
          origin: { y: 0.6 },
        });
      }, acc + 400),
    );
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [started]);

  // Auto scroll terminal
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const viewport = el.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [logs]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Processador de Lotes PIX
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              Envie sua planilha para validação e liquidação via Stark Bank.
            </p>
          </div>
          {started && (
            <Button variant="outline" size="sm" onClick={reset}>
              Novo lote
            </Button>
          )}
        </header>

        {/* Upload / file preview */}
        {!started && (
          <>
            {!file ? (
              <Card
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed bg-white py-20 transition",
                  dragOver
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-300 hover:border-slate-400",
                )}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <UploadCloud className="h-8 w-8 text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-slate-900">
                    Arraste sua planilha aqui
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    ou clique para selecionar — apenas arquivos .xlsx
                  </p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                {error && (
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}
              </Card>
            ) : (
              <Card className="flex items-center justify-between gap-4 bg-white p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB · Pronto para processar
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={reset} aria-label="Remover">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={startProcessing}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar Processamento
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Processing panel */}
        {started && (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Stepper */}
            <Card className="bg-white p-6 lg:col-span-2">
              <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Pipeline
              </h2>
              <ol className="space-y-5">
                {STEPS.map((s) => {
                  const state =
                    done && s.id === 4
                      ? "done"
                      : currentStep > s.id
                        ? "done"
                        : currentStep === s.id
                          ? "running"
                          : "pending";
                  return (
                    <li key={s.id} className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                          state === "done" &&
                            "border-emerald-600 bg-emerald-600 text-white",
                          state === "running" &&
                            "border-slate-900 bg-slate-900 text-white",
                          state === "pending" &&
                            "border-slate-300 bg-white text-slate-400",
                        )}
                      >
                        {state === "done" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : state === "running" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                      </div>
                      <div className="pt-0.5">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            state === "pending" ? "text-slate-400" : "text-slate-900",
                          )}
                        >
                          {s.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {state === "done"
                            ? "Concluído"
                            : state === "running"
                              ? "Em andamento..."
                              : "Aguardando"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {done && (
                <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="font-medium">Processamento concluído!</p>
                  </div>
                  <p className="mb-3 text-sm text-emerald-700">
                    Sua planilha foi processada com sucesso.
                  </p>
                  <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Planilha Processada
                  </Button>
                </div>
              )}
            </Card>

            {/* Terminal */}
            <Card className="overflow-hidden bg-slate-950 p-0 lg:col-span-3">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="ml-2 text-xs font-medium text-slate-400">
                    logs/processing.live
                  </span>
                </div>
                <span className="text-xs text-slate-500">{logs.length} eventos</span>
              </div>
              <ScrollArea ref={scrollRef} className="h-[420px]">
                <div className="space-y-1.5 p-4 font-mono text-xs">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                      <span className="shrink-0 text-slate-600">{log.time}</span>
                      <LogBadge level={log.level} />
                      <span className="text-slate-200">{log.message}</span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-slate-500">Aguardando eventos...</div>
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function LogBadge({ level }: { level: LogLevel }) {
  const map: Record<LogLevel, string> = {
    INFO: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    SUCCESS: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    WARNING: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    ERROR: "border-red-500/30 bg-red-500/10 text-red-300",
  };
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 rounded px-1.5 py-0 text-[10px] font-semibold", map[level])}
    >
      {level}
    </Badge>
  );
}
