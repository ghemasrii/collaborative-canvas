import express from 'express';
import http from 'http';
import path from 'path';
import WebSocket from 'ws';
import { RoomManager } from './rooms';
import { DrawingAction, Point } from './drawing-state';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const roomManager = new RoomManager();

app.use('/dist/client', express.static(path.join(__dirname, '../client')));
app.use(express.static(path.join(__dirname, '../../client')));
app.use(express.static(path.join(__dirname, '../client')));

app.get('*', (req, res) => {
  const clientPath = path.join(__dirname, '../../client/index.html');
  const distClientPath = path.join(__dirname, '../client/index.html');

  if (require('fs').existsSync(clientPath)) {
    res.sendFile(clientPath);
  } else if (require('fs').existsSync(distClientPath)) {
    res.sendFile(distClientPath);
  } else {
    res.send('Collaborative Canvas Server Running');
  }
});

interface ActiveStroke {
  id: string;
  userId: string;
  tool: any;
  color: string;
  fillColor?: string;
  fillStyle?: any;
  dashStyle?: any;
  sloppiness?: any;
  strokeWidth: number;
  points: Point[];
  text?: string;
  noteColor?: string;
  timestamp: number;
}

const activeStrokes = new Map<string, ActiveStroke>();

wss.on('connection', (ws: WebSocket) => {
  let userSession: ReturnType<RoomManager['createUserSession']> | null = null;

  ws.on('message', (rawMessage: WebSocket.RawData) => {
    try {
      const data = JSON.parse(rawMessage.toString());
      const { type } = data;

      if (type === 'JOIN_ROOM') {
        const roomId = data.roomId || 'default';
        userSession = roomManager.createUserSession(ws, roomId, data.userName);
        const room = roomManager.getOrCreateRoom(roomId);

        ws.send(
          JSON.stringify({
            type: 'INIT_STATE',
            user: {
              id: userSession.id,
              name: userSession.name,
              color: userSession.color
            },
            roomId,
            onlineUsers: roomManager.getUsersInRoom(roomId),
            actions: room.state.getActiveActions()
          })
        );

        roomManager.broadcastToRoom(
          roomId,
          {
            type: 'USER_JOINED',
            user: {
              id: userSession.id,
              name: userSession.name,
              color: userSession.color
            },
            onlineUsers: roomManager.getUsersInRoom(roomId)
          },
          userSession.id
        );
        return;
      }

      if (!userSession) return;
      const { roomId } = userSession;
      const room = roomManager.getOrCreateRoom(roomId);

      switch (type) {
        case 'PING':
          ws.send(JSON.stringify({ type: 'PONG', timestamp: data.timestamp }));
          break;

        case 'CURSOR_MOVE':
          userSession.cursor = { x: data.x, y: data.y };
          roomManager.broadcastToRoom(
            roomId,
            {
              type: 'CURSOR_MOVE',
              userId: userSession.id,
              userName: userSession.name,
              userColor: userSession.color,
              x: data.x,
              y: data.y
            },
            userSession.id
          );
          break;

        case 'DRAW_START': {
          const strokeId = data.actionId;
          const stroke: ActiveStroke = {
            id: strokeId,
            userId: userSession.id,
            tool: data.tool,
            color: data.color,
            fillColor: data.fillColor,
            fillStyle: data.fillStyle,
            dashStyle: data.dashStyle,
            sloppiness: data.sloppiness,
            strokeWidth: data.strokeWidth,
            points: [data.point],
            text: data.text,
            noteColor: data.noteColor,
            timestamp: Date.now()
          };
          activeStrokes.set(strokeId, stroke);

          roomManager.broadcastToRoom(
            roomId,
            {
              type: 'DRAW_START',
              actionId: strokeId,
              userId: userSession.id,
              userName: userSession.name,
              userColor: userSession.color,
              tool: data.tool,
              color: data.color,
              fillColor: data.fillColor,
              fillStyle: data.fillStyle,
              dashStyle: data.dashStyle,
              sloppiness: data.sloppiness,
              strokeWidth: data.strokeWidth,
              point: data.point,
              text: data.text,
              noteColor: data.noteColor
            },
            userSession.id
          );
          break;
        }

        case 'DRAW_MOVE': {
          const strokeId = data.actionId;
          const stroke = activeStrokes.get(strokeId);
          if (stroke) {
            stroke.points.push(data.point);
          }

          roomManager.broadcastToRoom(
            roomId,
            {
              type: 'DRAW_MOVE',
              actionId: strokeId,
              userId: userSession.id,
              point: data.point
            },
            userSession.id
          );
          break;
        }

        case 'DRAW_END': {
          const strokeId = data.actionId;
          const stroke = activeStrokes.get(strokeId);

          const finalPoints = data.points || (stroke ? stroke.points : []);
          const finalAction: DrawingAction = {
            id: strokeId,
            userId: userSession.id,
            userName: userSession.name,
            userColor: userSession.color,
            tool: data.tool || (stroke ? stroke.tool : 'brush'),
            color: data.color || (stroke ? stroke.color : '#1e293b'),
            fillColor: data.fillColor || (stroke ? stroke.fillColor : 'transparent'),
            fillStyle: data.fillStyle || (stroke ? stroke.fillStyle : 'none'),
            dashStyle: data.dashStyle || (stroke ? stroke.dashStyle : 'solid'),
            sloppiness: data.sloppiness || (stroke ? stroke.sloppiness : 'artist'),
            strokeWidth: data.strokeWidth || (stroke ? stroke.strokeWidth : 3),
            points: finalPoints,
            text: data.text || (stroke ? stroke.text : undefined),
            noteColor: data.noteColor || (stroke ? stroke.noteColor : undefined),
            timestamp: Date.now(),
            undone: false
          };

          room.state.addAction(finalAction);
          activeStrokes.delete(strokeId);

          roomManager.broadcastToRoom(roomId, {
            type: 'DRAW_END',
            action: finalAction
          });
          break;
        }

        case 'MOVE_ACTION': {
          const updated = room.state.updateActionPosition(data.actionId, data.deltaX, data.deltaY);
          if (updated) {
            roomManager.broadcastToRoom(roomId, {
              type: 'STATE_MUTATED',
              actionType: 'move',
              mutatedBy: userSession.name,
              actions: room.state.getActiveActions()
            });
          }
          break;
        }

        case 'UNDO': {
          const undoneAction = room.state.undoAction(userSession.id);
          if (undoneAction) {
            roomManager.broadcastToRoom(roomId, {
              type: 'STATE_MUTATED',
              actionType: 'undo',
              mutatedBy: userSession.name,
              actions: room.state.getActiveActions()
            });
          }
          break;
        }

        case 'REDO': {
          const redoneAction = room.state.redoAction(userSession.id);
          if (redoneAction) {
            roomManager.broadcastToRoom(roomId, {
              type: 'STATE_MUTATED',
              actionType: 'redo',
              mutatedBy: userSession.name,
              actions: room.state.getActiveActions()
            });
          }
          break;
        }

        case 'CLEAR_CANVAS': {
          room.state.clear();
          roomManager.broadcastToRoom(roomId, {
            type: 'STATE_MUTATED',
            actionType: 'clear',
            mutatedBy: userSession.name,
            actions: []
          });
          break;
        }
      }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    if (userSession) {
      const { id, name, roomId } = userSession;
      roomManager.removeUserSession(id, roomId);
      roomManager.broadcastToRoom(roomId, {
        type: 'USER_LEFT',
        userId: id,
        userName: name,
        onlineUsers: roomManager.getUsersInRoom(roomId)
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🎨 Excalidraw-Style Collaborative Canvas Server running on port ${PORT}`);
  console.log(`👉 Open http://localhost:${PORT} in your browser`);
  console.log(`=================================================`);
});
