/**
 * Figma REST API 클라이언트
 * access token을 사용하여 Figma REST API를 호출한다.
 */

export interface FigmaFrame {
  name: string;
  nodeId: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

/**
 * Figma 파일의 최상위 프레임 목록을 조회한다.
 * 모든 페이지(Canvas)를 탐색하여 FRAME 타입 노드를 반환한다.
 */
export async function getTopLevelFrames(
  fileKey: string,
  accessToken: string,
): Promise<FigmaFrame[]> {
  const { frames } = await getTopLevelFramesDebug(fileKey, accessToken);
  return frames;
}

/**
 * 디버그용: Figma API 응답 원본 구조를 함께 반환한다.
 * Rate Limit 에러 시 자동으로 재시도한다.
 */
export async function getTopLevelFramesDebug(
  fileKey: string,
  accessToken: string,
  retryCount = 0,
  maxRetries = 3,
): Promise<{ frames: FigmaFrame[]; debug: object }> {
  console.log('[Figma API] 파일 조회 시작:', fileKey, retryCount > 0 ? `(재시도 ${retryCount}/${maxRetries})` : '');
  
  const url = `https://api.figma.com/v1/files/${fileKey}?depth=2`;
  console.log('[Figma API] URL:', url);
  
  const response = await fetch(url, {
    headers: { 'X-Figma-Token': accessToken },
  });

  console.log('[Figma API] 응답 상태:', response.status, response.statusText);

  // Rate Limit 에러 처리
  if (response.status === 429 && retryCount < maxRetries) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    const waitTime = Math.min(retryAfter * 1000, 60000); // 최대 60초
    console.log(`[Figma API] Rate Limit 초과. ${waitTime / 1000}초 후 재시도...`);
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return getTopLevelFramesDebug(fileKey, accessToken, retryCount + 1, maxRetries);
  }

  if (!response.ok) {
    const text = await response.text();
    console.error('[Figma API] 오류 응답:', text);
    
    if (response.status === 429) {
      throw new Error(`Figma API Rate Limit 초과. 잠시 후 다시 시도해주세요.`);
    }
    
    throw new Error(`Figma API 오류 (${response.status}): ${text}`);
  }

  const data = await response.json();
  console.log('[Figma API] 응답 데이터 구조:', {
    hasDocument: !!data.document,
    documentName: data.document?.name,
    childrenCount: data.document?.children?.length,
  });

  const pages: FigmaNode[] = data.document?.children ?? [];

  // 디버그: 각 페이지와 그 자식 노드 타입/이름을 기록
  const debugPages = pages.map((page) => ({
    pageId: page.id,
    pageName: page.name,
    childCount: page.children?.length ?? 0,
    children: (page.children ?? []).map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
    })),
  }));

  console.log('[Figma API] 페이지 정보:', debugPages);

  // 모든 페이지에서 FRAME 타입 노드를 수집한다
  const frames: FigmaFrame[] = [];
  for (const page of pages) {
    for (const node of page.children ?? []) {
      if (node.type === 'FRAME') {
        frames.push({ name: `${page.name} / ${node.name}`, nodeId: node.id });
      }
    }
  }

  console.log('[Figma API] 발견된 프레임:', frames.length, '개');

  return {
    frames,
    debug: {
      documentName: data.document?.name,
      pageCount: pages.length,
      pages: debugPages,
      framesFound: frames.length,
    },
  };
}

/**
 * 특정 노드의 직계 자식 레이어 이름 목록을 조회한다.
 * 템플릿 검증을 위해 최상위 레이어만 반환한다.
 */
export async function getFrameChildrenNames(
  fileKey: string,
  nodeId: string,
  accessToken: string,
): Promise<string[]> {
  console.log('[Figma API] 프레임 자식 레이어 조회 시작:', nodeId);
  
  const response = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&depth=1`,
    {
      headers: { 'X-Figma-Token': accessToken },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error('[Figma API] 레이어 조회 오류:', text);
    throw new Error(`Figma API 오류 (${response.status}): ${text}`);
  }

  const data = await response.json();
  const nodeData = data.nodes?.[nodeId];

  if (!nodeData?.document?.children) {
    console.warn('[Figma API] 프레임에 자식 레이어가 없음');
    return [];
  }

  // 최상위 레이어 이름만 수집 (재귀 탐색 제거)
  const names: string[] = nodeData.document.children.map((node: FigmaNode) => node.name);
  
  console.log('[Figma API] 발견된 최상위 레이어:', names);
  return names;
}
