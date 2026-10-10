export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T>(error: string, field?: string): ActionResult<T> {
  return { ok: false, error, field };
}

/** Zod ilk doğrulama hatasının (Türkçe mesaj + alan adı) çıkarımı. */
export type FieldIssue = { message: string; field?: string };

/**
 * İlk Zod hatasını Türkçe mesaj + alan adı ile çıkarır.
 * Nötr yardımcı: auth/listing/booking validator'ları ve stay/pricing bunu paylaşır.
 */
export function firstIssue(error: {
  issues: ReadonlyArray<{ message: string; path: PropertyKey[] }>;
}): FieldIssue {
  const issue = error.issues[0];
  if (!issue) {
    return { message: "Geçersiz veri." };
  }
  const path = issue.path[0];
  return {
    message: issue.message,
    field: typeof path === "string" ? path : undefined,
  };
}
