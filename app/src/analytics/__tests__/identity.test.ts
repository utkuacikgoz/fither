import { analyticsDistinctId, sha256Hex } from "../identity";

describe("sha256Hex", () => {
  it("matches the published vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("handles block boundaries and multi-byte text", () => {
    expect(sha256Hex("The quick brown fox jumps over the lazy dog")).toBe(
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
    );
    expect(sha256Hex("a".repeat(64))).toBe(
      "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb",
    );
    // Non-ASCII goes through the UTF-8 path: a different string is a
    // different digest, and the digest is still 64 hex characters.
    expect(sha256Hex("Ünïcödé 日本語 🙂")).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("Ünïcödé 日本語 🙂")).not.toBe(sha256Hex("Unicode"));
  });
});

describe("analyticsDistinctId", () => {
  it("is a salted hash, never the provider id, and stable", () => {
    const id = "001234.abcdef0123456789.0987";
    const distinct = analyticsDistinctId(id);
    expect(distinct).toHaveLength(64);
    expect(distinct).not.toContain(id);
    expect(distinct).toBe(analyticsDistinctId(id));
    expect(distinct).not.toBe(sha256Hex(id));
    expect(analyticsDistinctId("other")).not.toBe(distinct);
  });
});
