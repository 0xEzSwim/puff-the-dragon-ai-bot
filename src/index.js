import * as dotenv from "dotenv/config.js";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { OpenAI } from "openai"; 

//#region GLOBAL VARIABLES
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;
const OPEN_AI_ASSISTANT_ID = process.env.OPEN_AI_ASSISTANT_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const CHANNEL_PREFIX = '!';
const PRIVATE_PREFIX = '?';
const DEFAULT_ANSWER = `I only talk to dragons who start their sentences with a \`${CHANNEL_PREFIX}\`\nIf you're shy, you can always start your message with a \`${PRIVATE_PREFIX}\` and I'll answer you privately!`;
const ERROR_ANSWER = "I'm here to help you with any questions you have about PUFF the dragon. How can I assist you?";
//#endregion

//#region CLIENTS
const openai = new OpenAI({
    apiKey: OPEN_AI_API_KEY
});
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.Message
    ]
});
//#endregion

const getUserMessageContent = (message, isDm = true) => isDm ? message.content : message.content.substring(1);
const discordSend = async (message, reply, isDm) => {
    // Max sized char in one discord message
    const chunkSizeLimit = 2000;
    // if not Dm, message has "!" or "?" prefix
    const isPrivate = isDm || message.content[0] == PRIVATE_PREFIX;

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

const askOpenAiAssistant = async (message, isDm) => {
    const messageContent = getUserMessageContent(message, isDm);
    const thread = await openai.beta.threads.create();
    const userRequest = await openai.beta.threads.messages.create(
        thread.id,
        {
            role: "user",
            content: messageContent
        }
    );

    let run = await openai.beta.threads.runs.createAndPoll(
        thread.id,
        { 
            assistant_id: OPEN_AI_ASSISTANT_ID
        }
    );

    return run;
}

//#region DISCORD EVENTS
client.on('ready', () => {
    console.log(`${client.user} is now running and listening to channel #${DISCORD_CHANNEL_ID}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.id == client.user.id) {
        return;
    }
    
    const isDm = message.guild === null;
    if (message.channelId != +DISCORD_CHANNEL_ID && !isDm) {
        return;
    }
    if (message.content[0] != CHANNEL_PREFIX && message.content[0] != PRIVATE_PREFIX && !isDm) {
        await message.channel.send(DEFAULT_ANSWER);
        console.log(`message #${message.id} is missing the prefix`);
        return;
    }

    const userMessageContent = getUserMessageContent(message, isDm);
    console.log(`[message #${message.id}] ${message.author.username}: "${userMessageContent}"`);

    await message.channel.sendTyping();
    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000);

    let openAiResponse = await askOpenAiAssistant(message, isDm);

    clearInterval(sendTypingInterval);

    if (openAiResponse.status === 'completed') {
        const openAiMessages = await openai.beta.threads.messages.list(openAiResponse.thread_id);
        for (const openAiMessage of openAiMessages.data.reverse()) {
            console.log(`${openAiMessage.role} > ${openAiMessage.content[0].text.value}`);
            await discordSend(message, openAiMessage.content[0].text.value, isDm);
        }
    } else if (openAiResponse.status === 'failed') {
        const failedReply = `I could not understant what you meant by "${userMessageContent}"\n${ERROR_ANSWER}`;
        discordSend(message, failedReply, isDm);
    } else {
        console.log(openAiResponse.status);
    }

    console.log(`[message #${message.id}] ANSWERED\n`);
    
});
//#endregion

//#region DISCORD BOT LAUNCH
client.login(DISCORD_BOT_TOKEN);
//#endregion