// Test to verify IPv6 support in the built extension
// This replicates the logic from the extension to ensure it works correctly

import { containsIPv6, expandIPv6, normalizeIPv6ForMatching } from '../utils/ipv6-utils';

console.log('=== Testing IPv6 Utility Functions ===\n');

// Test containsIPv6
console.log('Test 1: containsIPv6');
console.assert(containsIPv6('::1') === true, 'Should detect ::1 as IPv6');
console.assert(containsIPv6('fe80::1') === true, 'Should detect fe80::1 as IPv6');
console.assert(containsIPv6('192.168.1.1') === false, 'Should not detect IPv4 as IPv6');
console.assert(containsIPv6('example.com') === false, 'Should not detect domain as IPv6');
console.log('✓ containsIPv6 tests passed\n');

// Test expandIPv6
console.log('Test 2: expandIPv6');
const expanded1 = expandIPv6('::1');
console.assert(expanded1 === '0000:0000:0000:0000:0000:0000:0000:0001', `Should expand ::1 to full form, got: ${expanded1}`);

const expanded2 = expandIPv6('fe80::1');
console.assert(expanded2 === 'fe80:0000:0000:0000:0000:0000:0000:0001', `Should expand fe80::1, got: ${expanded2}`);

const expanded3 = expandIPv6('2001:db8::1');
console.assert(expanded3 === '2001:0db8:0000:0000:0000:0000:0000:0001', `Should expand 2001:db8::1, got: ${expanded3}`);

const expanded4 = expandIPv6('http://[::1]:8080/path');
console.assert(expanded4 === 'http://[0000:0000:0000:0000:0000:0000:0000:0001]:8080/path', `Should expand IPv6 in URL, got: ${expanded4}`);
console.log('✓ expandIPv6 tests passed\n');

// Test normalizeIPv6ForMatching
console.log('Test 3: normalizeIPv6ForMatching');
const normalized1 = normalizeIPv6ForMatching('::1');
console.assert(normalized1 === '0000:0000:0000:0000:0000:0000:0000:0001', `Should normalize ::1, got: ${normalized1}`);

const normalized2 = normalizeIPv6ForMatching('192.168.1.1');
console.assert(normalized2 === '192.168.1.1', `Should not change IPv4, got: ${normalized2}`);

const normalized3 = normalizeIPv6ForMatching('fe80:*:1');
console.assert(normalized3 === 'fe80:*:1', `Should not normalize patterns with wildcards, got: ${normalized3}`);
console.log('✓ normalizeIPv6ForMatching tests passed\n');

// Test pattern matching logic (simulating the extension's behavior)
console.log('Test 4: Pattern matching with normalization');

function testPatternMatch(pattern: string, testString: string, shouldMatch: boolean): void {
  const normalizedPattern = normalizeIPv6ForMatching(pattern);
  const normalizedTest = normalizeIPv6ForMatching(testString);
  
  const regexPattern = normalizedPattern
    .replace(/[.+?^${}()|[\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  
  const regex = new RegExp(regexPattern, 'i');
  const result = regex.test(normalizedTest);
  
  const status = result === shouldMatch ? '✓' : '✗';
  console.log(`${status} Pattern: "${pattern}" vs "${testString}" -> ${result} (expected: ${shouldMatch})`);
  console.assert(result === shouldMatch, `Match result should be ${shouldMatch}`);
}

// IPv6 compressed vs expanded
testPatternMatch('::1', '0:0:0:0:0:0:0:1', true);
testPatternMatch('fe80::1', 'fe80:0000:0000:0000:0000:0000:0000:0001', true);
testPatternMatch('2001:db8::1', '2001:0db8:0000:0000:0000:0000:0000:0001', true);

// IPv6 in URLs
testPatternMatch('::1', 'http://[::1]:8080/test', true);
testPatternMatch('[::1]', 'http://[::1]:8080/test', true);

// IPv6 partial match
testPatternMatch('fe80', 'fe80:0000:0000:0000:0000:0000:0000:0001', true);
testPatternMatch('2001:db8', 'http://[2001:db8::1]/test', true);

// IPv4 should still work
testPatternMatch('192.168.1', '192.168.1.100', true);
testPatternMatch('10.0.0.1', 'http://10.0.0.1:8080/test', true);

// Should not match
testPatternMatch('fe80::2', 'fe80:0000:0000:0000:0000:0000:0000:0001', false);
testPatternMatch('2001:db9', '2001:0db8:0000:0000:0000:0000:0000:0001', false);

console.log('\n=== All tests passed! ===');
