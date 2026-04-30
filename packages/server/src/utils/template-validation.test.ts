import { describe, it, expect } from 'vitest';
import { DEFAULT_LAYER_NAMES } from '@card-news/shared';
import { validateTemplateLayerNames } from './template-validation.js';

describe('validateTemplateLayerNames', () => {
  const allRequired = Object.values(DEFAULT_LAYER_NAMES);

  it('returns valid when all required layers are present', () => {
    const result = validateTemplateLayerNames(allRequired);
    expect(result.valid).toBe(true);
    expect(result.missingLayers).toEqual([]);
  });

  it('returns valid when extra layers exist alongside required ones', () => {
    const layers = [...allRequired, 'extra_layer', 'another_layer'];
    const result = validateTemplateLayerNames(layers);
    expect(result.valid).toBe(true);
    expect(result.missingLayers).toEqual([]);
  });

  it('returns invalid with missing layers when none are present', () => {
    const result = validateTemplateLayerNames([]);
    expect(result.valid).toBe(false);
    expect(result.missingLayers).toEqual(allRequired);
  });

  it('returns the specific missing layer names', () => {
    const layers = ['bg_image', 'logo', 'main_text'];
    const result = validateTemplateLayerNames(layers);
    expect(result.valid).toBe(false);
    expect(result.missingLayers).toEqual(['sub_text', 'copyright', 'badge_container']);
  });

  it('detects a single missing layer', () => {
    const layers = allRequired.filter((n) => n !== 'copyright');
    const result = validateTemplateLayerNames(layers);
    expect(result.valid).toBe(false);
    expect(result.missingLayers).toEqual(['copyright']);
  });

  it('uses custom requiredNames when provided', () => {
    const custom = {
      background: 'custom_bg',
      logo: 'custom_logo',
      mainText: 'custom_main',
      subText: 'custom_sub',
      copyright: 'custom_cr',
      badgeContainer: 'custom_badge',
    };
    const layers = ['custom_bg', 'custom_logo', 'custom_main', 'custom_sub', 'custom_cr', 'custom_badge'];
    const result = validateTemplateLayerNames(layers, custom);
    expect(result.valid).toBe(true);
    expect(result.missingLayers).toEqual([]);
  });

  it('is case-sensitive for layer name matching', () => {
    const layers = ['BG_IMAGE', 'LOGO', 'MAIN_TEXT', 'SUB_TEXT', 'COPYRIGHT', 'BADGE_CONTAINER'];
    const result = validateTemplateLayerNames(layers);
    expect(result.valid).toBe(false);
    expect(result.missingLayers).toEqual(allRequired);
  });
});
