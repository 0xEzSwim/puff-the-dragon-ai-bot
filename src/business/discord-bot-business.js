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
    EmbedBuilder,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} from "discord.js";

export class DiscordBotBusiness {
    DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
    DISCORD_CHANNEL_DURATION = +process.env.DISCORD_CHANNEL_DURATION_IN_MS;
    CONVERSATION_STARTER = `Hey there! 🐉 I'm your dedicated Discord assistant here to help light up your crypto journey with Mantle's coolest meme coin, PUFF! Whether you've got burning questions about our dragon lore, need help navigating the fiery depths of blockchain, or just want to shoot the breeze about all things PUFF, I'm here for it! Let's make some magic happen! 🔥❤️‍🔥🌬️`;

    userRepository;
    threadRepository;
    messageRepository;
    discordClient;
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

    //#region SETUP
    async setupDiscordChannel(channel, instructionMessageContent) {
        // Resets channel messages
        let fetched;
        do {
            fetched = await channel.messages.fetch({limit: 100});
            channel.bulkDelete(fetched);
        }
        while(fetched.size >= 2);

        // Build instruction message
        const row = new ActionRowBuilder();
        row.components.push(
            new ButtonBuilder()
            .setCustomId(this.DISCORD_CHANNEL_ID)
            .setLabel("Start Chatting 💬")
            .setStyle(ButtonStyle.Primary)
        );
        await channel.send({ 
            embeds: [this.instructionMessageTemplate(instructionMessageContent)],
            components: [row] 
        });
    }

    instructionMessageTemplate(messageContent) {
        return new EmbedBuilder()
        .setColor(0xFFD700)
        .setDescription(messageContent);
    }
    //#endregion

    //#region USER
    async getOrCreateUser(event) {
        const userInfo = this.getDiscordUserInfo(event);
        let user = await this.userRepository.getUserFromDiscordUserId(userInfo.discordUserId);
        if(!user) {
            user = await this.userRepository.saveUser(userInfo.discordUserId, userInfo.discordUsername);
        }

        return user;
    }

    getDiscordUserInfo(event) {
        let userInfo = {
            discordUserId: null,
            discordUsername: null
        };

        if(event.type == 0) {
            userInfo.discordUserId = event.author.id;
            userInfo.discordUsername = `${event.author.globalName ?? event.author.username}`;
        }
        else if(event.type == 3) {
            userInfo.discordUserId = event.member.user.id;
            userInfo.discordUsername = `${event.member.user.globalName ?? event.member.user.username}`;
        }

        return userInfo;
    }
    //#endregion

    //#region THREAD
    async openNewDiscordThread(interaction) {
        //Add check for only one thread by user

        const userInfo = this.getDiscordUserInfo(interaction);
        // Discord
        const mainChannel = await this.discordClient.channels.fetch(this.DISCORD_CHANNEL_ID);
        const thread = await mainChannel.threads.create({
            name: userInfo.discordUsername,
            autoArchiveDuration: (this.DISCORD_CHANNEL_DURATION / 60000),
            type: ChannelType.PrivateThread,
            reason: userInfo.discordUsername,
        });
        // DB
        await this.saveThread(interaction, thread.id);

        // Discord
        await thread.members.add(interaction.member.user.id);
        await thread.send({ embeds: [this.messageTemplate(this.CONVERSATION_STARTER)] });
    }

    //#region THREAD CRUD
    async saveThread(interaction, discordThreadId, openaiThreadId = null) {
        const user = await this.getOrCreateUser(interaction);
        const thread = await this.threadRepository.saveThread(user.id, discordThreadId, openaiThreadId);
        
        return thread;
    }

    async getAllActiveThreads() {
        let activeThreads = await this.threadRepository.getAllActiveThreads();
        if(!activeThreads) {
            return [];
        }

        activeThreads = activeThreads.map(thread => ({
            discordUserId: thread.discordUserId,
            discordThreadId: thread.discordThreadId, 
            openaiThreadId: thread.openaiThreadId,
        }));
        return activeThreads;
    }
    //#endregion
    //#endregion

    //#region MESSAGE
    async replyInDiscordThread(message, reply) {
        if(!message.channel.isThread()) {
            return;
        }
        
        // DB
        await this.logAndSaveMessage(message);

        // Discord
        await message.channel.send({ embeds: [this.messageTemplate(reply)] });
    }

    isBotFromMessage(message) {
        // The bot always replies in embed messages
        return !!message?.embeds?.length;
    }

    getContentFromMessage(message) {
        return this.isBotFromMessage(message) ? message.embeds[0].description : message.content;
    }

    async logAndSaveMessage(message) {
        if(message.type != 0) {
            return;
        }
        await this.saveMessage(message);
        this.logMessage(message);
    }

    logMessage(message) {
        console.log(`->  [channel #${message.channelId}] ${message.author.username}: "${this.getContentFromMessage(message)}"`);
    }

    messageTemplate(messageContent) {
        return new EmbedBuilder()
        .setColor(0xFFD700)
        .setDescription(messageContent)
        .addFields(
            { 
                name: '\u200B\nOfficial Links', 
                value: "[Website](https://puffthedragon.xyz) • [Puff's Penthouse](https://www.methlab.xyz/puffpenthouse)" 
            }
        );
    }

    //#region MESSAGE CRUD
    async saveMessage(message) {
        const user = await this.getOrCreateUser(message);
        const thread = await this.threadRepository.updateThread(message.channelId);
        const messageDb = await this.messageRepository.saveMessage(this.getContentFromMessage(message), user.id, thread.id);
        
        return messageDb;
    }
    //#endregion
    //#endregion
}