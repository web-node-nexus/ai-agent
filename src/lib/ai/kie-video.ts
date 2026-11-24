/**
 * Kie.ai Wan 3.0 video generation (server-only).
 * Docs: https://docs.kie.ai/market/wan/3-0-video
 */

const KIE_BASE = "https://api.kie.ai";

export type KieVideoResult = {
  taskId: string;
  videoUrl: string;
  model: string;
  durationSec: number;
  resolution: string;
  costTimeSec?: number;
};

export function isKieConfigured(): boolean {
  return Boolean(process.env.KIE_API_KEY?.trim());
}

function apiKey(): string {
  const key = process.env.KIE_API_KEY?.trim();
  if (!key) throw new Error("KIE_API_KEY missing");
  return key;
}

function modelId(): string {
  return process.env.KIE_VIDEO_MODEL?.trim() || "wan/3-0-video";
}

function defaultResolution(): string {
  return process.env.KIE_VIDEO_RESOLUTION?.trim() || "720P";
}

function defaultDuration(): number {
  const n = Number(process.env.KIE_VIDEO_DURATION || "5");
  if (!Number.isFinite(n)) return 5;
  return Math.min(30, Math.max(2, Math.round(n)));
}

type KieEnvelope<T> = {
  code?: number;
  msg?: string;
  data?: T;
};

async function kieFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${KIE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as KieEnvelope<T>;
  const code = json.code ?? res.status;
  if (!res.ok || (typeof code === "number" && code !== 200)) {
    throw new Error(
      `Kie ${code}: ${json.msg || res.statusText || "request failed"}`
    );
  }
  if (json.data === undefined || json.data === null) {
    throw new Error(`Kie ${path}: empty data`);
  }
  return json.data;
}

export async function createKieVideoTask(params: {
  prompt: string;
  /** Character cover / selfie as first frame (image-to-video). */
  firstFrameUrl?: string | null;
  /** Identity refs (all-purpose mode). Mutually exclusive with firstFrameUrl. */
  referenceImageUrls?: string[];
  durationSec?: number;
  resolution?: "480P" | "720P" | "1080P";
  aspectRatio?: "adaptive" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
  audio?: boolean;
  callBackUrl?: string;
}): Promise<{ taskId: string }> {
  const prompt = params.prompt.trim();
  if (prompt.length < 3) throw new Error("Video prompt too short");

  const input: Record<string, unknown> = {
    prompt,
    resolution: params.resolution || defaultResolution(),
    aspect_ratio: params.aspectRatio || "9:16",
    duration: params.durationSec ?? defaultDuration(),
    audio: params.audio ?? true,
    nsfw_checker: true,
  };

  if (params.firstFrameUrl) {
    input.first_frame_url = params.firstFrameUrl;
  } else if (params.referenceImageUrls?.length) {
    input.reference_image_urls = params.referenceImageUrls.slice(0, 5);
  }

  const data = await kieFetch<{ taskId: string }>("/api/v1/jobs/createTask", {
    method: "POST",
    body: JSON.stringify({
      model: modelId(),
      ...(params.callBackUrl ? { callBackUrl: params.callBackUrl } : {}),
      input,
    }),
  });

  if (!data.taskId) throw new Error("Kie createTask: no taskId");
  return { taskId: data.taskId };
}

export async function getKieTask(taskId: string): Promise<{
  taskId: string;
  model?: string;
  state: string;
  resultUrls: string[];
  failMsg?: string;
  costTime?: number;
}> {
  const data = await kieFetch<{
    taskId: string;
    model?: string;
    state: string;
    resultJson?: string | null;
    failMsg?: string | null;
    costTime?: number;
  }>(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);

  let resultUrls: string[] = [];
  if (data.resultJson) {
    try {
      const parsed = JSON.parse(data.resultJson) as { resultUrls?: string[] };
      resultUrls = Array.isArray(parsed.resultUrls) ? parsed.resultUrls : [];
    } catch {
      resultUrls = [];
    }
  }

  return {
    taskId: data.taskId,
    model: data.model,
    state: data.state,
    resultUrls,
    failMsg: data.failMsg || undefined,
    costTime: data.costTime,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Create + poll until success/fail.
 * Video jobs can take 1–3+ minutes — use callBackUrl in production when possible.
 */
export async function generateKieVideo(params: {
  prompt: string;
  firstFrameUrl?: string | null;
  referenceImageUrls?: string[];
  durationSec?: number;
  resolution?: "480P" | "720P" | "1080P";
  aspectRatio?: "adaptive" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
  audio?: boolean;
  /** Max wait before giving up (default 4 min). */
  timeoutMs?: number;
}): Promise<KieVideoResult> {
  const { taskId } = await createKieVideoTask(params);
  const timeoutMs = params.timeoutMs ?? 240_000;
  const started = Date.now();
  let delay = 2500;

  while (Date.now() - started < timeoutMs) {
    await sleep(delay);
    const info = await getKieTask(taskId);

    if (info.state === "success") {
      const videoUrl = info.resultUrls[0];
      if (!videoUrl) throw new Error("Kie success but no video URL");
      return {
        taskId,
        videoUrl,
        model: info.model || modelId(),
        durationSec: params.durationSec ?? defaultDuration(),
        resolution: params.resolution || defaultResolution(),
        costTimeSec: info.costTime,
      };
    }

    if (info.state === "fail") {
      throw new Error(info.failMsg || "Kie video generation failed");
    }

    delay = Math.min(12_000, Math.round(delay * 1.25));
  }

  throw new Error(`Kie video timed out (taskId=${taskId})`);
}
