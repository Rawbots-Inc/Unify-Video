import Peer from "peerjs";
import { createContext } from "react";

export const debugMode = import.meta.env.VITE_DEBUG_MODE === "true" || false;

export const VideoProvider = createContext();

// Create a more robust PeerJS configuration for production
export const peer = new Peer({
  host: import.meta.env.VITE_PEERJS_HOST || "0.peerjs.com",
  port: import.meta.env.VITE_PEERJS_PORT || 443,
  path: import.meta.env.VITE_PEERJS_PATH || "/",
  secure: import.meta.env.VITE_PEERJS_SECURE !== "false",
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
    iceCandidatePoolSize: 10,
  },
  debug: 3,
});

// Make sure we're using the correct server port from environment variables
const SERVER_PORT = import.meta.env.VITE_SERVER_PORT || 5000;
const CLIENT_PORT = 5173;

// Ensure the WebSocket URL is correctly set for production
export const WS_URL =
  import.meta.env.VITE_WS_REMOTE_URL ||
  window.location.href.replace("http", "ws").replace(CLIENT_PORT, SERVER_PORT);

console.log("WebSocket URL:", WS_URL);
console.log("Debug Mode:", debugMode);

export const HEARTBEAT = {
  message: "ping",
  interval: 58000,
  timeout: 120000,
  returnMessage: "pong",
};

export const MESSAGE_EVENTS = {
  MATCH: "match",
  WAITING: "waiting",
  JOIN: "join",
  SKIP: "skip",
};
