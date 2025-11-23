import { describe, it, beforeEach, expect, vi } from 'vitest';
import { applySettingsPayload, showBanner } from '../src/content/banner';

describe('applySettingsPayload', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    // Reset global state
    (window as any).__env_marker_lastBanner = null;
  });

  it('removes banner when enabled is false and pattern matches', () => {
    // Setup: Show a banner first
    showBanner('example.com', '#f00', 'top', 4);
    const banner = document.getElementById('env-marker-banner');
    expect(banner).not.toBeNull();
    expect((window as any).__env_marker_lastBanner).not.toBeNull();

    // Act: Receive payload with enabled: false
    applySettingsPayload({
      type: 'env-marker-settings-changed',
      enabled: false,
      patterns: ['example.com', 'other.com'],
      timestamp: Date.now()
    });

    // Assert: Banner should be removed
    expect(document.getElementById('env-marker-banner')).toBeNull();
    expect((window as any).__env_marker_lastBanner).toBeNull();
  });

  it('does not remove banner if pattern does not match even if enabled is false', () => {
    // Setup: Show a banner for "example.com"
    showBanner('example.com', '#f00', 'top', 4);
    
    // Act: Receive payload for DIFFERENT setting (different patterns) that is disabled
    applySettingsPayload({
      type: 'env-marker-settings-changed',
      enabled: false,
      patterns: ['other.com'], // Does not include 'example.com'
      timestamp: Date.now()
    });

    // Assert: Banner should remain
    expect(document.getElementById('env-marker-banner')).not.toBeNull();
    expect((window as any).__env_marker_lastBanner).not.toBeNull();
  });

  it('updates banner when enabled is true', () => {
    // Setup: Show a banner
    showBanner('example.com', '#f00', 'top', 4);

    // Act: Receive payload with enabled: true and new color
    applySettingsPayload({
      type: 'env-marker-settings-changed',
      enabled: true,
      patterns: ['example.com'],
      color: '#00f',
      bannerPosition: 'bottom',
      bannerSize: 10,
      timestamp: Date.now()
    });

    // Assert: Banner style updated
    const banner = document.getElementById('env-marker-banner');
    expect(banner).not.toBeNull();
    expect(banner?.style.background).toBe('rgb(0, 0, 255)'); // #00f -> rgb(0, 0, 255) in JSDOM
    // Note: checking position update might require more checks on style
    expect(banner?.style.bottom).toBe('0px');
  });
});
