import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { log } from "@/utils/helpers";
import { HEARTBEAT, MESSAGE_EVENTS, WS_URL, peer } from "@/utils/constants";
import { addMessage, clearMessages } from "@/features/messaging/messagingSlice";
import {
  setError,
  setLoading,
  setReady,
  setStarted,
  setOnlineUsersCount,
  setWaitingForMatch,
} from "@/features/main/mainSlice";

export default function usePeer() {
  const ready = useSelector((state) => state.main.ready);
  const dispatch = useDispatch();
  const [myPeerId, setMyPeerId] = useState();

  const localStream = useRef();
  const remoteStream = useRef();

  const peerConnectionRef = useRef();
  const dataConnectionRef = useRef();
  const mediaConnectionRef = useRef();

  const { sendMessage, lastMessage, readyState } = useWebSocket(WS_URL, {
    heartbeat: HEARTBEAT,
    onError: (e) => {
      dispatch(setError("WEBSOCKET_CONNECTION_ERROR"));
    },
  });

  useEffect(() => {
    peer.on("open", (id) => {
      log("Peer open with ID:", id);
      setMyPeerId(id);

      if (readyState !== ReadyState.CLOSED) {
        dispatch(setReady(true));
      } else {
        dispatch(setError("WEBSOCKET_CLOSED_ERROR"));
      }
    });

    peer.on("connection", (conn) => {
      log("Peer Connected with:", conn.peer);
      peerConnectionRef.current = conn;
    });

    peer.on("close", () => {
      log("Peer closed");
    });

    peer.on("error", (err) => {
      log("Peer error:", err.type, err.message);
      dispatch(setError("PEER_CONNECTION_ERROR"));
    });
  }, []);

  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        const { event, id, isCaller, onlineUsersCount } = data;

        log("WebSocket message received:", data);

        if (onlineUsersCount) {
          dispatch(setOnlineUsersCount(onlineUsersCount));
          return;
        }

        if (event === MESSAGE_EVENTS.MATCH) {
          dispatch(setWaitingForMatch(false));
          log("Match found with peer ID:", id);

          try {
            const dataConnection = peer.connect(id);

            dataConnection.on("error", (err) => {
              log("Data connection error:", err);
              dispatch(setError("DATA_CONNECTION_ERROR"));
            });

            if (isCaller) {
              log("Calling peer:", id);
              try {
                if (!localStream.current || !localStream.current.srcObject) {
                  log("Local stream not available for call");
                  dispatch(setError("MEDIA_STREAM_UNAVAILABLE"));
                  return;
                }

                const call = peer.call(id, localStream.current.srcObject);

                call.on("stream", (stream) => {
                  log("Remote stream received");
                  remoteStream.current.srcObject = stream;
                });

                call.on("close", () => {
                  log("Call closed");
                });

                call.on("error", (err) => {
                  log("Media connection error:", err);
                  dispatch(setError("MEDIA_CONNECTION_ERROR"));
                });

                mediaConnectionRef.current = call;
              } catch (err) {
                log("Error making call:", err);
                dispatch(setError("CALL_INITIATION_ERROR"));
              }
            }

            peer.on("call", (call) => {
              log("Received call from:", call.peer);
              try {
                if (!localStream.current || !localStream.current.srcObject) {
                  log("Local stream not available for answer");
                  dispatch(setError("MEDIA_STREAM_UNAVAILABLE"));
                  return;
                }

                call.answer(localStream.current.srcObject);

                call.on("stream", (stream) => {
                  log("Remote stream received from answer");
                  remoteStream.current.srcObject = stream;
                });

                call.on("close", () => {
                  log("Remote Call closed");
                });

                call.on("error", (err) => {
                  log("Call error:", err);
                  dispatch(setError("CALL_ERROR"));
                });
              } catch (err) {
                log("Error answering call:", err);
                dispatch(setError("ANSWER_CALL_ERROR"));
              }
            });

            dataConnection.on("open", () => {
              log("Connection open");
            });

            dataConnection.on("data", (data) => {
              const message = {
                text: data,
                isMine: false,
              };
              dispatch(addMessage(message));
            });

            dataConnection.on("close", () => {
              log("Connection closed");
              dispatch(clearMessages());
              sendMessage(
                JSON.stringify({ event: MESSAGE_EVENTS.SKIP, id: myPeerId })
              );
            });

            dataConnectionRef.current = dataConnection;
          } catch (err) {
            log("Error connecting to peer:", err);
            dispatch(setError("PEER_CONNECTION_ERROR"));
          }
        }

        if (event === MESSAGE_EVENTS.WAITING) {
          log("Waiting for a match...");

          if (remoteStream.current.srcObject) {
            remoteStream.current.srcObject = null;
          }
          dispatch(setWaitingForMatch(true));
        }
      } catch (err) {
        log("Error parsing message:", err);
        dispatch(setError("MESSAGE_PARSE_ERROR"));
      }
    }
  }, [lastMessage]);

  async function startVideoStream() {
    dispatch(setLoading(true));
    try {
      log("Requesting user media...");
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      log("User media obtained successfully");
      localStream.current.srcObject = videoStream;

      return new Promise((resolve) => {
        setTimeout(() => {
          if (localStream.current && localStream.current.srcObject) {
            log("Local stream initialized successfully");
            dispatch(setLoading(false));
            dispatch(setStarted(true));
            resolve(true);
          } else {
            log("Failed to initialize local stream");
            dispatch(setError("MEDIA_STREAM_INITIALIZATION_ERROR"));
            resolve(false);
          }
        }, 1000);
      });
    } catch (error) {
      log("Error getting user media:", error.name, error.message);
      dispatch(setError("MEDIA_STREAM_ERROR"));
      dispatch(setLoading(false));
      return false;
    }
  }

  const join = async () => {
    if (!ready) {
      log("Not ready to join - WebSocket or Peer not initialized");
      dispatch(setError("NOT_READY_ERROR"));
      return;
    }

    const streamInitialized = await startVideoStream();

    if (streamInitialized && readyState === ReadyState.OPEN) {
      log("Joining with peer ID:", myPeerId);
      sendMessage(JSON.stringify({ event: MESSAGE_EVENTS.JOIN, id: myPeerId }));
    } else {
      log("Failed to join - stream not initialized or WebSocket not open");
      dispatch(setError("JOIN_FAILED_ERROR"));
    }
  };

  const skip = () => {
    peerConnectionRef.current?.close();
    mediaConnectionRef?.current?.close();
    dataConnectionRef.current?.close();
    log("Skipped");
  };

  const send = (e) => {
    e.preventDefault();
    if (!e.target[0].value) return;

    const message = {
      text: e.target[0].value,
      isMine: true,
    };

    e.target[0].value = "";

    if (!peerConnectionRef.current) return;
    peerConnectionRef.current?.send(message.text);
    dispatch(addMessage(message));
  };

  const end = () => {
    window.location.reload();
  };

  return { remoteStream, localStream, join, skip, send, end };
}
