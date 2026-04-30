import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FigmaOrchestrator, type FigmaConfig } from './figma-orchestrator.js';
import type { WebSocketBridge } from '../websocket/bridge.js';
import type { OverflowResult } from '@card-news/shared';

// --- helpers ---

function createMockBridge(): WebSocketBridge {
  return {
    sendCommand: vi.fn(),
    connected: true,
  } as unknown as WebSocketBridge;
}

const CONFIG: FigmaConfig = {
  accessToken: 'test-token',
  fileKey: 'test-file-key',
};

function makeFigmaNodeResponse(templateNodeId: string) {
  return {
    nodes: {
      [templateNodeId]: {
        document: {
          children: [
            {
              id: '10:1',
              name: 'bg_image',
              type: 'RECTANGLE',
              absoluteBoundingBox: { x: 0, y: 0, width: 808, height: 454 },
            },
            {
              id: '10:2',
              name: 'logo',
              type: 'RECTANGLE',
              absoluteBoundingBox: { x: 50, y: 50, width: 200, height: 80 },
            },
            {
              id: '10:3',
              name: 'main_text',
              type: 'TEXT',
              absoluteBoundingBox: { x: 50, y: 300, width: 700, height: 100 },
            },
            {
              id: '10:4',
              name: 'sub_text',
              type: 'TEXT',
              absoluteBoundingBox: { x: 50, y: 410, width: 700, height: 30 },
            },
            {
              id: '10:5',
              name: 'copyright',
              type: 'TEXT',
              absoluteBoundingBox: { x: 600, y: 430, width: 200, height: 20 },
            },
            {
              id: '10:6',
              name: 'badge_container',
              type: 'FRAME',
              absoluteBoundingBox: { x: 50, y: 150, width: 400, height: 40 },
            },
          ],
        },
      },
    },
  };
}

// --- tests ---

