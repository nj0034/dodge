export const MAX_NICKNAME_LENGTH = 16;
export const MAX_SURVIVAL_MS = 3_600_000;

export type Score = {
  nickname: string;
  survivalMs: number;
  createdAt: string;
};

export type ScoreSubmission = {
  nickname: unknown;
  survivalMs: unknown;
};

export type ScoreValidationResult =
  | { ok: true; nickname: string; survivalMs: number }
  | { ok: false; message: string };

export function normalizeNickname(value: unknown): string {
  return String(value ?? '').trim().slice(0, MAX_NICKNAME_LENGTH);
}

export function validateScoreSubmission(input: ScoreSubmission): ScoreValidationResult {
  const nickname = normalizeNickname(input.nickname);
  const survivalMs = Number(input.survivalMs);

  if (!nickname) return { ok: false, message: '닉네임을 입력해주세요.' };
  if (!Number.isInteger(survivalMs) || survivalMs <= 0) return { ok: false, message: '점수가 올바르지 않습니다.' };
  if (survivalMs > MAX_SURVIVAL_MS) return { ok: false, message: '점수가 허용 범위를 벗어났습니다.' };
  return { ok: true, nickname, survivalMs };
}
