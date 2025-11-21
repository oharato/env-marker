import { describe, it, beforeEach, expect } from 'vitest';
import { createFrameBorderClickers, removeFrameCloseButton, showBanner } from '../src/content/banner';

describe('banner frame border clickers', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    removeFrameCloseButton();
    const b = document.getElementById('env-marker-banner'); if (b) b.remove();
  });

  it('creates four border elements and removes them', () => {
    createFrameBorderClickers('#f00', 6);
    expect(document.getElementById('env-marker-frame-border-top')).not.toBeNull();
    expect(document.getElementById('env-marker-frame-border-bottom')).not.toBeNull();
    expect(document.getElementById('env-marker-frame-border-left')).not.toBeNull();
    expect(document.getElementById('env-marker-frame-border-right')).not.toBeNull();

    removeFrameCloseButton();
    expect(document.getElementById('env-marker-frame-border-top')).toBeNull();
    expect(document.getElementById('env-marker-frame-border-bottom')).toBeNull();
  });

  it('showBanner in frame mode creates banner and borders', () => {
    showBanner('example.com', '#0f0', 'frame', 5);
    const banner = document.getElementById('env-marker-banner');
    expect(banner).not.toBeNull();
    expect(document.getElementById('env-marker-frame-border-top')).not.toBeNull();
  });
});
