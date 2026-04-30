import type { WebSocketBridge } from '../websocket/bridge.js';
import type {
  BadgeInfo,
  OverflowResult,
  TemplateSpec,
  LayerSpec,
} from '@card-news/shared';

export interface FigmaConfig {
  accessToken: string;
  fileKey: string;
}

interface FigmaNodeResponse {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children?: FigmaNodeResponse[];
}

/**
 * Figma 오케스트레이터
 * WebSocket 브릿지를 통해 Plugin 명령을 전송하고,
 * REST API를 통해 템플릿 스펙 캐싱 및 이미지 내보내기를 수행한다.
 */
export class FigmaOrchestrator {
  private bridge: WebSocketBridge;
  private config: FigmaConfig;
  private cachedSpec: TemplateSpec | null = null;

  constructor(bridge: WebSocketBridge, config: FigmaConfig) {
    this.bridge = bridge;
    this.config = config;
  }

  /**
   * 템플릿 스펙을 가져온다.
   * 플러그인이 연결되어 있으면 플러그인을 통해, 아니면 REST API를 사용한다.
   * 이미 캐싱된 스펙이 있으면 그대로 반환한다.
   */
  async cacheTemplateSpec(templateNodeId: string): Promise<TemplateSpec> {
    if (this.cachedSpec && this.cachedSpec.templateNodeId === templateNodeId) {
      console.log('[FigmaOrchestrator] 캐시된 템플릿 스펙 사용');
      return this.cachedSpec;
    }

    // 플러그인이 연결되어 있으면 플러그인을 통해 가져오기
    if (this.bridge.connected) {
      console.log('[FigmaOrchestrator] 플러그인을 통해 템플릿 스펙 가져오는 중...');
      try {
        const result = (await this.bridge.sendCommand('get-template-spec', {
          templateNodeId,
        })) as { layers: TemplateSpec['layers'] };
        
        const spec: TemplateSpec = {
          templateNodeId,
          layers: result.layers,
          cachedAt: Date.now(),
        };
        
        this.cachedSpec = spec;
        console.log('[FigmaOrchestrator] 플러그인을 통한 템플릿 스펙 캐싱 완료');
        return spec;
      } catch (error) {
        console.warn('[FigmaOrchestrator] 플러그인을 통한 스펙 가져오기 실패, API로 재시도:', error);
        // 플러그인 실패 시 API로 폴백
      }
    }

    console.log('[FigmaOrchestrator] Figma API로 템플릿 스펙 가져오는 중...');
    const url = `https://api.figma.com/v1/files/${this.config.fileKey}/nodes?ids=${encodeURIComponent(templateNodeId)}`;
    const response = await fetch(url, {
      headers: { 'X-Figma-Token': this.config.accessToken },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[FigmaOrchestrator] Figma API 오류 (${response.status}):`, text);
      
      // Rate Limit 오류인 경우 더 명확한 메시지
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? `${retryAfter}초` : '1분';
        throw new Error(`Figma API Rate Limit 초과. ${waitTime} 후 자동 재시도합니다.`);
      }
      
      throw new Error(`Figma API 오류 (${response.status}): ${text}`);
    }

    const data = await response.json();
    const nodeData = data.nodes?.[templateNodeId];

    if (!nodeData?.document?.children) {
      throw new Error(`템플릿 노드를 찾을 수 없습니다: ${templateNodeId}`);
    }

    const children: FigmaNodeResponse[] = nodeData.document.children;
    const layers = this.extractLayerSpecs(children);
    
    console.log('[FigmaOrchestrator] 템플릿 스펙 캐싱 완료');

    const spec: TemplateSpec = {
      templateNodeId,
      layers,
      cachedAt: Date.now(),
    };

    this.cachedSpec = spec;
    return spec;
  }

  /** 템플릿 프레임을 복제하여 새 프레임 ID를 반환한다. */
  async cloneFrame(templateNodeId: string): Promise<string> {
    const result = (await this.bridge.sendCommand('clone-frame', {
      templateNodeId,
    })) as { frameId: string };
    return result.frameId;
  }

  /** 텍스트 레이어의 내용을 설정한다. */
  async setTextLayer(
    frameId: string,
    layerName: string,
    text: string,
  ): Promise<void> {
    await this.bridge.sendCommand('set-text', { frameId, layerName, text });
  }

  /** 레이어를 숨김 처리한다. */
  async hideLayer(frameId: string, layerName: string): Promise<void> {
    await this.bridge.sendCommand('hide-layer', { frameId, layerName });
  }

  /** 이미지 레이어를 교체한다. imageData를 base64로 인코딩하여 전송한다. */
  async replaceImage(
    frameId: string,
    layerName: string,
    imageData: Buffer,
  ): Promise<void> {
    const imageBase64 = imageData.toString('base64');
    await this.bridge.sendCommand('replace-image', {
      frameId,
      layerName,
      imageBase64,
    });
  }

  /** 뱃지 Variant를 전환한다. */
  async switchBadgeVariant(
    frameId: string,
    badgeCount: number,
    badges: BadgeInfo[],
  ): Promise<void> {
    await this.bridge.sendCommand('switch-badge-variant', {
      frameId,
      count: badgeCount,
      badges,
    });
  }

  /** 텍스트 오버플로우를 검증한다. */
  async checkOverflow(
    frameId: string,
    layerName: string,
  ): Promise<OverflowResult> {
    const result = (await this.bridge.sendCommand('check-overflow', {
      frameId,
      layerName,
    })) as OverflowResult;
    return result;
  }

  /** 복제 프레임들을 삭제한다. */
  async deleteFrames(frameIds: string[]): Promise<void> {
    await this.bridge.sendCommand('delete-frames', { frameIds });
  }

  /**
   * Figma REST API를 통해 노드를 이미지로 내보낸다.
   * 이미지 URL을 받아 다운로드하여 Buffer로 반환한다.
   */
  async exportImage(
    nodeId: string,
    scale: number = 1,
    format: string = 'jpg',
  ): Promise<Buffer> {
    const url = `https://api.figma.com/v1/images/${this.config.fileKey}?ids=${encodeURIComponent(nodeId)}&scale=${scale}&format=${format}`;
    const response = await fetch(url, {
      headers: { 'X-Figma-Token': this.config.accessToken },
    });

    if (!response.ok) {
      const text = await response.text();
      
      // Rate Limit 오류 처리
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? `${retryAfter}초` : '1분';
        throw new Error(`Figma API Rate Limit 초과. ${waitTime} 후 자동 재시도합니다.`);
      }
      
      throw new Error(`Figma 이미지 내보내기 오류 (${response.status}): ${text}`);
    }

    const data = await response.json();
    const imageUrl: string | undefined = data.images?.[nodeId];

    if (!imageUrl) {
      throw new Error(`이미지 URL을 받지 못했습니다: ${nodeId}`);
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`이미지 다운로드 실패 (${imageResponse.status})`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** 캐싱된 스펙을 초기화한다. */
  clearCache(): void {
    this.cachedSpec = null;
  }

  private extractLayerSpecs(
    children: FigmaNodeResponse[],
  ): TemplateSpec['layers'] {
    const layerMap = new Map<string, LayerSpec>();

    for (const child of children) {
      const bbox = child.absoluteBoundingBox ?? {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      };
      layerMap.set(child.name, {
        nodeId: child.id,
        name: child.name,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
        type: child.type,
      });
    }

    const getLayer = (name: string): LayerSpec => {
      const layer = layerMap.get(name);
      if (!layer) {
        return {
          nodeId: '',
          name,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          type: 'UNKNOWN',
        };
      }
      return layer;
    };

    return {
      background: getLayer('bg_image'),
      logo: getLayer('logo'),
      mainText: getLayer('main_text'),
      subText: getLayer('sub_text'),
      copyright: getLayer('copyright'),
      badgeContainer: getLayer('badge_container'),
    };
  }
}
