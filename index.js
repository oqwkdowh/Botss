const { Client, LocalAuth } = require('whatsapp-web.js');
const http = require('http');

// 1. Configuración del Prefijo
const PREFIX = process.env.PREFIX || '!'; 
console.log(`Prefijo del Bot configurado a: ${PREFIX}`);

// 2. Servidor HTTP para health check de Koyeb
const PORT = process.env.PORT || 8000;

console.log(`🔧 Configuración del servidor:`);
console.log(`   - Puerto: ${PORT}`);
console.log(`   - Host: 0.0.0.0`);

const server = http.createServer((req, res) => {
    console.log(`📥 Petición recibida: ${req.method} ${req.url}`);
    
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const response = { 
            status: 'ok', 
            bot: 'running',
            prefix: PREFIX,
            whatsapp: client.info ? 'connected' : 'connecting',
            timestamp: new Date().toISOString()
        };
        res.end(JSON.stringify(response, null, 2));
        console.log(`✅ Health check respondido correctamente`);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found - Try /health endpoint');
    }
});

server.on('error', (err) => {
    console.error('❌ Error en el servidor:', err);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor HTTP escuchando en 0.0.0.0:${PORT}`);
    console.log(`   Endpoints disponibles:`);
    console.log(`   - GET /health (health check)`);
    console.log(`   - GET / (status)\n`);
});

// 2. Número de teléfono para pairing code (formato: código país + número)
const PHONE_NUMBER = process.env.PHONE_NUMBER || '';
const FORCE_NEW_SESSION = process.env.FORCE_NEW_SESSION === 'true';

// Si se fuerza sesión nueva, eliminar la carpeta de autenticación
if (FORCE_NEW_SESSION) {
    const fs = require('fs');
    const path = require('path');
    const authPath = path.join(__dirname, '.wwebjs_auth');
    
    if (fs.existsSync(authPath)) {
        console.log('🗑️  Eliminando sesión anterior...');
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log('✅ Sesión eliminada. Se creará una nueva.\n');
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
            '--single-process', // ✅ NUEVO: Evita múltiples procesos
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        // ✅ IMPORTANTE: Aumentar timeout para conexiones lentas
        timeout: 60000
    },
    // ✅ Usar versión estable de WhatsApp Web
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
    // ✅ Configuración adicional para estabilidad
    qrMaxRetries: 5
});

// Variable para controlar si ya se solicitó el código
let pairingCodeRequested = false;
let clientReady = false;

// EVENTOS DE CONEXIÓN

// Evento loading - nos dice qué está haciendo el cliente
client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Cargando WhatsApp: ${percent}% - ${message}`);
});

// ✅ NUEVO: Detectar cuando se está generando el QR
client.on('remote_session_saved', () => {
    console.log('💾 Sesión guardada en WhatsApp servers');
});

