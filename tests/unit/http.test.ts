import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithResilience } from '../../src/lib/http.js';

describe('Resilient HTTP Client', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should succeed on first attempt', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' }),
    } as Response);

    const response = await fetchWithResilience('https:
      method: 'GET',
      timeoutMs: 2000,
      retries: 0,
    });

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success' }),
      } as Response);

    const response = await fetchWithResilience('https:
      method: 'GET',
      timeoutMs: 2000,
      retries: 3,
      retryDelayBaseMs: 1, 
    });

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries exceeded', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(
      fetchWithResilience('https:
        method: 'GET',
        timeoutMs: 2000,
        retries: 2,
        retryDelayBaseMs: 1,
      })
    ).rejects.toThrow();

    expect(global.fetch).toHaveBeenCalledTimes(3); 
  });
});

