const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// 1. Configuración del Prefijo
// Si la variable de entorno PREFIX está definida, úsala. Si no, usa '.' por defecto.
const PREFIX = process.env.PREFIX || '!'; 
console.log(`Prefijo del Bot configurado a: ${PREFIX}`);

// Inicializa el cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth()
});

// EVENTOS DE CONEXIÓN
client.on('qr', (qr) => {
    console.log('--- SCAN QR CODE ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('¡CLIENTE LISTO! Bot conectado y funcionando.');
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
            Plataforma: Render (Nube)
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

client.initialize();
