import { NextRequest, NextResponse } from 'next/server';

type RelayChannel = 'instagram' | 'facebook_page';
type RelayStatus = 'scheduled' | 'published' | 'failed';

type RelayResult = {
  channel: RelayChannel;
  job_id: string;
  status: RelayStatus;
  message: string;
};

type RelayFormatterResponse = {
  ok: boolean;
  results: RelayResult[];
};

type RelayJobInput = {
  channel?: string;
  job_id?: string;
  status?: string;
  success?: boolean;
  published?: boolean;
  scheduled?: boolean;
  error?: string;
  message?: string;
};

const ALLOWED_CHANNELS: RelayChannel[] = ['instagram', 'facebook_page'];
const KNOWN_ERROR_MESSAGES = ['account_not_connected', 'token_expired', 'no_media'];

const toChannel = (value: string | undefined): RelayChannel =>
  ALLOWED_CHANNELS.includes(value as RelayChannel) ? (value as RelayChannel) : 'instagram';

const normalizeErrorMessage = (value: string | undefined) => {
  if (!value) return 'unknown_error';
  const normalized = value.toLowerCase().trim().replace(/\s+/g, '_');

  if (KNOWN_ERROR_MESSAGES.includes(normalized)) return normalized;

  return normalized.slice(0, 80) || 'unknown_error';
};

const resolveStatus = (job: RelayJobInput): RelayStatus => {
  if (job.status === 'scheduled' || job.status === 'published' || job.status === 'failed') {
    return job.status;
  }

  if (job.published === true) return 'published';
  if (job.scheduled === true || job.success === true) return 'scheduled';
  return 'failed';
};

const toRelayResult = (job: RelayJobInput): RelayResult => {
  const status = resolveStatus(job);

  if (status === 'failed') {
    return {
      channel: toChannel(job.channel),
      job_id: String(job.job_id ?? ''),
      status,
      message: normalizeErrorMessage(job.error ?? job.message)
    };
  }

  return {
    channel: toChannel(job.channel),
    job_id: String(job.job_id ?? ''),
    status,
    message: status === 'published' ? 'published' : 'scheduled'
  };
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { jobs?: RelayJobInput[] } | RelayJobInput[] | null;

  const jobs = Array.isArray(body) ? body : body?.jobs;

  if (!jobs?.length) {
    const emptyResponse: RelayFormatterResponse = { ok: false, results: [] };
    return NextResponse.json(emptyResponse);
  }

  const results = jobs.map(toRelayResult);
  const ok = results.some((result) => result.status === 'scheduled' || result.status === 'published');

  return NextResponse.json({ ok, results } satisfies RelayFormatterResponse);
}
