export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T>(error: string, field?: string): ActionResult<T> {
  return { ok: false, error, field };
}
