const { Client, LocalAuth } = require('whatsapp-web.js');
const http = require('http');

// 1. Configuración del Prefijo
const PREFIX = process.env.PREFIX || '!'; 
console.log(`Prefijo del Bot configurado a: ${PREFIX}`);

// 2. Variables globales para QR y estado
let currentQR = null;
let qrGeneratedAt = null;
let pairingCode = null;
let pairingCodeRequested = false;
let clientReady = false;

// 3. Servidor HTTP para health check y visualización del QR
const PORT = process.env.PORT || 8000;

console.log(`🔧 Configuración del servidor:`);
console.log(`   - Puerto: ${PORT}`);
console.log(`   - Host: 0.0.0.0`);

const server = http.createServer((req, res) => {
    console.log(`📥 Petición recibida: ${req.method} ${req.url}`);
    
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const response = { 
            status: 'ok', 
            bot: 'running',
            prefix: PREFIX,
            whatsapp: clientReady ? 'connected' : 'connecting',
            timestamp: new Date().toISOString()
        };
        res.end(JSON.stringify(response, null, 2));
        console.log(`✅ Health check respondido correctamente`);
    } 
    else if (req.url === '/' || req.url === '/qr') {
        // Página HTML para mostrar el QR en tiempo real
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Bot - Conexión</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            background: white;
            color: #333;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        h1 { color: #25D366; margin-bottom: 10px; }
        .status {
            padding: 15px;
            margin: 20px 0;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
        }
        .connected { background: #d4edda; color: #155724; }
        .waiting { background: #fff3cd; color: #856404; }
        .qr-container {
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        .qr-image {
            max-width: 300px;
            margin: 20px auto;
            display: block;
        }
        .code-box {
            font-size: 32px;
            font-weight: bold;
            color: #25D366;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            letter-spacing: 5px;
        }
        .instructions {
            text-align: left;
            background: #e7f3ff;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .instructions ol {
            margin: 10px 0;
            padding-left: 20px;
        }
        .instructions li {
            margin: 8px 0;
        }
        .refresh-btn {
            background: #25D366;
            color: white;
            border: none;
            padding: 12px 30px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            margin: 10px;
        }
        .refresh-btn:hover { background: #1da851; }
        .timer {
            font-size: 14px;
            color: #666;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 WhatsApp Bot</h1>
        <p>Prefijo: <strong>${PREFIX}</strong></p>
        
        ${clientReady ? `
            <div class="status connected">
                ✅ Bot conectado y funcionando
            </div>
            <p>Ya puedes enviar comandos a tu número de WhatsApp</p>
        ` : currentQR || pairingCode ? `
            <div class="status waiting">
                ⏳ Esperando conexión...
            </div>
            
            ${pairingCode ? `
                <div class="instructions">
                    <strong>📱 Código de Vinculación:</strong>
                    <ol>
                        <li>Abre WhatsApp en tu teléfono</li>
                        <li>Ve a: <strong>Configuración → Dispositivos vinculados</strong></li>
                        <li>Toca: <strong>Vincular un dispositivo</strong></li>
                        <li>Selecciona: <strong>Vincular con número de teléfono</strong></li>
                        <li>Ingresa este código:</li>
                    </ol>
                </div>
                <div class="code-box">${pairingCode}</div>
                <p class="timer">⏰ El código expira en unos minutos</p>
            ` : ''}
            
            ${currentQR ? `
                <div class="instructions">
                    <strong>📱 Escanear QR Code:</strong>
                    <ol>
                        <li>Abre WhatsApp en tu teléfono</li>
                        <li>Toca los <strong>3 puntos</strong> (esquina superior derecha)</li>
                        <li>Selecciona: <strong>Dispositivos vinculados</strong></li>
                        <li>Toca: <strong>Vincular un dispositivo</strong></li>
                        <li>Escanea este código:</li>
                    </ol>
                </div>
                <div class="qr-container">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}" 
                         alt="QR Code" 
                         class="qr-image">
                    <p class="timer">⏰ QR válido por ~60 segundos</p>
                    ${qrGeneratedAt ? `<p class="timer">Generado hace: <span id="elapsed">0</span>s</p>` : ''}
                </div>
            ` : ''}
            
            <button class="refresh-btn" onclick="location.reload()">🔄 Actualizar</button>
            <p style="font-size: 12px; color: #666;">La página se actualiza automáticamente cada 10 segundos</p>
            
        ` : `
            <div class="status waiting">
                🔄 Inicializando bot...
            </div>
            <p>Espera unos segundos mientras se conecta</p>
            <button class="refresh-btn" onclick="location.reload()">🔄 Actualizar</button>
        `}
    </div>
    
    <script>
        // Auto-refresh cada 10 segundos si no está conectado
        ${!clientReady ? `setTimeout(() => location.reload(), 10000);` : ''}
        
        // Mostrar tiempo transcurrido
        ${qrGeneratedAt ? `
        const generated = new Date(${qrGeneratedAt});
        setInterval(() => {
            const elapsed = Math.floor((Date.now() - generated) / 1000);
            const el = document.getElementById('elapsed');
            if (el) el.textContent = elapsed;
        }, 1000);
        ` : ''}
    </script>
</body>
</html>
        `;
        
        res.end(html);
    }
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found - Try / or /health endpoint');
    }
});

server.on('error', (err) => {
    console.error('❌ Error en el servidor:', err);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor HTTP escuchando en 0.0.0.0:${PORT}`);
    console.log(`   Endpoints disponibles:`);
    console.log(`   - GET / (ver QR/código en navegador) ⭐`);
    console.log(`   - GET /health (health check)\n`);
});

// 4. Número de teléfono para pairing code
const PHONE_NUMBER = process.env.PHONE_NUMBER || '';
const FORCE_NEW_SESSION = process.env.FORCE_NEW_SESSION === 'true';

// Si se fuerza sesión nueva, eliminar la carpeta de autenticación
if (FORCE_NEW_SESSION) {
    const fs = require('fs');
    const path = require('path');
    const authPath = path.join(__dirname, '.wwebjs_auth');
    
    const deleteFolder = (dirPath) => {
        if (fs.existsSync(dirPath)) {
            try {
                fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3 });
                return true;
            } catch (err) {
                try {
                    const files = fs.readdirSync(dirPath);
                    for (const file of files) {
                        const filePath = path.join(dirPath, file);
                        const stat = fs.statSync(filePath);
                        if (stat.isDirectory()) {
                            deleteFolder(filePath);
                        } else {
                            try {
                                fs.unlinkSync(filePath);
                            } catch (e) {
                                // Ignorar archivos bloqueados
                            }
                        }
                    }
                    fs.rmdirSync(dirPath);
                    return true;
                } catch (err2) {
                    return false;
                }
            }
        }
        return false;
    };
    
    if (deleteFolder(authPath)) {
        console.log('🗑️  Sesión anterior eliminada.');
        console.log('✅ Se creará una nueva sesión.\n');
    } else {
        console.log('⚠️ No se pudo eliminar completamente la sesión anterior.');
        console.log('💡 Continuando de todas formas...\n');
    }
}

// Inicializa el cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        timeout: 60000
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
    qrMaxRetries: 5
});

