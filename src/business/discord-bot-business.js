import * as dotenv from "dotenv/config.js";
import { 
    UserRepository,
    ThreadRepository, 
    MessageRepository
    } from "../repository/index.js";
import { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ChannelType, 
    EmbedBuilder 
} from "discord.js";

export class DiscordBotBusiness {
    DISCORD_CHANNEL_IDS = [process.env.DISCORD_CHANNEL_ID];


    discordClient;
    userRepository;
    threadRepository;
    messageRepository;
    instance;

    constructor() {
        if (DiscordBotBusiness.instance) {
            return DiscordBotBusiness.instance;
        }

        // Perform initialization tasks here...
        this.discordClient = new Client({
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

        this.userRepository = new UserRepository();
        this.threadRepository = new ThreadRepository();
        this.messageRepository = new MessageRepository();

        DiscordBotBusiness.instance = this;
    }

    isBotFromMessage(message) {
        // The bot always replies in embed messages
        return !!message?.embeds?.length;
    }

    getContentFromMessage(message) {
        return this.isBotFromMessage(message) ? message.embeds[0].description : message.content;
    }

    async logAndSaveMessage(message, discordThreadId = null, openaiThreadId = null) {
        if(message.type != 0) {
            return;
        }
        await this.saveMessage(message, discordThreadId, openaiThreadId);
        this.logMessage(message, discordThreadId);
    }

    logMessage(message, discordThreadId = null) {
        console.log(`->  [channel #${discordThreadId ?? message.channelId}] ${message.author.username}: "${this.getContentFromMessage(message)}"`);
    }

    async saveMessage(message, discordThreadId = null, openaiThreadId = null) {
        let user = await this.userRepository.getUserFromDiscordUserId(message.author.id);
        if(!user) {
            user = await this.userRepository.saveUser(message.author.id, `${message.author.globalName ?? message.author.username}`);
        }

        let thread;
        if(message.channel.isThread()){
            thread = await this.threadRepository.updateThread(message.channelId);
        } else {
            thread = await this.threadRepository.saveThread(user.id, discordThreadId, openaiThreadId);
        }

        await this.messageRepository.saveMessage(this.getContentFromMessage(message), user.id, thread.id);
    }

    messageTemplate(reply) {
        return new EmbedBuilder()
        .setColor(0xFFD700)
        .setDescription(reply)
        .addFields(
            { 
                name: '\u200B\nOfficial Links', 
                value: "[Website](https://puffthedragon.xyz) • [Puff's Penthouse](https://www.methlab.xyz/puffpenthouse)" 
            }
        );
    }

    async reply(message, reply) {
        const userMsg = this.getContentFromMessage(message);

        if(message.channel.isThread()) {
            await this.logAndSaveMessage(message);
            await message.channel.send({ embeds: [this.messageTemplate(reply)] });
        } else {
            const mainChannel = await this.discordClient.channels.fetch(this.DISCORD_CHANNEL_IDS[0]);
            const thread = await mainChannel.threads.create({
                name: userMsg,
                autoArchiveDuration: 60,
                type: ChannelType.PrivateThread,
                reason: userMsg,
            });
            await thread.members.add(message.author.id);
            await this.logAndSaveMessage(message, thread.id);

            this.DISCORD_CHANNEL_IDS.push(thread.id);
            await thread.send({ embeds: [this.messageTemplate(reply)] });
        }
    }
}