// IPv6 utility functions for normalizing and matching IPv6 addresses

/**
 * Check if a string contains an IPv6 address pattern
 */
export function containsIPv6(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  
  // Remove URL brackets if present
  const cleaned = str.replace(/\[|\]/g, '');
  
  // Check for :: (compressed notation) - definitely IPv6
  if (cleaned.includes('::')) return true;
  
  // Count colons - IPv6 should have at least 2 colons (even when compressed)
  const colonCount = (cleaned.match(/:/g) || []).length;
  if (colonCount >= 2) {
    // Check if it contains hex characters typical of IPv6
    // IPv6 uses 0-9, a-f, A-F
    return /^[0-9a-fA-F:]+$/.test(cleaned.split('/')[0].split('?')[0]);
  }
  
  // Special case: single colon with hex digits on both sides might be partial IPv6
  // This handles patterns like "2001:db8" which users might use to match IPv6 addresses
  if (colonCount === 1) {
    const parts = cleaned.split(':');
    // Check if both parts look like hex (IPv6 groups)
    // IPv6 groups are 1-4 hex digits
    if (parts.length === 2 && 
        /^[0-9a-fA-F]{1,4}$/.test(parts[0]) && 
        /^[0-9a-fA-F]{1,4}$/.test(parts[1])) {
      return true;
    }
  }
  
  return false;
}

/**
 * Expand IPv6 address from compressed to full format
 * e.g., "fe80::1" -> "fe80:0000:0000:0000:0000:0000:0000:0001"
 */
export function expandIPv6(addr: string): string {
  if (!addr || typeof addr !== 'string') return addr;
  
  // Extract just the IPv6 address part (remove URL parts, brackets, etc.)
  let ip = addr;
  let prefix = '';
  let suffix = '';
  
  // Remove URL scheme if present
  if (ip.match(/^https?:\/\//)) {
    prefix = ip.match(/^https?:\/\//)![0];
    ip = ip.replace(/^https?:\/\//, '');
  }
  
  // Extract from brackets if present
  const bracketMatch = ip.match(/\[([^\]]+)\](.*)$/);
  if (bracketMatch) {
    ip = bracketMatch[1];
    suffix = bracketMatch[2]; // Keep port and path
  } else {
    // Remove path first
    const pathMatch = ip.match(/^([^\/\?]+)([\/?].*)$/);
    if (pathMatch) {
      ip = pathMatch[1];
      suffix = pathMatch[2];
    }
  }
  
  // If no colon present, it's not IPv6
  if (!ip.includes(':')) return addr;
  
  if (!ip.includes('::')) {
    // Already in full format or might need padding
    const parts = ip.split(':');
    if (parts.length === 8) {
      // Pad each part to 4 digits
      const expanded = parts.map(part => part.padStart(4, '0')).join(':');
      if (bracketMatch) {
        return prefix + '[' + expanded + ']' + suffix;
      }
      return prefix + expanded + suffix;
    }
    // If less than 8 parts and no ::, just pad what we have (partial match is okay)
    const expanded = parts.map(part => part.padStart(4, '0')).join(':');
    if (bracketMatch) {
      return prefix + '[' + expanded + ']' + suffix;
    }
    return prefix + expanded + suffix;
  }
  
  // Handle :: compression
  const sides = ip.split('::');
  if (sides.length > 2) {
    // Invalid IPv6 - can't have more than one ::
    return addr;
  }
  
  const left = sides[0] ? sides[0].split(':').filter(p => p !== '') : [];
  const right = sides[1] ? sides[1].split(':').filter(p => p !== '') : [];
  
  // Calculate how many zero groups we need
  const totalGroups = 8;
  const missingGroups = totalGroups - (left.length + right.length);
  
  // Pad each part to 4 hex digits
  const leftPadded = left.map(p => p.padStart(4, '0'));
  const rightPadded = right.map(p => p.padStart(4, '0'));
  const middle = Array(missingGroups).fill('0000');
  
  const expanded = [...leftPadded, ...middle, ...rightPadded].join(':');
  
  if (bracketMatch) {
    return prefix + '[' + expanded + ']' + suffix;
  }
  return prefix + expanded + suffix;
}

/**
 * Normalize an IPv6 address or pattern for consistent matching
 * Returns the input unchanged if it's not IPv6
 */
export function normalizeIPv6ForMatching(input: string): string {
  if (!input || typeof input !== 'string') return input;
  
  // Don't normalize if it contains wildcards - those should be handled by regex
  if (input.includes('*')) return input;
  
  // Check if this looks like it contains an IPv6 address
  if (!containsIPv6(input)) return input;
  
  try {
    return expandIPv6(input);
  } catch (e) {
    console.error('[env-marker] Error normalizing IPv6:', e);
    return input; // Return original on error
  }
}
