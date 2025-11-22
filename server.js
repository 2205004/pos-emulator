// -----------------------------------------------------------------------------
// POS TERMINAL EMULATOR — TCP version (Flutter Compatible)
// Web UI + Logs + Auto IP detect + Correct multiline SSE log
// -----------------------------------------------------------------------------

const net = require("net");
const express = require("express");
const http = require("http");
const os = require("os");
const path = require("path");

const PORT = 2222;

// -----------------------------------------------------------------------------
// WEB UI HTTP SERVER
// -----------------------------------------------------------------------------

const app = express();
const httpServer = http.createServer(app);

app.use(express.static(path.join(__dirname, "public")));

httpServer.listen(8080, () => {
    console.log("🌐 Web UI running on http://localhost:8080");
});

// -----------------------------------------------------------------------------
// GET /ips — return available IPs for client connection
// -----------------------------------------------------------------------------

app.get("/ips", (req, res) => {
    const interfaces = os.networkInterfaces();
    const ips = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }

    res.json({
        port: PORT,
        ips: ips
    });
});

// -----------------------------------------------------------------------------
// SEND LOG TO UI (via SSE) — FIXED MULTILINE
// -----------------------------------------------------------------------------

let uiClients = [];

app.get("/log-stream", (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
    });

    uiClients.push(res);

    req.on("close", () => {
        uiClients = uiClients.filter(c => c !== res);
    });
});

function uiLog(msg) {
    const safe = msg.replace(/\n/g, "<br>");
    uiClients.forEach(c => c.write(`data: ${safe}\n\n`));
    console.log(msg);
}

// -----------------------------------------------------------------------------
// TCP SERVER (REAL POS TERMINAL EMULATOR)
// -----------------------------------------------------------------------------

const server = net.createServer((socket) => {
    const clientIP = socket.remoteAddress;
    uiLog(`=== CLIENT CONNECTED (${clientIP}) ===`);

    let buffer = "";

    socket.on("data", (data) => {
        const text = data.toString("utf8");
        buffer += text;

        // END OF MESSAGE = \u0000
        if (buffer.includes("\u0000")) {
            const clean = buffer.replace(/\u0000/g, "");
            buffer = "";

            uiLog(">>> REQUEST:<br>" + clean);

            let json;
            try {
                json = JSON.parse(clean);
            } catch (e) {
                uiLog("❌ JSON PARSE ERROR");
                return;
            }

            let reply;

            // -------------------------------------------------------------
            // PROTOCOL IMPLEMENTATION
            // -------------------------------------------------------------
            switch (json.method) {

                case "PingDevice":
                    reply = {
                        method: "PingDevice",
                        step: 0,
                        params: { code: "00", responseCode: "0000" },
                        error: false,
                        errorDescription: ""
                    };
                    break;

                case "ServiceMessage":
                    if (json.params?.msgType === "identify") {
                        reply = {
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
                        };
                    }
                    break;

                case "Purchase":
                    reply = {
                        method: "Purchase",
                        step: 0,
                        params: {
                            amount: json.params.amount,
                            approvalCode: "999999",
                            responseCode: "0000",
                            rrn: Date.now().toString(),
                            receipt: "TEST RECEIPT\nSUCCESS"
                        },
                        error: false,
                        errorDescription: ""
                    };
                    break;

                default:
                    reply = {
                        method: "ServiceMessage",
                        step: 0,
                        params: { msgType: "methodNotImplemented" },
                        error: false,
                        errorDescription: "Method not implemented"
                    };
            }

            // Send reply
            const replyStr = JSON.stringify(reply) + "\u0000";
            socket.write(replyStr);

            uiLog("<<< RESPONSE:<br>" + JSON.stringify(reply, null, 2).replace(/\n/g, "<br>"));
        }
    });

    socket.on("close", () => {
        uiLog(`=== CLIENT DISCONNECTED (${clientIP}) ===`);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🟢 POS TCP emulator running on port ${PORT}`);
});
