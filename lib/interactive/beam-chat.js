const BeamClient = require('beam-client-node');
const BeamSocket = require('beam-client-node/lib/ws');
const beam = new BeamClient();
const JsonDB = require('node-json-db');
const {ipcMain, BrowserWindow} = require('electron');

var options = {
    client_id: ""
};

// Chat Connector
// This function connects to beam chat and monitors messages.
function chatConnect(){
    var dbAuth = new JsonDB("./user-settings/auth", true, false);
    
    var dbSettings = new JsonDB('./user-settings/settings', true, false);

    // Get streamer data.
    try{
        var streamer = dbAuth.getData('/streamer');
        streamerConnect(streamer);
    }catch(err){
        renderWindow.webContents.send('error', "You need to sign into the app as a streamer to connect to chat.");
        return;
    }

    // Get bot data.
    try{
        var botter = dbAuth.getData('/bot');
        botConnect(botter);
    }catch(err){
        console.log('No bot logged in. Skipping. (chat-connect)');
        return;
    }
}

// Streamer Chat Connect 
// This checks to see if the streamer is logged into the app, and if so it will connect them to chat.
function streamerConnect(streamer){
    // Bot Login
    beam.use('oauth', {
        clientId: options.client_id,
        tokens: {
            access: streamer.accessToken,
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000
        }
    })

    // Request chat endpoints and connect.
    beam.request('GET', `chats/`+streamer['channelId']).then(response => {
        var body = response.body;
        createBotChatSocket("Streamer", streamer['userId'], streamer['channelId'], body.endpoints, body.authkey);
    })
    .catch(error => {
        // Popup error.
        renderWindow.webContents.send('error', "Couldnt connect to chat as the streamer.");

        // Log error for dev.
        console.log('Something went wrong:', error);
    });
}

// Bot Chat Connect
// This checks to see if bot info is available, and if so it will connect them to chat.
function botConnect(botter){
    var dbAuth = new JsonDB('./user-settings/auth', true, false);

    // Get streamer data so we can get the channel id to connect to.
    try{
        var streamer = dbAuth.getData('/streamer');
    }catch(err){
        renderWindow.webContents.send('error', "You need to sign into the app as a streamer to connect to chat.");
        return;
    }

    // Bot Login
    beam.use('oauth', {
        clientId: options.client_id,
        tokens: {
            access: botter.accessToken,
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000
        }
    })

    // Request endpoints and connect.
    beam.request('GET', `chats/`+streamer['channelId']).then(response => {
        var body = response.body;
        createBotChatSocket("Bot", botter['userId'], streamer['channelId'], body.endpoints, body.authkey);
    })
    .catch(error => {
        // Popup error.
        renderWindow.webContents.send('error', "I couldnt connect to the chat as your bot account.");

        // Log errors for dev.
        console.log('Something went wrong:', error);
    });
}


// Creates the chat websocket
// This sets up and auths with the chat websocket.
function createBotChatSocket (chatter, userId, channelId, endpoints, authkey) {
    var dbSettings = new JsonDB('./user-settings/settings', true, false);

    // Setup chat socket related to the chatter (bot or streamer).
    if(chatter == "Streamer"){
        // Chat connection
        global.streamerChat = new BeamSocket(endpoints).boot();

        // React to chat messages
        global.streamerChat.on('ChatMessage', data => {
            if (data.message.message[0].data.toLowerCase().startsWith('!ping')) {
                // You can do fun stuff here to auto respond to certain commands.
            }
        });

        // Handle errors
        global.streamerChat.on('error', error => {
            // Popup error.
            renderWindow.webContents.send('error', "There was an error with chat or it was disconnected.");

            // Log for dev.
            console.error('Socket error', error);
        });

        // Confirm login.
        return global.streamerChat.auth(channelId, userId, authkey)
        .then(() => {
            console.log('Logged into chat as '+chatter+'.');
        });
    } else {
        // Chat connection
        global.botChat = new BeamSocket(endpoints).boot();

        // React to chat messages
        global.botChat.on('ChatMessage', data => {
            if (data.message.message[0].data.toLowerCase().startsWith('!ping')) {
                // You can do fun stuff here to auto respond to certain commands.
            }
        });

        // Handle errors
        global.botChat.on('error', error => {
            // Popup error.
            renderWindow.webContents.send('error', "There was an error with chat or it was disconnected.");

            // Send error message to gui
            renderWindow.webContents.send('chat-disconnect');

            // Log for dev.
            console.error('Socket error', error);
        });

        // Confirm connection.
        return global.botChat.auth(channelId, userId, authkey)
        .then(() => {
            console.log('Logged into chat as '+chatter+'.');
        });
    }
}

// Disconnect from chat
// This should gracefully disconnect from chat.
function chatDisconnect(){
    if (global.streamerChat !== undefined){
        console.log('Disconnecting streamer chat.');
        global.streamerChat.close();
    }
    if(global.botChat !== undefined){
        console.log('Disconnecting bot chat.');
        global.botChat.close();
    }
}

// Whisper
// Send a whisper to a specific person from whoever the chatter is (streamer or bot).
function whisper(chatter, username, message){
     if (chatter == "Streamer"){
        try{
            global.streamerChat.call('whisper', [username, message]);
            console.log('Sent message as '+chatter+'.')
        }catch(err){
            renderWindow.webContents.send('error', "There was an error sending a whisper to chat as the streamer.");
        }
     } else if (chatter == "Bot") {
        try{
            global.botChat.call('whisper', [username, message]);
            console.log('Sent message as '+chatter+'.')
        }catch(err){
            renderWindow.webContents.send('error', "There was an error sending a whisper to chat as the bot.");
        }
     }	 
}

// Broadcast
// Send a broadcast to the channel from whoever the chatter is (streamer or bot).
function broadcast(chatter, message){
    if(chatter == "Streamer"){
        try{
            global.streamerChat.call('msg', [message]);
            console.log('Sent message as '+chatter+'.')
        } catch(err){
            renderWindow.webContents.send('error', "There was an error sending a message to chat as the streamer.");
        }
    } else if (chatter == "Bot"){
        try{
            global.botChat.call('msg', [message]);
            console.log('Sent message as '+chatter+'.')
        } catch(err){
            renderWindow.webContents.send('error', "There was an error sending a message to chat as the bot");
        }
    }
}


// Export Functions
exports.connect = chatConnect;
exports.disconnect = chatDisconnect;
exports.whisper = whisper;
exports.broadcast = broadcast;