// Detectar cuando el cliente está listo para solicitar pairing code
client.on('qr', async (qr) => {
    console.log('📱 Evento QR detectado');
    console.log('⏰ Tienes 60 segundos para escanear\n');
    
    if (PHONE_NUMBER && !pairingCodeRequested) {
        console.log('🔄 Intentando cambiar a modo código de vinculación...');
        pairingCodeRequested = true;
        
        try {
            // Intentar solicitar pairing code
            const code = await client.requestPairingCode(PHONE_NUMBER);
            
            console.log('\n╔════════════════════════════════════╗');
            console.log('║   CÓDIGO DE VINCULACIÓN WHATSAPP   ║');
            console.log('╚════════════════════════════════════╝');
            console.log('');
            console.log('📱 Abre WhatsApp en tu teléfono');
            console.log('⚙️  Ve a: Configuración > Dispositivos vinculados');
            console.log('➕ Toca: "Vincular un dispositivo"');
            console.log('🔢 Selecciona: "Vincular con número de teléfono"');
            console.log('');
            console.log('👉 INGRESA ESTE CÓDIGO:');
            console.log('');
            console.log(`   ╔═══════════╗`);
            console.log(`   ║  ${code}  ║`);
            console.log(`   ╚═══════════╝`);
            console.log('');
            console.log('⏳ El código expira en pocos minutos...');
            console.log('⚠️  Si no funciona, escanea el QR que aparece abajo\n');
            
        } catch (error) {
            console.log('\n⚠️  Error al solicitar código:', error.message);
            console.log('🔄 Usando QR Code como alternativa\n');
        }
    }
    
    // Siempre mostrar QR como backup
    if (!PHONE_NUMBER || pairingCodeRequested) {
        console.log('--- ESCANEA ESTE QR CODE ---');
        const qrcodeTerminal = require('qrcode-terminal');
        qrcodeTerminal.generate(qr, { small: true });
        
        // ✅ NUEVO: URL para escanear desde otro dispositivo
        console.log('\n🔗 O escanea desde esta URL:');
        console.log(`   https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
        console.log('\n💡 Tip: El QR se regenera cada 60 segundos\n');
    }
});

client.on('ready', () => {
    clientReady = true;
    console.log('✅ ¡CLIENTE LISTO! Bot conectado y funcionando.');
    console.log(`📞 Número conectado: ${client.info.wid.user}`);
});

client.on('authenticated', () => {
    console.log('🔐 Autenticación exitosa - Sesión guardada');
});

client.on('disconnected', (reason) => {
    clientReady = false;
    console.log('⚠️ Cliente desconectado:', reason);
    console.log('🔄 Intentando reconectar...');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
    console.log('💡 Puede que necesites eliminar la sesión guardada');
});

// LÓGICA DE COMANDOS EXPANDIBLE
client.on('message', async msg => {
    const body = msg.body;

    // Verificar si el mensaje comienza con el prefijo
    if (!body.startsWith(PREFIX)) {
        return; // Ignorar si no es un comando
    }

    // Separar el prefijo y obtener solo el comando y argumentos
    const args = body.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // --- AÑADE TUS COMANDOS AQUÍ ---
    
    // COMANDO 1: !hola
    if (command === 'hola') {
        msg.reply('¡Hola! Soy un bot funcional. Mi prefijo es: ' + PREFIX);
    } 
    
    // COMANDO 2: !info
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
    
    // COMANDO 3: !ayuda
    else if (command === 'ayuda') {
        msg.reply(`Escribe ${PREFIX}info para ver detalles o ${PREFIX}hola para saludar.`);
    }

    // Puedes seguir añadiendo más comandos con "else if (command === 'comando')"

});

// Inicializar el cliente
console.log('🚀 Iniciando WhatsApp Bot...');

if (PHONE_NUMBER) {
    console.log(`📱 Intentando modo código para: +${PHONE_NUMBER}`);
} else {
    console.log('📱 Modo QR Code (configura PHONE_NUMBER para código)');
}

console.log('⏳ Conectando...\n');

client.initialize();

// Timeout de seguridad: si después de 30 segundos no hay QR ni código
setTimeout(() => {
    if (!clientReady && !pairingCodeRequested) {
        console.log('\n⚠️  TIMEOUT: No se recibió QR ni se solicitó código');
        console.log('📋 Posibles causas:');
        console.log('   1. Ya existe una sesión guardada válida');
        console.log('   2. Problema de red con WhatsApp servers');
        console.log('   3. La carpeta wwebjs_auth tiene datos corruptos');
        console.log('\n💡 Soluciones:');
        console.log('   - Si ya conectaste antes, el bot debería funcionar');
        console.log('   - Si no, elimina la carpeta wwebjs_auth y redeploy\n');
    }
}, 30000);

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\n⏹️  Cerrando bot...');
    await client.destroy();
    server.close(() => {
        console.log('🌐 Servidor HTTP cerrado');
        process.exit(0);
    });
});

process.on('SIGTERM', async () => {
    console.log('\n⏹️  Señal de terminación recibida...');
    await client.destroy();
    server.close(() => {
        console.log('🌐 Servidor HTTP cerrado');
        process.exit(0);
    });
});