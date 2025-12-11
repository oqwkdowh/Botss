const { Client, LocalAuth } = require('whatsapp-web.js');
const http = require('http');

// 1. Configuración del Prefijo
const PREFIX = process.env.PREFIX || '!'; 
console.log(`Prefijo del Bot configurado a: ${PREFIX}`);

// 2. Servidor HTTP para health check de Koyeb
const PORT = process.env.PORT || 8000;
const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            bot: 'running',
            prefix: PREFIX,
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor HTTP escuchando en puerto ${PORT}`);
});

// 2. Número de teléfono para pairing code (formato: código país + número)
const PHONE_NUMBER = process.env.PHONE_NUMBER || '';

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
            '--disable-gpu'
        ]
    },
    // ✅ NUEVO: Habilitar pairing code en las opciones del cliente
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

// Variable para controlar si ya se solicitó el código
let pairingCodeRequested = false;

// EVENTOS DE CONEXIÓN

// Detectar cuando el cliente está listo para solicitar pairing code
client.on('qr', async (qr) => {
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
            console.log('⏳ El código expira en unos minutos...\n');
            
        } catch (error) {
            console.log('\n⚠️  No se pudo generar código de vinculación');
            console.log('📱 Tu versión de whatsapp-web.js no soporta pairing code');
            console.log('🔄 Usa el QR Code que aparece arriba para conectar\n');
            
            // Mostrar QR como fallback
            const qrcodeTerminal = require('qrcode-terminal');
            qrcodeTerminal.generate(qr, { small: true });
        }
    } else if (!PHONE_NUMBER) {
        console.log('⚠️  PHONE_NUMBER no configurado, usando QR Code...\n');
        const qrcodeTerminal = require('qrcode-terminal');
        qrcodeTerminal.generate(qr, { small: true });
    }
});

client.on('ready', () => {
    console.log('✅ ¡CLIENTE LISTO! Bot conectado y funcionando.');
    console.log(`📞 Número conectado: ${client.info.wid.user}`);
});

client.on('authenticated', () => {
    console.log('🔐 Autenticación exitosa - Sesión guardada');
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Cliente desconectado:', reason);
});

client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
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