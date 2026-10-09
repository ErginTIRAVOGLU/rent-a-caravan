import { expect, it } from "vitest";

import { fail, ok } from "../src/lib/result";

it("ok() ok:true ve data döner", () => {
  expect(ok(5)).toEqual({ ok: true, data: 5 });
});

it("fail() ok:false, error ve field taşır", () => {
  expect(fail("Geçersiz", "email")).toEqual({
    ok: false,
    error: "Geçersiz",
    field: "email",
  });
});
