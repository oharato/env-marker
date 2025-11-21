import { describe, it, expect } from 'vitest';
import ip6 from 'ip6';

describe('IPv6 using ip6.normalize', () => {
  it('完全一致', () => {
    const p = '2404:6800:4004:824::2004';
    expect(ip6.normalize(p)).toBe(ip6.normalize('2404:6800:4004:824::2004'));
  });

  it('省略表記は同一視される', () => {
    const p = '2404:6800:4004:824::2004';
    const t = '2404:6800:4004:824:0:0:0:2004';
    expect(ip6.normalize(p)).toBe(ip6.normalize(t));
  });

  it('セグメント違いは不一致', () => {
    const p = '2404:6800:4004:824::2004';
    const t = '2404:6800:4004:824:abcd:0:0:2004';
    expect(ip6.normalize(p)).not.toBe(ip6.normalize(t));
  });

  it('完全一致（省略なし）', () => {
    const p = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
    expect(ip6.normalize(p)).toBe(ip6.normalize('2001:0db8:85a3:0000:0000:8a2e:0370:7334'));
  });

  it('不一致', () => {
    const p = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
    const t = '2001:0db8:85a3:0000:0000:8a2e:0370:7335';
    expect(ip6.normalize(p)).not.toBe(ip6.normalize(t));
  });
});
