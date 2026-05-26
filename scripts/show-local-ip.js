#!/usr/bin/env node

/**
 * Helper script to display your local IP address
 * Run: node scripts/show-local-ip.js
 */

const { getLocalIP } = require('../src/utils/get-local-ip');

const ip = getLocalIP();
console.log('\n' + '='.repeat(60));
console.log('LOCAL NETWORK IP ADDRESS');
console.log('='.repeat(60));
console.log(`📱 Your machine IP: ${ip}:5000`);
console.log(`🌐 API URL for mobile: http://${ip}:5000/api/student-app`);
console.log('\nSet this in mobile-expo/.env:');
console.log(`EXPO_PUBLIC_API_URL=http://${ip}:5000/api/student-app`);
console.log(`EXPO_PUBLIC_SOCKET_URL=http://${ip}:5000`);
console.log('='.repeat(60) + '\n');
