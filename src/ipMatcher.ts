import ip6 from 'ip6';

export function isIPv6Pattern(str: string) {
  return typeof str === 'string' && str.includes(':') && !/^https?:\/\//i.test(str);
}

function ipv6ToBigInt(normalizedAddr: string) {
  const hex = normalizedAddr.replace(/:/g, '');
  return BigInt('0x' + hex);
}

export function matchesPattern(pattern: string, remoteIp: string | undefined, url?: string): boolean {
  if (!pattern || pattern.trim() === '') return false;
  const patt = pattern.trim();
  // strip surrounding square brackets often used for IPv6 literals
  const cleanPattern = patt.replace(/^\[|\]$/g, '');

  try {
    if (isIPv6Pattern(cleanPattern)) {
      // CIDR: addr/prefix
      if (cleanPattern.includes('/')) {
        const [addrPart, maskPart] = cleanPattern.split('/');
        const mask = parseInt(maskPart, 10);
        if (Number.isNaN(mask) || mask < 0 || mask > 128) return false;
        if (!remoteIp) return false;
        try {
          const remoteClean = remoteIp.replace(/^\[|\]$/g, '');
          const normRemote = ip6.normalize(remoteClean);
          const normPattern = ip6.normalize(addrPart);
          const r = ipv6ToBigInt(normRemote);
          const p = ipv6ToBigInt(normPattern);
          const shift = BigInt(128 - mask);
          const netR = r >> shift;
          const netP = p >> shift;
          return netR === netP;
        } catch (e) {
          return false;
        }
      }

      // wildcard * inside pattern
      if (cleanPattern.includes('*')) {
        const frag = cleanPattern
          .split('*')
          .map(s => s.replace(/[.+?^${}()|[\\]/g, '\\$&'))
          .join('.*');
        const regex = new RegExp('^' + frag + '$', 'i');
        if (remoteIp) {
          const remoteClean = remoteIp.replace(/^\[|\]$/g, '');
          try {
            const normRemote = ip6.normalize(remoteClean);
            if (regex.test(normRemote)) return true;
          } catch (e) {
            // fallthrough
          }
          if (regex.test(remoteIp)) return true;
          if (regex.test(remoteClean)) return true;
        }
        return false;
      }

      // exact normalized compare
      if (remoteIp) {
        try {
          const normPattern = ip6.normalize(cleanPattern);
          const remoteClean = remoteIp.replace(/^\[|\]$/g, '');
          const normRemote = ip6.normalize(remoteClean);
          if (normPattern === normRemote) return true;
        } catch (e) {
          // fallthrough to regex
        }
      }
    }

    // fallback: treat as URL or wildcard pattern using regex
    const regexPattern = patt.replace(/[.+?^${}()|[\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(regexPattern);
    if (url && regex.test(url)) return true;
    if (remoteIp && regex.test(remoteIp)) return true;
    return false;
  } catch (e) {
    return false;
  }
}