// EVENTOS DE CONEXIÓN

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Cargando WhatsApp: ${percent}% - ${message}`);
});

client.on('remote_session_saved', () => {
    console.log('💾 Sesión guardada en WhatsApp servers');
});

client.on('qr', async (qr) => {
    console.log('📱 Evento QR detectado');
    console.log('⏰ QR generado - ACCEDE A LA URL DEL SERVIDOR AHORA\n');
    
    currentQR = qr;
    qrGeneratedAt = Date.now();
    pairingCode = null;
    
    if (PHONE_NUMBER && !pairingCodeRequested) {
        console.log('🔄 Intentando cambiar a modo código de vinculación...');
        pairingCodeRequested = true;
        
        try {
            const code = await client.requestPairingCode(PHONE_NUMBER);
            pairingCode = code;
            currentQR = qr;
            
            console.log('\n╔════════════════════════════════════╗');
            console.log('║   CÓDIGO DE VINCULACIÓN WHATSAPP   ║');
            console.log('╚════════════════════════════════════╝');
            console.log('');
            console.log(`   ╔═══════════╗`);
            console.log(`   ║  ${code}  ║`);
            console.log(`   ╚═══════════╝`);
            console.log('');
            console.log('⚠️  SI LOS LOGS TARDAN, abre la URL del servidor en tu navegador\n');
            
        } catch (error) {
            console.log('\n⚠️  Error al solicitar código:', error.message);
            console.log('🔄 Usa el QR desde el navegador\n');
        }
    }
    
    console.log('--- QR CODE (también disponible en el navegador) ---');
    const qrcodeTerminal = require('qrcode-terminal');
    qrcodeTerminal.generate(qr, { small: true });
    console.log('\n🔗 URL del QR:');
    console.log(`   https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
    console.log('\n💡 Tip: Abre la URL de tu servicio en el navegador para ver el QR\n');
});

client.on('ready', () => {
    clientReady = true;
    currentQR = null;
    pairingCode = null;
    console.log('✅ ¡CLIENTE LISTO! Bot conectado y funcionando.');
    console.log(`📞 Número conectado: ${client.info.wid.user}`);
    console.log('🌐 Ahora puedes cerrar el navegador\n');
});

client.on('authenticated', () => {
    console.log('🔐 Autenticación exitosa - Sesión guardada');
});

