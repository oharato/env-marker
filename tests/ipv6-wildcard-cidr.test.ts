import { describe, it, expect } from 'vitest';
import { matchesPattern } from '../src/ipMatcher';

describe('ipMatcher wildcard and CIDR', () => {
  it('matches IPv6 exact and abbreviated', () => {
    expect(matchesPattern('2404:6800:4004:824::2004', '2404:6800:4004:824::2004')).toBe(true);
    expect(matchesPattern('2404:6800:4004:824::2004', '2404:6800:4004:824:0:0:0:2004')).toBe(true);
  });

  it('matches CIDR range', () => {
    // 2001:db8::/32 should include 2001:db8:1::1
    expect(matchesPattern('2001:db8::/32', '2001:db8:1::1')).toBe(true);
    expect(matchesPattern('2001:db8::/32', '2002:db8::1')).toBe(false);
  });

  it('matches wildcard pattern', () => {
    expect(matchesPattern('2404:6800:4004:*', '2404:6800:4004:824::2004')).toBe(true);
    expect(matchesPattern('2404:6800:*', '2404:6800:4004:824::2004')).toBe(true);
    expect(matchesPattern('2404:6800:4004:823*', '2404:6800:4004:824::2004')).toBe(false);
  });

  it('matches URL wildcard', () => {
    expect(matchesPattern('https://example.com/*', undefined, 'https://example.com/path')).toBe(true);
    expect(matchesPattern('https://example.com/*', undefined, 'https://example.org/path')).toBe(false);
  });
});
