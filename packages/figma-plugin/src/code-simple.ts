// Minimal plugin code without complex HTML
console.log('[Plugin] Starting...');

// Create minimal UI without template literals
const htmlParts = [
  '<!DOCTYPE html>',
  '<html><head><meta charset="UTF-8"></head>',
  '<body style="margin:0;padding:8px;font-family:sans-serif;background:#1a1a1a;color:#fff;">',
  '<div id="status">Connecting...</div>',
  '<script>',
  'var ws=null;',
  'function connect(){',
  'try{',
  'ws=new WebSocket("ws://localhost:3000/ws");',
  'ws.onopen=function(){document.getElementById("status").textContent="Connected";};',
  'ws.onmessage=function(e){',
  'try{var msg=JSON.parse(e.data);parent.postMessage({pluginMessage:msg},"*");}catch(err){}',
  '};',
  'ws.onclose=function(){document.getElementById("status").textContent="Disconnected";ws=null;setTimeout(connect,3000);};',
  '}catch(err){setTimeout(connect,3000);}',
  '}',
  'window.onmessage=function(e){',
  'var msg=e.data&&e.data.pluginMessage;',
  'if(msg&&ws&&ws.readyState===1){ws.send(JSON.stringify(msg));}',
  '};',
  'connect();',
  '</script>',
  '</body></html>'
];

figma.showUI(htmlParts.join(''), { visible: false, width: 1, height: 1 });

console.log('[Plugin] UI initialized');

// Helper functions
function findChildByName(node: BaseNode & ChildrenMixin, name: string): SceneNode | null {
  for (const child of node.children) {
    if (child.name === name) return child;
    if ('children' in child) {
      const found = findChildByName(child as BaseNode & ChildrenMixin, name);
      if (found) return found;
    }
  }
  return null;
}

function base64ToUint8Array(base64: string): Uint8Array {
  return figma.base64Decode(base64);
}

// Command handlers
async function handleCloneFrame(params: any): Promise<any> {
  const node = figma.getNodeById(params.templateNodeId);
  if (!node || !('clone' in node)) {
    throw new Error('Cannot clone node: ' + params.templateNodeId);
  }
  
  const clone = (node as SceneNode).clone();
  
  if ('x' in node && 'width' in node) {
    const original = node as SceneNode & { x: number; width: number };
    clone.x = original.x + original.width + 50;
  }
  
  return { frameId: clone.id };
}

async function handleSetText(params: any): Promise<void> {
  const frame = figma.getNodeById(params.frameId);
  if (!frame || !('children' in frame)) {
    throw new Error('Frame not found: ' + params.frameId);
  }
  
  const child = findChildByName(frame as BaseNode & ChildrenMixin, params.layerName);
  if (!child || child.type !== 'TEXT') {
    throw new Error('Text layer not found: ' + params.layerName);
  }
  
  const textNode = child as TextNode;
  const fontNames = textNode.getRangeAllFontNames(0, textNode.characters.length);
  for (const font of fontNames) {
    await figma.loadFontAsync(font);
  }
  
  textNode.characters = params.text;
}

async function handleHideLayer(params: any): Promise<void> {
  const frame = figma.getNodeById(params.frameId);
  if (!frame || !('children' in frame)) {
    throw new Error('Frame not found: ' + params.frameId);
  }
  
  const child = findChildByName(frame as BaseNode & ChildrenMixin, params.layerName);
  if (!child) {
    throw new Error('Layer not found: ' + params.layerName);
  }
  
  child.visible = false;
}

async function handleReplaceImage(params: any): Promise<void> {
  const frame = figma.getNodeById(params.frameId);
  if (!frame || !('children' in frame)) {
    throw new Error('Frame not found: ' + params.frameId);
  }
  
  const child = findChildByName(frame as BaseNode & ChildrenMixin, params.layerName);
  if (!child || !('fills' in child)) {
    throw new Error('Cannot set image on layer: ' + params.layerName);
  }
  
  const imageBytes = base64ToUint8Array(params.imageBase64);
  const image = figma.createImage(imageBytes);
  
  const fillableNode = child as GeometryMixin;
  fillableNode.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
}

async function handleSwitchBadgeVariant(params: any): Promise<void> {
  const frame = figma.getNodeById(params.frameId);
  if (!frame || !('children' in frame)) {
    throw new Error('Frame not found: ' + params.frameId);
  }
  
  const badgeContainer = findChildByName(frame as BaseNode & ChildrenMixin, 'badge_container');
  if (!badgeContainer) {
    throw new Error('badge_container not found');
  }
  
  if (params.count === 0) {
    badgeContainer.visible = false;
    return;
  }
  
  badgeContainer.visible = true;
  
  if (badgeContainer.type === 'INSTANCE') {
    const instance = badgeContainer as InstanceNode;
    try {
      instance.setProperties({ count: String(params.count) });
    } catch (e) {
      console.warn('Failed to set badge variant:', e);
    }
  }
  
  if ('children' in badgeContainer) {
    const container = badgeContainer as BaseNode & ChildrenMixin;
    for (let i = 1; i <= 4; i++) {
      const badgeSlot = findChildByName(container, 'badge_' + i);
      if (!badgeSlot) continue;
      
      const badge = params.badges.find(function(b: any) { return b.position === i; });
      if (badge) {
        badgeSlot.visible = true;
        if (badgeSlot.type === 'TEXT') {
          const textNode = badgeSlot as TextNode;
          const fonts = textNode.getRangeAllFontNames(0, textNode.characters.length);
          for (const font of fonts) {
            await figma.loadFontAsync(font);
          }
          textNode.characters = badge.name;
        }
      } else {
        badgeSlot.visible = false;
      }
    }
  }
}

