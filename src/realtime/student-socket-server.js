const { Server } = require('socket.io');
const { getStudentDashboard } = require('../services/studentMobileService');
const { registerDomainEventBridge } = require('./register-domain-event-bridge');
const { verifyMobileAccessToken } = require('../auth/mobileTokenService');
const { attachRedisAdapter } = require('./redis-adapter');

function setupStudentSocketServer(httpServer, sessionMiddleware) {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true
    },
    path: '/socket.io'
  });

  io.engine.use(sessionMiddleware);

  io.use((socket, next) => {
    const req = socket.request;
    if (req.session && req.session.userId) {
      socket.data.userId = String(req.session.userId);
      return next();
    }

    const rawToken = socket.handshake?.auth?.token || '';
    const token = String(rawToken).replace(/^Bearer\s+/i, '');
    if (token) {
      try {
        const payload = verifyMobileAccessToken(token);
        socket.data.userId = String(payload.sub);
        return next();
      } catch (_) {
        return next(new Error('Unauthorized'));
      }
    }

    return next(new Error('Unauthorized'));
  });

  registerDomainEventBridge(io);
  attachRedisAdapter(io).catch((error) => {
    console.error('Failed to attach Redis adapter', error);
  });

  io.on('connection', async (socket) => {
    const req = socket.request;
    const userId = String(socket.data.userId || req.session?.userId || '');
    const role = req.session?.role || '';

    // Admin connections join the shared admin room for realtime dashboard
    if (role === 'admin') {
      socket.join('admin');
      socket.on('admin:dashboard:subscribe', () => {
        socket.join('admin');
      });
      return; // Admins don't need student dashboard push
    }

    socket.join(`student:${userId}`);

    const pushDashboard = async () => {
      const dashboard = await getStudentDashboard(userId);
      socket.emit('student:dashboard', dashboard);
    };

    await pushDashboard();

    socket.on('student:refresh', async () => {
      await pushDashboard();
    });

    socket.on('student:dashboard:request', async () => {
      await pushDashboard();
    });
  });

  return io;
}

function emitStudentEvent(io, studentId, eventName, payload) {
  if (!io) return;
  io.to(`student:${String(studentId)}`).emit(eventName, payload);
}

function emitAdminEvent(io, eventName, payload) {
  if (!io) return;
  io.to('admin').emit(eventName, payload);
}

module.exports = {
  setupStudentSocketServer,
  emitStudentEvent,
  emitAdminEvent
};
