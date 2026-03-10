import { describe, it, expect } from 'vitest';

// Extract the private globToRegex function by re-implementing it here for testing.
// This matches the implementation in network.ts exactly.
function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const converted = escaped
    .replace(/\*\*/g, '##DOUBLE##')
    .replace(/\*/g, '[^/]*')
    .replace(/##DOUBLE##/g, '.*');
  return new RegExp(`^${converted}$`);
}

describe('globToRegex', () => {
  it('matches exact URL', () => {
    const re = globToRegex('https://example.com/api/users');
    expect(re.test('https://example.com/api/users')).toBe(true);
    expect(re.test('https://example.com/api/users/1')).toBe(false);
  });

  it('* matches within a single path segment', () => {
    const re = globToRegex('https://example.com/api/*');
    expect(re.test('https://example.com/api/users')).toBe(true);
    expect(re.test('https://example.com/api/orders')).toBe(true);
    expect(re.test('https://example.com/api/v2/users')).toBe(false);
  });

  it('** matches across path segments', () => {
    const re = globToRegex('https://example.com/**');
    expect(re.test('https://example.com/api/users')).toBe(true);
    expect(re.test('https://example.com/api/v2/users?page=1')).toBe(true);
  });

  it('** in the middle matches across segments', () => {
    const re = globToRegex('https://example.com/**/users');
    expect(re.test('https://example.com/api/users')).toBe(true);
    expect(re.test('https://example.com/api/v2/users')).toBe(true);
    expect(re.test('https://example.com/api/v2/orders')).toBe(false);
  });

  it('does not match different domain', () => {
    const re = globToRegex('https://example.com/api/*');
    expect(re.test('https://other.com/api/users')).toBe(false);
  });

  it('escapes regex special characters in the pattern', () => {
    const re = globToRegex('https://example.com/api/v1.0/users');
    expect(re.test('https://example.com/api/v1.0/users')).toBe(true);
    expect(re.test('https://example.com/api/v100/users')).toBe(false);
  });

  it('query string match with **', () => {
    const re = globToRegex('https://api.example.com/**');
    expect(re.test('https://api.example.com/search?q=test&page=1')).toBe(true);
  });
});
