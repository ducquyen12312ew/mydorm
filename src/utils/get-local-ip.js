const os = require('os');
const interfaces = os.networkInterfaces();

/**
 * Get the local LAN IP address (not localhost)
 * Tries to find IPv4 address that's not 127.0.0.1
 */
function getLocalIP() {
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  // Fallback to localhost if no external IP found
  return 'localhost';
}

module.exports = { getLocalIP };
