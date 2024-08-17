const WebSocket = require('ws');

// Tạo một WebSocket Server lắng nghe trên cổng 8080
const wss = new WebSocket.Server({ port: 8080 });

// Sự kiện kết nối từ client
wss.on('connection', (ws) => {
    console.log('Client connected');

    // Xử lý tin nhắn từ client
    ws.on('message', (message) => {
        console.log(`Received message: ${message}`);
    });

    // Xử lý khi client ngắt kết nối
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Hàm gửi thông báo cho tất cả các client khi email được xác nhận
function notifyEmailConfirmed(token) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'EMAIL_CONFIRMED', token }));
        }
    });
}

module.exports = { notifyEmailConfirmed };
