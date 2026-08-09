import * as AppGo from '../../../bindings/luminssh-go/internal/wailsapp/app.js'

function getAppBridge() {
  return AppGo;
}

function createProxyId() {
  return `proxy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeProxyNode(node) {
  const parsedPort = parseInt(String(node?.port ?? '').trim(), 10);
  return {
    id: String(node?.id || createProxyId()).trim(),
    name: String(node?.name || '').trim(),
    type: node?.type === 'http' ? 'http' : 'socks5',
    host: String(node?.host || '').trim(),
    port: Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 1080,
    username: String(node?.username || '').trim(),
    password: String(node?.password || ''),
    updatedAt: Number.isFinite(Number(node?.updatedAt)) && Number(node?.updatedAt) > 0 ? Number(node.updatedAt) : Date.now(),
  };
}

export function normalizeProxyNodes(nodes) {
  if (!Array.isArray(nodes)) {
    return [];
  }
  const seen = new Set();
  const normalized = [];
  nodes.forEach((node) => {
    const nextNode = normalizeProxyNode(node);
    if (!nextNode.host || seen.has(nextNode.id)) {
      return;
    }
    seen.add(nextNode.id);
    normalized.push(nextNode);
  });
  return normalized;
}

export async function getProxyNodes() {
  const bridge = getAppBridge();
  if (!bridge?.GetProxyNodes) {
    return [];
  }
  try {
    return normalizeProxyNodes(await bridge.GetProxyNodes());
  } catch {
    return [];
  }
}

export async function saveProxyNodes(nodes) {
  const normalized = normalizeProxyNodes(nodes);
  const bridge = getAppBridge();
  if (bridge?.SaveProxyNodes) {
    await bridge.SaveProxyNodes(JSON.stringify(normalized));
  }
  return normalized;
}
