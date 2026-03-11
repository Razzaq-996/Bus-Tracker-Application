const axios = require('axios');
const jwt = require('jsonwebtoken');

const BASIC_URL = 'http://localhost:5001/api';
const SECRET = 'debug_secret_key_12345';

async function testAdminAPI() {
    try {
        console.log('1. Logging in as Admin...');
        const loginRes = await axios.post(`${BASIC_URL}/auth/login`, {
            username: 'admin',
            password: 'password123'
        });

        const token = loginRes.data.token;
        console.log('Login successful. Token obtained:', token);

        try {
            const decoded = jwt.verify(token, SECRET);
            console.log('Token verified locally:', decoded);
        } catch (err) {
            console.error('Local token verification failed:', err.message);
        }

        const headers = { Authorization: `Bearer ${token}` };

        console.log('2. Testing /admin/dashboard...');
        try {
            const dashRes = await axios.get(`${BASIC_URL}/admin/dashboard`, { headers });
            console.log('Dashboard Data:', dashRes.data);
        } catch (e) {
            console.error('Failed /admin/dashboard:', e.response ? e.response.data : e.message);
        }

        console.log('3. Testing /admin/buses...');
        try {
            const busesRes = await axios.get(`${BASIC_URL}/admin/buses`, { headers });
            console.log('Buses Data:', busesRes.data);
        } catch (e) {
            console.error('Failed /admin/buses:', e.response ? e.response.data : e.message);
        }

        console.log('4. Testing /admin/logs...');
        try {
            const logsRes = await axios.get(`${BASIC_URL}/admin/logs`, { headers });
            console.log('Logs Data:', logsRes.data);
        } catch (e) {
            console.error('Failed /admin/logs:', e.response ? e.response.data : e.message);
        }

        console.log('5. Testing /admin/analytics...');
        try {
            const analyticsRes = await axios.get(`${BASIC_URL}/admin/analytics`, { headers });
            console.log('Analytics Data:', analyticsRes.data);
        } catch (e) {
            console.error('Failed /admin/analytics:', e.response ? e.response.data : e.message);
        }

    } catch (error) {
        console.error('Setup failed:', error);
        if (error.response) {
            console.error('Data:', error.response.data);
            console.error('Status:', error.response.status);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error message:', error.message);
        }
    }
}

testAdminAPI();
