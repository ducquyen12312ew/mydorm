// Test API endpoint
const fetch = require('node-fetch');

async function testAPI() {
    try {
        console.log('Testing /api/admin/applications endpoint...');
        const response = await fetch('http://localhost:5000/api/admin/applications?status=all', {
            headers: {
                'Cookie': 'admin=true' // This won't work, we need proper auth
            }
        });
        
        const data = await response.json();
        console.log('Response status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
    
    process.exit(0);
}

testAPI();
