import * as dotenv from "dotenv/config.js";
import { Client } from "discord.js";
import { OpenAI } from "openai"; 

//#region GLOBAL VARIABLES
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;
const OPEN_AI_ASSISTANT_ID = process.env.OPEN_AI_ASSISTANT_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD__CHANNEL_ID;
const CHANNEL_PREFIX = '!';
const PRIVATE_PREFIX = '?';
//#endregion

//#region CLIENTS
const openai = new OpenAI({
    apiKey: OPEN_AI_API_KEY
});
const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent'] 
});
//#endregion

const discordSend = async (message, reply) => {
    // Max sized char in one discord message
    const chunkSizeLimit = 2000;
    const isPrivate = message.content[0] == PRIVATE_PREFIX;

    if(isPrivate) {
        for (let i = 0; i < reply.length; i += chunkSizeLimit) {
            const replyChunk = reply.substring(i, i + chunkSizeLimit);
            await message.author.send(replyChunk);
        }
    } else {
        for (let i = 0; i < reply.length; i += chunkSizeLimit) {
            const replyChunk = reply.substring(i, i + chunkSizeLimit);
            await message.reply(replyChunk);
        }
    }
}

//#region DISCORD EVENTS
client.on('ready', () => {
    console.log(`${client.user} is now running and listening to channel #${DISCORD_CHANNEL_ID}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.id == client.user.id) {
        return;
    }
    if (message.channelId != +DISCORD_CHANNEL_ID) {
        return;
    }
    if (message.content[0] != CHANNEL_PREFIX && message.content[0] != PRIVATE_PREFIX) {
        await message.channel.send(`I only talk to dragons who start their sentences with a \`${CHANNEL_PREFIX}\`\nIf you're shy, you can always start your message with a \`${PRIVATE_PREFIX}\` and I'll answer you privately!`);
        console.log(`message #${message.id} is missing the prefix`);
        return;
    }

    console.log(`[message #${message.id}] ${message.author.username}: "${message.content.substring(1)}"`);

    await message.channel.sendTyping();
    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000);

    const thread = await openai.beta.threads.create();

    const userRequest = await openai.beta.threads.messages.create(
        thread.id,
        {
            role: "user",
            content: message.content.substring(1)
        }
    );

    let run = await openai.beta.threads.runs.createAndPoll(
        thread.id,
        { 
            assistant_id: OPEN_AI_ASSISTANT_ID,
            instructions: "Please address the user as Jane Doe. The user has a premium account."
        }
    );

    clearInterval(sendTypingInterval);

    if (run.status === 'completed') {
        const openAiMessages = await openai.beta.threads.messages.list(run.thread_id);
        for (const openAiMessage of openAiMessages.data.reverse()) {
            console.log(`${openAiMessage.role} > ${openAiMessage.content[0].text.value}`);
            await discordSend(message, openAiMessage.content[0].text.value);
        }
    } else if (run.status === 'failed') {
        discordSend(message, "I'm here to help you with any questions you have about PUFF the dragon. How can I assist you today?");
    } else {
        console.log(run.status);
    }

    console.log(`[message #${message.id}] Puff: ANSWERED\n`);
    
});
//#endregion

//#region DISCORD BOT LAUNCH
client.login(DISCORD_BOT_TOKEN);
//#endregion