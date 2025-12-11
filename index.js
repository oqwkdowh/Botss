const { Client, LocalAuth } = require('whatsapp-web.js');

// 1. Configuración del Prefijo
// Si la variable de entorno PREFIX está definida, úsala. Si no, usa '!' por defecto.
const PREFIX = process.env.PREFIX || '!'; 
console.log(`Prefijo del Bot configurado a: ${PREFIX}`);

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

// ✅ NUEVO: Evento para el código de vinculación de 8 dígitos
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

// Evento QR (backup, por si no se genera código)
client.on('qr', (qr) => {
    console.log('⚠️  QR Code generado (si prefieres código, ignora esto)');
});

client.on('ready', () => {
    console.log('¡CLIENTE LISTO! Bot conectado y funcionando.');
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
console.log('⏳ Solicitando código de vinculación...\n');

client.initialize();

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\n⏹️  Cerrando bot...');
    await client.destroy();
    process.exit(0);
});