client.on('disconnected', (reason) => {
    clientReady = false;
    console.log('⚠️ Cliente desconectado:', reason);
    
    if (reason === 'LOGOUT') {
        console.log('🗑️  Sesión cerrada por WhatsApp. Eliminando datos...');
        
        const fs = require('fs');
        const path = require('path');
        const authPath = path.join(__dirname, '.wwebjs_auth');
        
        const deleteFolder = (dirPath) => {
            if (fs.existsSync(dirPath)) {
                try {
                    fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3 });
                    return true;
                } catch (err) {
                    console.log('⚠️ rmSync falló, intentando método alternativo...');
                    try {
                        const files = fs.readdirSync(dirPath);
                        for (const file of files) {
                            const filePath = path.join(dirPath, file);
                            const stat = fs.statSync(filePath);
                            if (stat.isDirectory()) {
                                deleteFolder(filePath);
                            } else {
                                try {
                                    fs.unlinkSync(filePath);
                                } catch (e) {
                                    console.log(`⚠️ No se pudo eliminar: ${filePath}`);
                                }
                            }
                        }
                        fs.rmdirSync(dirPath);
                        return true;
                    } catch (err2) {
                        console.error('❌ Error al eliminar sesión:', err2.message);
                        return false;
                    }
                }
            }
            return false;
        };
        
        if (deleteFolder(authPath)) {
            console.log('✅ Sesión eliminada correctamente.');
        } else {
            console.log('⚠️ No se pudo eliminar completamente, pero se reiniciará igual.');
        }
        
        console.log('🔄 Deteniendo proceso para reinicio automático...');
        setTimeout(() => process.exit(0), 2000);
    } else {
        console.log('🔄 Intentando reconectar en 5 segundos...');
        setTimeout(() => {
            console.log('🔄 Reiniciando cliente...');
            client.initialize().catch(err => {
                console.error('❌ Error al reiniciar:', err.message);
            });
        }, 5000);
    }
});

client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
    console.log('💡 La sesión guardada está corrupta o expiró');
    
    const fs = require('fs');
    const path = require('path');
    const authPath = path.join(__dirname, '.wwebjs_auth');
    
    const deleteFolder = (dirPath) => {
        if (fs.existsSync(dirPath)) {
            try {
                fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3 });
                return true;
            } catch (err) {
                console.log('⚠️ Usando método alternativo de eliminación...');
                try {
                    const files = fs.readdirSync(dirPath);
                    for (const file of files) {
                        const filePath = path.join(dirPath, file);
                        const stat = fs.statSync(filePath);
                        if (stat.isDirectory()) {
                            deleteFolder(filePath);
                        } else {
                            try {
                                fs.unlinkSync(filePath);
                            } catch (e) {}
                        }
                    }
                    fs.rmdirSync(dirPath);
                    return true;
                } catch (err2) {
                    return false;
                }
            }
        }
        return false;
    };
    
    if (deleteFolder(authPath)) {
        console.log('✅ Sesión eliminada. Reiniciando en 3 segundos...');
    } else {
        console.log('⚠️ Sesión no eliminada completamente, pero reiniciando igual...');
    }
    
    setTimeout(() => {
        console.log('🔄 Reiniciando...');
        process.exit(0);
    }, 3000);
});

// LÓGICA DE COMANDOS
client.on('message', async msg => {
    const body = msg.body;

    if (!body.startsWith(PREFIX)) {
        return;
    }

    const args = body.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    if (command === 'hola') {
        msg.reply('¡Hola! Soy un bot funcional. Mi prefijo es: ' + PREFIX);
    } 
    else if (command === 'info') {
        const info = `
            🤖 *INFORMACIÓN DEL BOT* 🤖
            ---------------------------
            Prefijo: ${PREFIX}
            Plataforma: Koyeb (Nube)
            Comandos: ${PREFIX}hola, ${PREFIX}info, ${PREFIX}ayuda
        `;
        msg.reply(info.trim());
    } 
    else if (command === 'ayuda') {
        msg.reply(`Escribe ${PREFIX}info para ver detalles o ${PREFIX}hola para saludar.`);
    }
});

// Inicializar
console.log('🚀 Iniciando WhatsApp Bot...');

if (PHONE_NUMBER) {
    console.log(`📱 Intentando modo código para: +${PHONE_NUMBER}`);
} else {
    console.log('📱 Modo QR Code (configura PHONE_NUMBER para código)');
}

console.log('⏳ Conectando...\n');

client.initialize().catch(err => {
    console.error('❌ Error crítico al inicializar:', err.message);
    console.log('🔄 Reiniciando en 10 segundos...');
    setTimeout(() => process.exit(1), 10000);
});

setTimeout(() => {
    if (!clientReady) {
        console.log('\n⚠️  TIMEOUT: No se pudo conectar en 90 segundos');
        console.log('📋 Estado actual:');
        console.log(`   - Cliente listo: ${clientReady}`);
        console.log(`   - Código solicitado: ${pairingCodeRequested}`);
        console.log('\n🔄 Tip: El servicio se reiniciará automáticamente\n');
    }
}, 90000);

// Manejo de cierre
process.on('SIGINT', async () => {
    console.log('\n⏹️  Cerrando bot...');
    await client.destroy();
    server.close(() => {
        console.log('Servidor HTTP cerrado');
        process.exit(0);
    });
});

process.on('SIGTERM', async () => {
    console.log('Señal de terminación recibida...');
    await client.destroy();
    server.close(() => {
        console.log('Servidor HTTP cerrado');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error.message);
    
    if (error.message.includes('Execution context was destroyed')) {
        console.log('🔄 Detectado error de contexto. Reiniciando en 5 segundos...');
        setTimeout(() => {
            process.exit(1);
        }, 5000);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(' Promesa rechazada no manejada:', reason);
});