async function handleCheckOverflow(params: any): Promise<any> {
  const frame = figma.getNodeById(params.frameId);
  if (!frame || !('children' in frame)) {
    throw new Error('Frame not found: ' + params.frameId);
  }
  
  const child = findChildByName(frame as BaseNode & ChildrenMixin, params.layerName);
  if (!child) {
    throw new Error('Layer not found: ' + params.layerName);
  }
  
  const textNode = child as SceneNode;
  
  // 텍스트 노드의 직접 부모를 찾기 (더 정확한 오버플로우 검증)
  const parentNode = textNode.parent as SceneNode;
  
  const textBox = textNode.absoluteBoundingBox;
  const parentBox = parentNode.absoluteBoundingBox;
  
  if (!textBox || !parentBox) {
    throw new Error('Cannot get bounding box');
  }
  
  // 허용 오차: 5픽셀까지는 정상으로 간주
  const TOLERANCE = 5;
  
  // 오른쪽 오버플로우
  const overflowRight = Math.max(0, (textBox.x + textBox.width) - (parentBox.x + parentBox.width) - TOLERANCE);
  // 왼쪽 오버플로우
  const overflowLeft = Math.max(0, parentBox.x - textBox.x - TOLERANCE);
  // 아래쪽 오버플로우
  const overflowBottom = Math.max(0, (textBox.y + textBox.height) - (parentBox.y + parentBox.height) - TOLERANCE);
  // 위쪽 오버플로우
  const overflowTop = Math.max(0, parentBox.y - textBox.y - TOLERANCE);
  
  const overflowX = overflowRight + overflowLeft;
  const overflowY = overflowBottom + overflowTop;
  
  console.log('[Plugin] Overflow check:', {
    layerName: params.layerName,
    textBox: textBox,
    parentBox: parentBox,
    overflowX: overflowX,
    overflowY: overflowY,
    isOverflowing: overflowX > 0 || overflowY > 0
  });
  
  return {
    isOverflowing: overflowX > 0 || overflowY > 0,
    textBounds: { x: textBox.x, y: textBox.y, width: textBox.width, height: textBox.height },
    parentBounds: { x: parentBox.x, y: parentBox.y, width: parentBox.width, height: parentBox.height },
    overflowX: overflowX,
    overflowY: overflowY
  };
}

async function handleDeleteFrames(params: any): Promise<void> {
  for (const id of params.frameIds) {
    const node = figma.getNodeById(id);
    if (node && 'remove' in node) {
      (node as SceneNode).remove();
    }
  }
}

async function handleGetTemplateSpec(params: any): Promise<any> {
  const node = figma.getNodeById(params.templateNodeId);
  if (!node || !('children' in node)) {
    throw new Error('Template node not found or has no children: ' + params.templateNodeId);
  }
  
  const frame = node as BaseNode & ChildrenMixin;
  const layerMap: any = {};
  
  function extractLayer(child: SceneNode) {
    const bbox = child.absoluteBoundingBox || { x: 0, y: 0, width: 0, height: 0 };
    return {
      nodeId: child.id,
      name: child.name,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      type: child.type
    };
  }
  
  for (const child of frame.children) {
    layerMap[child.name] = extractLayer(child as SceneNode);
  }
  
  const getLayer = (name: string) => {
    return layerMap[name] || {
      nodeId: '',
      name: name,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      type: 'UNKNOWN'
    };
  };
  
  return {
    layers: {
      background: getLayer('bg_image'),
      logo: getLayer('logo'),
      mainText: getLayer('main_text'),
      subText: getLayer('sub_text'),
      copyright: getLayer('copyright'),
      badgeContainer: getLayer('badge_container')
    }
  };
}

// Message router
figma.ui.onmessage = async function(msg: any) {
  const id = msg.id;
  const command = msg.command;
  const params = msg.params;
  
  function respond(response: any) {
    figma.ui.postMessage(response);
  }
  
  try {
    let result: any;
    
    if (command === 'clone-frame') {
      result = await handleCloneFrame(params);
    } else if (command === 'set-text') {
      result = await handleSetText(params);
    } else if (command === 'hide-layer') {
      result = await handleHideLayer(params);
    } else if (command === 'replace-image') {
      result = await handleReplaceImage(params);
    } else if (command === 'switch-badge-variant') {
      result = await handleSwitchBadgeVariant(params);
    } else if (command === 'check-overflow') {
      result = await handleCheckOverflow(params);
    } else if (command === 'delete-frames') {
      result = await handleDeleteFrames(params);
    } else if (command === 'get-template-spec') {
      result = await handleGetTemplateSpec(params);
    } else {
      respond({ id: id, error: 'Unknown command: ' + command });
      return;
    }
    
    respond({ id: id, result: result !== null && result !== undefined ? result : null });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    respond({ id: id, error: message });
  }
};

console.log('[Plugin] Message handler registered');