describe('FigmaOrchestrator', () => {
  let bridge: WebSocketBridge;
  let orchestrator: FigmaOrchestrator;

  beforeEach(() => {
    vi.restoreAllMocks();
    bridge = createMockBridge();
    orchestrator = new FigmaOrchestrator(bridge, CONFIG);
  });

  // ---- cacheTemplateSpec ----

  describe('cacheTemplateSpec', () => {
    it('REST API로 템플릿 스펙을 가져와 캐싱한다', async () => {
      const templateNodeId = '1:2';
      const mockResponse = makeFigmaNodeResponse(templateNodeId);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );

      const spec = await orchestrator.cacheTemplateSpec(templateNodeId);

      expect(spec.templateNodeId).toBe(templateNodeId);
      expect(spec.layers.background.nodeId).toBe('10:1');
      expect(spec.layers.logo.nodeId).toBe('10:2');
      expect(spec.layers.mainText.nodeId).toBe('10:3');
      expect(spec.layers.subText.nodeId).toBe('10:4');
      expect(spec.layers.copyright.nodeId).toBe('10:5');
      expect(spec.layers.badgeContainer.nodeId).toBe('10:6');
      expect(spec.cachedAt).toBeGreaterThan(0);
    });

    it('동일 templateNodeId로 재호출 시 캐시를 반환한다', async () => {
      const templateNodeId = '1:2';
      const mockResponse = makeFigmaNodeResponse(templateNodeId);
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockResponse), { status: 200 }),
        );

      await orchestrator.cacheTemplateSpec(templateNodeId);
      const spec2 = await orchestrator.cacheTemplateSpec(templateNodeId);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(spec2.templateNodeId).toBe(templateNodeId);
    });

    it('API 오류 시 에러를 던진다', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Forbidden', { status: 403 }),
      );

      await expect(orchestrator.cacheTemplateSpec('1:2')).rejects.toThrow(
        'Figma API 오류 (403)',
      );
    });

    it('노드 데이터가 없으면 에러를 던진다', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ nodes: {} }), { status: 200 }),
      );

      await expect(orchestrator.cacheTemplateSpec('1:2')).rejects.toThrow(
        '템플릿 노드를 찾을 수 없습니다',
      );
    });

    it('누락된 레이어는 기본값으로 채운다', async () => {
      const templateNodeId = '1:2';
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            nodes: {
              [templateNodeId]: {
                document: {
                  children: [
                    {
                      id: '10:1',
                      name: 'bg_image',
                      type: 'RECTANGLE',
                      absoluteBoundingBox: { x: 0, y: 0, width: 808, height: 454 },
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        ),
      );

      const spec = await orchestrator.cacheTemplateSpec(templateNodeId);
      expect(spec.layers.background.nodeId).toBe('10:1');
      // Missing layers get empty defaults
      expect(spec.layers.logo.nodeId).toBe('');
      expect(spec.layers.logo.type).toBe('UNKNOWN');
    });
  });

  // ---- Plugin commands via bridge ----

  describe('cloneFrame', () => {
    it('clone-frame 명령을 전송하고 frameId를 반환한다', async () => {
      vi.mocked(bridge.sendCommand).mockResolvedValueOnce({
        frameId: 'new-frame-123',
      });

      const frameId = await orchestrator.cloneFrame('template-1:2');

      expect(bridge.sendCommand).toHaveBeenCalledWith('clone-frame', {
        templateNodeId: 'template-1:2',
      });
      expect(frameId).toBe('new-frame-123');
    });
  });

  describe('setTextLayer', () => {
    it('set-text 명령을 전송한다', async () => {
      vi.mocked(bridge.sendCommand).mockResolvedValueOnce(undefined);

      await orchestrator.setTextLayer('frame-1', 'main_text', '안녕하세요');

      expect(bridge.sendCommand).toHaveBeenCalledWith('set-text', {
        frameId: 'frame-1',
        layerName: 'main_text',
        text: '안녕하세요',
      });
    });
  });

  describe('hideLayer', () => {
    it('hide-layer 명령을 전송한다', async () => {
      vi.mocked(bridge.sendCommand).mockResolvedValueOnce(undefined);

      await orchestrator.hideLayer('frame-1', 'sub_text');

      expect(bridge.sendCommand).toHaveBeenCalledWith('hide-layer', {
        frameId: 'frame-1',
        layerName: 'sub_text',
      });
    });
  });

  describe('replaceImage', () => {
    it('replace-image 명령을 base64 인코딩된 이미지와 함께 전송한다', async () => {
      vi.mocked(bridge.sendCommand).mockResolvedValueOnce(undefined);
      const imageData = Buffer.from('fake-image-data');

      await orchestrator.replaceImage('frame-1', 'bg_image', imageData);

      expect(bridge.sendCommand).toHaveBeenCalledWith('replace-image', {
        frameId: 'frame-1',
        layerName: 'bg_image',
        imageBase64: imageData.toString('base64'),
      });
    });
  });

  describe('switchBadgeVariant', () => {
    it('switch-badge-variant 명령을 전송한다', async () => {
      vi.mocked(bridge.sendCommand).mockResolvedValueOnce(undefined);
      const badges = [
        { name: '무료' as const, position: 1 },
        { name: 'UHD' as const, position: 2 },
      ];

      await orchestrator.switchBadgeVariant('frame-1', 2, badges);

      expect(bridge.sendCommand).toHaveBeenCalledWith(
        'switch-badge-variant',
        {
          frameId: 'frame-1',
          count: 2,
          badges,
        },
      );
    });
  });

  describe('checkOverflow', () => {
    it('check-overflow 명령을 전송하고 OverflowResult를 반환한다', async () => {
      const overflowResult: OverflowResult = {
        isOverflowing: true,
        textBounds: { x: 50, y: 300, width: 750, height: 120 },
        parentBounds: { x: 50, y: 300, width: 700, height: 100 },
        overflowX: 50,
        overflowY: 20,
      };
      vi.mocked(bridge.sendCommand).mockResolvedValueOnce(overflowResult);

      const result = await orchestrator.checkOverflow('frame-1', 'main_text');

      expect(bridge.sendCommand).toHaveBeenCalledWith('check-overflow', {
        frameId: 'frame-1',
        layerName: 'main_text',
      });
      expect(result).toEqual(overflowResult);
    });
  });

  describe('deleteFrames', () => {
    it('delete-frames 명령을 전송한다', async () => {
      vi.mocked(bridge.sendCommand).mockResolvedValueOnce(undefined);

      await orchestrator.deleteFrames(['frame-1', 'frame-2', 'frame-3']);

      expect(bridge.sendCommand).toHaveBeenCalledWith('delete-frames', {
        frameIds: ['frame-1', 'frame-2', 'frame-3'],
      });
    });
  });

  // ---- exportImage (REST API) ----

  describe('exportImage', () => {
    it('Figma REST API로 이미지를 내보내고 Buffer를 반환한다', async () => {
      const nodeId = '5:10';
      const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

      // First fetch: Figma images API
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              images: { [nodeId]: 'https://figma-cdn.example.com/img.jpg' },
            }),
            { status: 200 },
          ),
        )
        // Second fetch: download the image
        .mockResolvedValueOnce(
          new Response(imageBytes, { status: 200 }),
        );

      const buffer = await orchestrator.exportImage(nodeId, 1, 'jpg');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(imageBytes.length);

      const fetchCalls = vi.mocked(globalThis.fetch).mock.calls;
      expect(fetchCalls[0][0]).toContain(
        `https://api.figma.com/v1/images/${CONFIG.fileKey}`,
      );
      expect(fetchCalls[0][0]).toContain(`ids=${encodeURIComponent(nodeId)}`);
      expect(fetchCalls[0][0]).toContain('scale=1');
      expect(fetchCalls[0][0]).toContain('format=jpg');
    });

    it('이미지 API 오류 시 에러를 던진다', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Rate limited', { status: 429 }),
      );

      await expect(orchestrator.exportImage('5:10')).rejects.toThrow(
        'Figma API Rate Limit',
      );
    });

    it('이미지 URL이 없으면 에러를 던진다', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ images: {} }), { status: 200 }),
      );

      await expect(orchestrator.exportImage('5:10')).rejects.toThrow(
        '이미지 URL을 받지 못했습니다',
      );
    });

    it('이미지 다운로드 실패 시 에러를 던진다', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              images: { '5:10': 'https://figma-cdn.example.com/img.jpg' },
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

      await expect(orchestrator.exportImage('5:10')).rejects.toThrow(
        '이미지 다운로드 실패 (404)',
      );
    });

    it('scale과 format 기본값을 사용한다', async () => {
      const nodeId = '5:10';
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              images: { [nodeId]: 'https://figma-cdn.example.com/img.jpg' },
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
        );

      await orchestrator.exportImage(nodeId);

      const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
      expect(url).toContain('scale=1');
      expect(url).toContain('format=jpg');
    });
  });

  // ---- clearCache ----

  describe('clearCache', () => {
    it('캐시를 초기화하면 다음 호출 시 API를 다시 호출한다', async () => {
      const templateNodeId = '1:2';
      const mockResponse = makeFigmaNodeResponse(templateNodeId);
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockResponse), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockResponse), { status: 200 }),
        );

      await orchestrator.cacheTemplateSpec(templateNodeId);
      orchestrator.clearCache();
      await orchestrator.cacheTemplateSpec(templateNodeId);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
