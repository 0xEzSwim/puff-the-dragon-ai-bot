import {
    DiscordBotBusiness, 
    OpenAiAssistantBusiness
} from "../business/index.js";

export class DiscordBotController {
    DEFAULT_MESSAGE = "I'm the super cool and helpful Discord assistant for the PUFF community, here to keep you updated and answering all your questions about our awesome meme coin 2.0 on the Mantle blockchain! Ready to blow some smoke and fire your way with answers! 🐉 Let's have some fun while we're at it! 💨🔥";

    discordBotBusiness;
    openAiAssistantBusiness;
    instance;

    constructor() {
        if (DiscordBotController.instance) {
            return DiscordBotController.instance;
        }

        this.discordBotBusiness = new DiscordBotBusiness();
        this.OpenAiAssistantBusiness = new OpenAiAssistantBusiness();

        DiscordBotController.instance = this;
    }

    async setupBot() {
        const mainChannel = await this.discordBotBusiness.discordClient.channels.fetch(this.discordBotBusiness.DISCORD_CHANNEL_ID);
        if(!mainChannel) {
            return;
        }

        await this.discordBotBusiness.setupDiscordChannel(mainChannel, this.DEFAULT_MESSAGE);
    }

    async openNewDiscordThread(interaction) {
        if (interaction.channelId !== this.discordBotBusiness.DISCORD_CHANNEL_ID) {
            return;
        }

        if(!(interaction.isButton() && interaction.customId === this.discordBotBusiness.DISCORD_CHANNEL_ID)) {
            return;
        }

        await this.discordBotBusiness.openNewDiscordThread(interaction);
    }

    async getBotReply(message) {
        const activeThreads = await this.discordBotBusiness.getAllActiveThreads();
        if (!activeThreads?.some(thread => (thread.discordThreadId === message.channelId))) {
            return;
        }

        if (message.author.id == this.discordBotBusiness.discordClient.user.id) {
            // Bot receives its answer
            await this.discordBotBusiness.logAndSaveMessage(message, null);
            return;
        }

        await message.channel.sendTyping();
        const sendTypingInterval = setInterval(() => {
            message.channel.sendTyping();
        }, 5000);

        // Comment the ligne below and uncomment the line after thath when testing localy as to not burn all openAI credit
        let openAiRun = await this.OpenAiAssistantBusiness.askOpenAiAssistant(message);
        // let openAiRun = {status: 'failed'};

        if (openAiRun.status === 'completed') {
            const openaiThreadId = openAiRun.thread_id;
            const openAiMessages = await this.OpenAiAssistantBusiness.openAiClient.beta.threads.messages.list(openaiThreadId);
            const rawOpenAiReply = openAiMessages.data[0].content[0].text.value;
            const cleanedOpenAiReply = rawOpenAiReply.replace(/【.*】/, "").trim();
            await this.discordBotBusiness.replyInDiscordThread(message, cleanedOpenAiReply, openaiThreadId);
        } else if (openAiRun.status === 'failed') {
            console.log(openAiRun.status);
            const failedReply = `I didn't catch what you meant by "${message.content}"\n\n${this.DEFAULT_MESSAGE}`;
            await this.discordBotBusiness.replyInDiscordThread(message, failedReply);
        }

        clearInterval(sendTypingInterval);
    }
}