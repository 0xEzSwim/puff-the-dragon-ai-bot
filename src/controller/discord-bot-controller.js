import {
    DiscordBotBusiness, 
    OpenAiAssistantBusiness
} from "../business/index.js";

export class DiscordBotController {
    ERROR_ANSWER = "I'm the super cool and helpful Discord assistant for the PUFF community, here to keep you updated and answering all your questions about our awesome meme coin 2.0 on the Mantle blockchain! Ready to blow some smoke and fire your way with answers! 🐉 Let's have some fun while we're at it! 💨🔥";


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

    async getBotReply(message) {
        if (message.author.id == this.discordBotBusiness.discordClient.user.id) {
            // Bot receives its answer
            await this.discordBotBusiness.logAndSaveMessage(message);
            return;
        }

        if (!this.discordBotBusiness.DISCORD_CHANNEL_IDS.includes(message.channelId)) {
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
            const openAiMessages = await this.OpenAiAssistantBusiness.openAiClient.beta.threads.messages.list(openAiRun.thread_id);
            const rawOpenAiReply = openAiMessages.data[0].content[0].text.value;
            const cleanedOpenAiReply = rawOpenAiReply.replace(/【.*】/, "").trim();
            await this.discordBotBusiness.reply(message, cleanedOpenAiReply);
        } else if (openAiRun.status === 'failed') {
            const failedReply = `I didn't catch what you meant by "${message.content}"\n\n${this.ERROR_ANSWER}`;
            await this.discordBotBusiness.reply(message, failedReply);
        } else {
            console.log(openAiRun.status);
        }

        clearInterval(sendTypingInterval);

    }
}