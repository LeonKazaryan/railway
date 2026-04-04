import { Client } from "@stomp/stompjs";

function brokerUrl(): string {
  const wsEnv = import.meta.env.VITE_WS_URL as string | undefined;
  if (wsEnv) return wsEnv;
  const api = import.meta.env.VITE_API_URL as string | undefined;
  if (api && /^https?:\/\//.test(api)) {
    try {
      const u = new URL(api);
      const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProto}//${u.host}/ws`;
    } catch {
      /* fall through */
    }
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

let client: Client | null = null;

export function getStompClient(): Client {
  if (client) return client;

  client = new Client({
    brokerURL: brokerUrl(),
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  });

  return client;
}

export function getStompBrokerUrlForDebug(): string {
  return brokerUrl();
}
