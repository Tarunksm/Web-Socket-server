import "dotenv/config.js";
import { WebSocket, WebSocketServer } from "ws";
import type { ServerEvent, ClientEvent } from "../../shared/message.js";
import prisma from "./lib/prisma.js";
import { randomUUID } from "node:crypto";

const port = Number(process.env.PORT || 8080);

const wss = new WebSocketServer({ port });

console.log(`Websocket server is running on port ${port}`);

const users = new Map<
  WebSocket,
  {
    userId: string;
    username: string;
  }
>();

function broadcast(message: ServerEvent, sender: WebSocket) {
  wss.clients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function sendError(socket: WebSocket, message: string) {
  socket.send(
    JSON.stringify({
      type: "error",
      message,
      id: randomUUID(),
    }),
  );
}

wss.on("connection", async (socket) => {
  console.log("Client connected");

  const welcome: ServerEvent = {
    type: "welcome",
    message: "Welcome to Chat App!",
    id: randomUUID(),
  };

  const checkHistory = async () => {
    const messageHistory = await prisma.message.findMany({
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    const getMessages = messageHistory.map((message) => ({
      type: "chat" as const,
      id: message.id,
      username: message.user.name,
      message: message.content,
    }));
    return getMessages;
  };

  socket.on("message", async (message) => {
    try {
      const data: ClientEvent = JSON.parse(message.toString());

      if (data.type !== "chat" && data.type !== "join") {
        sendError(socket, "Unknown event type");
        return;
      }

      if (data.type === "join") {
        if (!data.username || !data.userId) {
          sendError(socket, "Invalid event data");
          return;
        }

        if (users.has(socket)) {
          sendError(socket, "Already joined");
          return;
        }

        users.set(socket, {
          userId: data.userId,
          username: data.username,
        });

        console.log(data.username, "joined");

        const userJoined: ServerEvent = {
          type: "user_joined",
          username: data.username,
          id: randomUUID(),
        };

        broadcast(userJoined, socket);
      }

      if (data.type === "chat") {
        if (
          !data.message ||
          typeof data.message !== "string" ||
          data.message.trim() === ""
        ) {
          sendError(socket, "Invalid event data");
          return;
        }

        const user = users.get(socket);

        if (!user) {
          sendError(socket, "You must join before sending messages");
          return;
        }

        const savedMessage = await prisma.message.create({
          data: {
            content: data.message,
            userId: user.userId,
          },
        });

        const chatMessage: ServerEvent = {
          type: "chat",
          id: savedMessage.id,
          username: user.username,
          message: savedMessage.content,
        };

        socket.send(JSON.stringify(chatMessage));

        broadcast(chatMessage, socket);
      }
    } catch (error) {
      console.error(error);
      sendError(socket, "Invalid message format");
    }
  });

  socket.on("close", () => {
    const user = users.get(socket);

    if (!user) {
      return;
    }

    const userLeft: ServerEvent = {
      type: "user_left",
      username: user.username,
      id: randomUUID(),
    };

    broadcast(userLeft, socket);

    users.delete(socket);
  });

  const messageHistory: ServerEvent = {
    type: "message_history",
    messages: await checkHistory(),
    id: randomUUID(),
  };

  socket.send(JSON.stringify(messageHistory));

  socket.send(JSON.stringify(welcome));
});
