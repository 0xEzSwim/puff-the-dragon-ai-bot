import * as dotenv from "dotenv/config.js";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { OpenAI } from "openai"; 

//#region GLOBAL VARIABLES
const OPEN_AI_ORGANIZATION_ID = process.env.OPEN_AI_ORGANIZATION_ID;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;
const OPEN_AI_ASSISTANT_ID = process.env.OPEN_AI_ASSISTANT_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const CHANNEL_PREFIX = '!';
const PRIVATE_PREFIX = '?';
const DEFAULT_ANSWER = `Hey there, dragon fam! 🔥 Only true dragons start their chat with a \`${CHANNEL_PREFIX}\` 🐉 If you're a bit on the shy side, no worries! Just hit me up with a \`${PRIVATE_PREFIX}\` and I'll slide into your DMs with an answer! Keep it fiery, folks! 🚀😉`;
const ERROR_ANSWER = "I'm the super cool and helpful Discord assistant for the PUFF community, here to keep you updated and answering all your questions about our awesome meme coin 2.0 on the Mantle blockchain! Ready to blow some smoke and fire your way with answers! 🐉 Let's have some fun while we're at it! 💨🔥";
//#endregion

//#region CLIENTS
const openai = new OpenAI({
    organization: OPEN_AI_ORGANIZATION_ID,
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
    const thread = await openai.beta.threads.create();
    const userRequest = await openai.beta.threads.messages.create(
        thread.id,
        {
            role: "user",
            content: getUserMessageContent(message, isDm)
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

    let openAiRun = await askOpenAiAssistant(message, isDm);

    clearInterval(sendTypingInterval);

    if (openAiRun.status === 'completed') {
        const openAiMessages = await openai.beta.threads.messages.list(openAiRun.thread_id);
        const openAiReply = openAiMessages.data[0];
        console.log(`${openAiReply.role} > ${openAiReply.content[0].text.value}`);
        await discordSend(message, openAiReply.content[0].text.value, isDm);
    } else if (openAiRun.status === 'failed') {
        const failedReply = `I didn't catch what you meant by "${userMessageContent}"\n${ERROR_ANSWER}`;
        console.log(`puff > ${failedReply}`);
        discordSend(message, failedReply, isDm);
    } else {
        console.log(openAiRun.status);
    }

    console.log(`DONE\n`);
    
});
//#endregion

//#region DISCORD BOT LAUNCH
client.login(DISCORD_BOT_TOKEN);
//#endregion