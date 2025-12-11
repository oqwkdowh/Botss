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
    console.log('⏰ QR generado - ACCEDE A LA URL DEL SERVIDOR AHORA\n');
    
    // Guardar QR para mostrarlo en el navegador
    currentQR = qr;
    qrGeneratedAt = Date.now();
    pairingCode = null; // Limpiar código si existe
    
    if (PHONE_NUMBER && !pairingCodeRequested) {
        console.log('🔄 Intentando cambiar a modo código de vinculación...');
        pairingCodeRequested = true;
        
        try {
            // Intentar solicitar pairing code
            const code = await client.requestPairingCode(PHONE_NUMBER);
            
            // Guardar código para mostrarlo en el navegador
            pairingCode = code;
            currentQR = qr; // Mantener QR como backup
            
            console.log('\n╔════════════════════════════════════╗');
            console.log('║   CÓDIGO DE VINCULACIÓN WHATSAPP   ║');
            console.log('╚════════════════════════════════════╝');
            console.log('');
            console.log(`   ╔═══════════╗`);
            console.log(`   ║  ${code}  ║`);
            console.log(`   ╚═══════════╝`);
            console.log('');
            console.log('⚠️  SI LOS LOGS TARDAN, abre la URL del servidor en tu navegador');
            console.log('    para ver el código en tiempo real\n');
            
        } catch (error) {
            console.log('\n⚠️  Error al solicitar código:', error.message);
            console.log('🔄 Usa el QR desde el navegador\n');
        }
    }
    
    // Siempre mostrar QR en logs como backup
    console.log('--- QR CODE (también disponible en el navegador) ---');
    const qrcodeTerminal = require('qrcode-terminal');
    qrcodeTerminal.generate(qr, { small: true });
    console.log('\n🔗 URL del QR:');
    console.log(`   https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
    console.log('\n💡 Tip: Abre la URL de tu servicio en el navegador para ver el QR en tiempo real\n');
});

client.on('ready', () => {
    clientReady = true;
    currentQR = null; // Limpiar QR cuando se conecta
    pairingCode = null;
    console.log('✅ ¡CLIENTE LISTO! Bot conectado y funcionando.');
    console.log(`📞 Número conectado: ${client.info.wid.user}`);
    console.log('🌐 Ahora puedes cerrar el navegador, el bot está funcionando\n');
});

client.on('authenticated', () => {
    console.log('🔐 Autenticación exitosa - Sesión guardada');
});

client.on('disconnected', (reason) => {
    clientReady = false;
    console.log('⚠️ Cliente desconectado:', reason);
    
    // Si fue LOGOUT, la sesión ya no sirve
    if (reason === 'LOGOUT') {
        console.log('🗑️  Sesión cerrada por WhatsApp. Eliminando datos...');
        
        const fs = require('fs');
        const path = require('path');
        const authPath = path.join(__dirname, '.wwebjs_auth');
        
        // Función recursiva mejorada para eliminar directorios
        const deleteFolder = (dirPath) => {
            if (fs.existsSync(dirPath)) {
                try {
                    // Primero intentar con force
                    fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3 });
                    return true;
                } catch (err) {
                    console.log('⚠️ rmSync falló, intentando método alternativo...');
                    try {
                        // Método alternativo: eliminar archivos uno por uno
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
        
        // Detener el proceso para que Koyeb/Render lo reinicie automáticamente
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
    
    // Eliminar sesión corrupta con función mejorada
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
        console.log('✅ Sesión eliminada. Reiniciando en 3 segundos...');
    } else {
        console.log('⚠️ Sesión no eliminada completamente, pero reiniciando igual...');
    }
    
    // Reiniciar el proceso
    setTimeout(() => {
        console.log('🔄 Reiniciando...');
        process.exit(0);
    }, 3000);
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

// Inicializar con manejo de errores
client.initialize().catch(err => {
    console.error('❌ Error crítico al inicializar:', err.message);
    console.log('🔄 Reiniciando en 10 segundos...');
    setTimeout(() => process.exit(1), 10000);
});

// Timeout de seguridad: si después de 90 segundos no hay conexión
setTimeout(() => {
    if (!clientReady) {
        console.log('\n⚠️  TIMEOUT: No se pudo conectar en 90 segundos');
        console.log('📋 Estado actual:');
        console.log(`   - Cliente listo: ${clientReady}`);
        console.log(`   - Código solicitado: ${pairingCodeRequested}`);
        console.log('\n💡 Posibles causas:');
        console.log('   1. Conexión lenta con WhatsApp servers');
        console.log('   2. Sesión guardada corrupta');
        console.log('   3. Problema de red en el servidor');
        console.log('\n🔄 Tip: El servicio se reiniciará automáticamente\n');
    }
}, 90000);

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

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error.message);
    
    // Si es el error de navegación de Puppeteer, intentar limpiar
    if (error.message.includes('Execution context was destroyed')) {
        console.log('🔄 Detectado error de contexto. Reiniciando en 5 segundos...');
        setTimeout(() => {
            process.exit(1); // Exit con código 1 para que Koyeb/Render lo reinicie
        }, 5000);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
});