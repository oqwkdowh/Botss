const { Client, LocalAuth } = require('whatsapp-web.js');

// 1. Configuración del Prefijo
const PREFIX = process.env.PREFIX || '!'; 
console.log(`Prefijo del Bot configurado a: ${PREFIX}`);

// 2. IMPORTANTE: Define tu número de teléfono para pairing code
// Formato: código de país + número (sin +, espacios ni guiones)
// Ejemplo: Para +51 987654321 usa: '51987654321'
const PHONE_NUMBER = process.env.PHONE_NUMBER || ''; // ⚠️ CONFIGURA ESTO

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
    }
});

// EVENTOS DE CONEXIÓN

// Evento cuando se genera el código de vinculación
client.on('code', (code) => {
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
});

// Evento QR (no debería activarse si usas pairing code)
client.on('qr', (qr) => {
    console.log('⚠️  Se generó QR en lugar de código.');
    console.log('💡 Verifica que PHONE_NUMBER esté configurado correctamente.\n');
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

// Inicializar el cliente con pairing code
async function initializeClient() {
    console.log('🚀 Iniciando WhatsApp Bot...');
    
    if (!PHONE_NUMBER) {
        console.error('\n❌ ERROR: PHONE_NUMBER no está configurado');
        console.log('📝 Configura la variable de entorno PHONE_NUMBER en Koyeb');
        console.log('   Formato: código de país + número (sin +, espacios ni guiones)');
        console.log('   Ejemplo: 51987654321 para Perú\n');
        process.exit(1);
    }

    console.log(`📱 Solicitando código para: +${PHONE_NUMBER}`);
    console.log('⏳ Generando código de vinculación...\n');
    
    await client.initialize();
    
    // Solicitar el pairing code después de inicializar
    setTimeout(async () => {
        try {
            await client.requestPairingCode(PHONE_NUMBER);
        } catch (error) {
            console.error('❌ Error al solicitar código:', error.message);
        }
    }, 3000); // Espera 3 segundos para que el cliente esté listo
}

initializeClient();

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\n⏹️  Cerrando bot...');
    await client.destroy();
    process.exit(0);
});