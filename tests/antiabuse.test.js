/**
 * Anti-abuse language/character detection regression tests.
 * Verifies the detectBlockedScript & hasWeirdChars helpers work correctly.
 */
const { detectBlockedScript, hasWeirdChars } = require('../src/handlers/antiAbuse');

describe('detectBlockedScript', () => {
  test('detects Arabic script', () => {
    expect(detectBlockedScript('مرحبا بالعالم')).toBeTruthy();
  });
  test('detects Cyrillic script', () => {
    expect(detectBlockedScript('Привет мир')).toBeTruthy();
  });
  test('detects CJK / Chinese', () => {
    expect(detectBlockedScript('你好世界')).toBeTruthy();
  });
  test('detects Hangul / Korean', () => {
    expect(detectBlockedScript('안녕하세요')).toBeTruthy();
  });
  test('detects Japanese kana', () => {
    expect(detectBlockedScript('こんにちは')).toBeTruthy();
  });
  test('returns null for plain English', () => {
    expect(detectBlockedScript('hello world how are you')).toBeNull();
  });
  test('returns null for English with punctuation', () => {
    expect(detectBlockedScript('Hey! What is up? 123...')).toBeNull();
  });
});

describe('hasWeirdChars', () => {
  test('returns false for normal ASCII text', () => {
    expect(hasWeirdChars('normal english message here')).toBe(false);
  });
  test('returns false for text with numbers and punctuation', () => {
    expect(hasWeirdChars('Order #42 — total: $19.99!')).toBe(false);
  });
  test('returns true for zero-width / bidi chars', () => {
    expect(hasWeirdChars('test\u200B\u200Chidden')).toBe(true);
  });
  test('returns false for empty/undefined', () => {
    expect(hasWeirdChars('')).toBe(false);
    expect(hasWeirdChars(null)).toBe(false);
  });
});
