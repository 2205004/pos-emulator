const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const path = require("path");

// -------------------------
// HTTP сервер для UI
// -------------------------

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "public")));

server.listen(8080, () => {
    console.log("Web UI running on http://localhost:8080");
});

// -------------------------
// WebSocket сервер (емулятор POS)
// -------------------------

const wss = new WebSocket.Server({
    host: "192.168.0.222",
    port: 2000
});

console.log("POS emulator running at ws://192.168.0.222:2000");

// Передаємо лог у веб-інтерфейс
let uiSockets = [];

const uiServer = new WebSocket.Server({ server });
uiServer.on("connection", (ws) => {
    uiSockets.push(ws);
    ws.on("close", () => uiSockets = uiSockets.filter(c => c !== ws));
});

function uiLog(msg) {
    uiSockets.forEach(ws => ws.send(msg));
}

function sendJSON(ws, obj, extraNullFirst = false) {
    let json = JSON.stringify(obj);
    let buffer = Buffer.from(json + "\x00");

    if (extraNullFirst)
        buffer = Buffer.concat([Buffer.from([0x00]), buffer]);

    ws.send(buffer);

    uiLog("<<< RESPONSE:\n" + json);
}

wss.on("connection", (ws) => {
    uiLog("=== КЛІЄНТ ПІДКЛЮЧИВСЯ ===");

    ws.on("message", (raw) => {
        const msg = raw.toString().replace(/\0/g, "");
        uiLog(">>> REQUEST:\n" + msg);

        let data;
        try { data = JSON.parse(msg); }
        catch (e) { return; }

        switch (data.method) {

            // ---------------------------
            // PING DEVICE
            // ---------------------------

            case "PingDevice":
                sendJSON(ws, {
                    method: "PingDevice",
                    step: 0,
                    params: { code: "00", responseCode: "0000" },
                    error: false,
                    errorDescription: ""
                });
                break;

            // ---------------------------
            // IDENTIFY
            // ---------------------------

            case "ServiceMessage":
                if (data.params?.msgType === "identify") {
                    sendJSON(ws, {
                        method: "ServiceMessage",
                        step: 0,
                        params: {
                            msgType: "identify",
                            result: "true",
                            vendor: "PAX",
                            model: "s800"
                        },
                        error: false,
                        errorDescription: ""
                    });
                }
                break;

            // ---------------------------
            // PURCHASE
            // ---------------------------

            case "Purchase":
                sendJSON(ws, {
                    method: "Purchase",
                    step: 0,
                    params: {
                        amount: data.params.amount,
                        approvalCode: "999999",
                        responseCode: "0000",
                        rrn: Date.now().toString(),
                        receipt: "TEST RECEIPT\nSUCCESS"
                    },
                    error: false,
                    errorDescription: ""
                });
                break;

            // ---------------------------
            // UNKNOWN METHOD
            // ---------------------------

            default:
                sendJSON(ws, {
                    method: "ServiceMessage",
                    step: 0,
                    params: { msgType: "methodNotImplemented" },
                    error: false,
                    errorDescription: ""
                });
        }
    });

    ws.on("close", () => uiLog("=== КЛІЄНТ ВІДКЛЮЧИВСЯ ==="));
});
