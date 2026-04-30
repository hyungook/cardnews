import { describe, it, expect, beforeEach } from 'vitest';
import { frameRegistry } from './frame-registry.js';

describe('FrameRegistry', () => {
  beforeEach(() => {
    frameRegistry.clear();
  });

  it('should register a new batch', () => {
    frameRegistry.registerBatch('batch-1');
    const batch = frameRegistry.getBatch('batch-1');
    expect(batch).toBeDefined();
    expect(batch!.batchId).toBe('batch-1');
    expect(batch!.frameIds).toEqual([]);
    expect(batch!.createdAt).toBeTruthy();
  });

  it('should not overwrite an existing batch on duplicate register', () => {
    frameRegistry.registerBatch('batch-1');
    frameRegistry.addFrame('batch-1', 'frame-a');
    frameRegistry.registerBatch('batch-1'); // duplicate
    const batch = frameRegistry.getBatch('batch-1');
    expect(batch!.frameIds).toEqual(['frame-a']);
  });

  it('should add frames to a batch', () => {
    frameRegistry.registerBatch('batch-1');
    frameRegistry.addFrame('batch-1', 'frame-a');
    frameRegistry.addFrame('batch-1', 'frame-b');
    const batch = frameRegistry.getBatch('batch-1');
    expect(batch!.frameIds).toEqual(['frame-a', 'frame-b']);
  });

  it('should ignore addFrame for non-existent batch', () => {
    frameRegistry.addFrame('nonexistent', 'frame-a');
    expect(frameRegistry.getBatch('nonexistent')).toBeUndefined();
  });

  it('should return all batches', () => {
    frameRegistry.registerBatch('batch-1');
    frameRegistry.registerBatch('batch-2');
    frameRegistry.addFrame('batch-1', 'f1');
    const all = frameRegistry.getAllBatches();
    expect(all).toHaveLength(2);
  });

  it('should remove a batch', () => {
    frameRegistry.registerBatch('batch-1');
    const removed = frameRegistry.removeBatch('batch-1');
    expect(removed).toBe(true);
    expect(frameRegistry.getBatch('batch-1')).toBeUndefined();
  });

  it('should return false when removing non-existent batch', () => {
    expect(frameRegistry.removeBatch('nonexistent')).toBe(false);
  });

  it('should clear all batches', () => {
    frameRegistry.registerBatch('batch-1');
    frameRegistry.registerBatch('batch-2');
    frameRegistry.clear();
    expect(frameRegistry.getAllBatches()).toHaveLength(0);
  });
});
