import * as dotenv from "dotenv/config.js";
import { Client, GatewayIntentBits, Partials, ChannelType, EmbedBuilder, Embed } from "discord.js";
import { OpenAI } from "openai"; 
import {
    logMessage
} from "./utils/index.js";

//#region GLOBAL VARIABLES
const OPEN_AI_ORGANIZATION_ID = process.env.OPEN_AI_ORGANIZATION_ID;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;
const OPEN_AI_ASSISTANT_ID = process.env.OPEN_AI_ASSISTANT_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
let DISCORD_CHANNEL_IDS = [process.env.DISCORD_CHANNEL_ID];
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

//#region DISCORD BOT TEMPLATE
const discordMessageTemplate = (reply) => new EmbedBuilder()
	.setColor(0xFFD700)
	.setDescription(reply)
	.setTimestamp();
//#endregion

const getUserMessageContent = (message) => message.content;
const discordBotReply = async (message, reply) => {
    const userMsg = getUserMessageContent(message);

    if(message.channel.isThread()) {
        await message.channel.send({ embeds: [discordMessageTemplate(reply)] });
    } else {
        const thread = await message.startThread({
            name: `${message.author?.globalName ?? message.author?.username} asked "${userMsg}"`,
            autoArchiveDuration: 60,
            type: ChannelType.PrivateThread,
            reason: userMsg,
        });
        // When creating a thread from message, the message id becomes the thread's channel id
        DISCORD_CHANNEL_IDS.push(message.id);

        await thread.send({ embeds: [discordMessageTemplate(reply)] });
    }
}

const askOpenAiAssistant = async (message) => {
    const thread = await openai.beta.threads.create();
    const userRequest = await openai.beta.threads.messages.create(
        thread.id,
        {
            role: "user",
            content: getUserMessageContent(message)
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
    console.log(`${client.user} is now running and listening to channel #${DISCORD_CHANNEL_IDS[0]}!`);
    // We need a way to load open discord threads maybe a .json file?
    // const thread = channel.threads.cache.filter((x) => x.id).map(x => x.id);
});

client.on('messageCreate', async (message) => {
    if (message.author.id == client.user.id) {
        logMessage(message.content);
        return;
    }

    if (DISCORD_CHANNEL_IDS.includes(+message.channelId)) {
        return;
    }

    logMessage(message.content);

    await message.channel.sendTyping();
    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000);

    // Comment the ligne below and uncomment the line after thath when testing localy as to not burn all openAI credit
    let openAiRun = await askOpenAiAssistant(message);
    // let openAiRun = {status: 'failed'};

    clearInterval(sendTypingInterval);

    if (openAiRun.status === 'completed') {
        const openAiMessages = await openai.beta.threads.messages.list(openAiRun.thread_id);
        const openAiReply = openAiMessages.data[0].content[0].text.value;
        console.log(`${openAiReply.role} > ${openAiReply}`);
        await discordBotReply(message, openAiReply);
    } else if (openAiRun.status === 'failed') {
        const failedReply = `I didn't catch what you meant by "${message.content}"\n${ERROR_ANSWER}`;
        console.log(`puff > ${failedReply}`);
        discordBotReply(message, failedReply);
    } else {
        console.log(openAiRun.status);
    }

    console.log(`DONE\n`);
    
});
//#endregion

//#region DISCORD BOT LAUNCH
client.login(DISCORD_BOT_TOKEN);
//#endregion