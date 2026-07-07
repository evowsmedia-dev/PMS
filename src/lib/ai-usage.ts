import type { LanguageModelUsage } from "ai";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const PRICE_BY_MODEL: Record<string, { input: number; output: number }> = {
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
};

export function getAiTokenRates(model: string) {
  return PRICE_BY_MODEL[model] ?? { input: 0, output: 0 };
}

export function calculateAiCostUsd({
  inputTokens,
  outputTokens,
  model,
}: {
  inputTokens: number;
  outputTokens: number;
  model: string;
}) {
  const rates = getAiTokenRates(model);
  return {
    inputRateUsdPerMillion: rates.input,
    outputRateUsdPerMillion: rates.output,
    costUsd: (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000,
  };
}

export async function logAiUsage({
  userId,
  projectId,
  operation,
  model,
  usage,
  metadata,
}: {
  userId: string;
  projectId?: string | null;
  operation: string;
  model: string;
  usage: LanguageModelUsage;
  metadata?: Record<string, unknown>;
}) {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;
  const cost = calculateAiCostUsd({ inputTokens, outputTokens, model });

  await prisma.aiUsageLog.create({
    data: {
      userId,
      projectId: projectId || null,
      operation,
      provider: "openai",
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      inputRateUsdPerMillion: cost.inputRateUsdPerMillion.toFixed(4),
      outputRateUsdPerMillion: cost.outputRateUsdPerMillion.toFixed(4),
      costUsd: cost.costUsd.toFixed(6),
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}
