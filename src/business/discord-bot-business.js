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
    DISCORD_QUESTION_MAX = +process.env.DISCORD_QUESTION_MAX;
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
            user = await this.userRepository.saveUser(userInfo);
        }

        return user;
    }

    getDiscordUserInfo(event) {
        let userInfo = {
            discordUserId: null,
            discordUsername: null,
            isBot: null
        };

        if(event.type == 0) {
            userInfo.discordUserId = event.author.id;
            userInfo.discordUsername = `${event.author.globalName ?? event.author.username}`;
            userInfo.isBot = event.author.bot;
        }
        else if(event.type == 3) {
            userInfo.discordUserId = event.user.id;
            userInfo.discordUsername = `${event.user.globalName ?? event.member.user.username}`;
            userInfo.isBot = event.user.bot;
        }

        return userInfo;
    }
    //#endregion

    //#region THREAD
    async openNewDiscordThread(interaction) {
        const userInfo = this.getDiscordUserInfo(interaction);
        const mainChannel = await this.discordClient.channels.fetch(this.DISCORD_CHANNEL_ID);

        const discordThreadId = (await this.threadRepository.getLastActiveThreadFromDiscordUserId(userInfo.discordUserId))?.discordThreadId;
        if(discordThreadId) {
            await interaction.reply({ 
                embeds: [this.instructionMessageTemplate(`Oops! Looks like you've got the dragon's attention already!
                Let’s keep our chat in the thread <#${discordThreadId}> you've opened so we can keep all the magic in one mystical place! 🔮🐉`)],
                ephemeral: true
                });
            return;
        }

        // Discord
        const thread = await mainChannel.threads.create({
            name: userInfo.discordUsername,
            autoArchiveDuration: (this.DISCORD_CHANNEL_DURATION / 60000),
            type: ChannelType.PrivateThread,
            reason: userInfo.discordUsername,
        });
        // DB
        await this.saveThread(interaction, thread.id);

        // Discord
        interaction.deferUpdate();
        await thread.members.add(interaction.member.user.id);
        await thread.send({ embeds: [this.messageTemplate(this.CONVERSATION_STARTER, 0, this.DISCORD_QUESTION_MAX)] });
    }

    //#region THREAD CRUD
    async saveThread(interaction, discordThreadId) {
        const user = await this.getOrCreateUser(interaction);
        const thread = await this.threadRepository.saveThread(user.id, discordThreadId);
        
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

    async archiveThread(thread) {
        return await this.threadRepository.updateThread(thread.id, null, true, null, null);
    }

    async deleteThread(thread) {
        return await this.threadRepository.updateThread(thread.id, null, null, true, null);
    }
    //#endregion
    //#endregion

    //#region MESSAGE
    async replyInDiscordThread(message, reply, questionQuota, openaiThreadId = null) {
        if(!message.channel.isThread()) {
            return;
        }
        
        // DB
        await this.logAndSaveMessage(message, openaiThreadId);

        // Discord
        await message.channel.send({ embeds: [this.messageTemplate(reply, questionQuota + 1, this.DISCORD_QUESTION_MAX)] });
    }

    async sendReachedQuotaInDiscordThread(message) {
        const thread = await this.threadRepository.getThreadFromDiscordThreadId(message.channelId);
        if(thread.hasReachedMaxQuota) {
            return;
        }

        // DB
        await this.threadRepository.updateThread(thread.discordThreadId, null, null, null, true);

        // Discord
        const reply = `Whoa! You've reached your maximum questions quota (${this.DISCORD_QUESTION_MAX}), remember, pacing is key in the crypto world! It’s a great time to reflect on the info you've gathered, strategize your next moves, or simply enjoy the fiery ride. Don’t worry; I’ll be right here waiting to assist you with more blazing answers once you're ready to dive back in. Keep the fire alive and the dragons soaring! 🐉🔥`;
        await message.channel.send({ embeds: [this.messageTemplate(reply, this.DISCORD_QUESTION_MAX, this.DISCORD_QUESTION_MAX)] });
        const mainChannel = await this.discordClient.channels.fetch(this.DISCORD_CHANNEL_ID);
        const discordThread = await mainChannel.threads.fetch(thread.discordThreadId);
        await discordThread.setLocked(true);
    }

    async getCurrentQuestionQuota(message) {
        return await this.messageRepository.getMessagesQuotaFromDiscordThreadId(message.channelId);
    }

    isBotFromMessage(message) {
        // The bot always replies in embed messages
        return !!message?.embeds?.length;
    }

    getContentFromMessage(message) {
        return this.isBotFromMessage(message) ? message.embeds[0].description : message.content;
    }

    async logAndSaveMessage(message, openaiThreadId) {
        if(message.type != 0) {
            return;
        }
        await this.saveMessage(message, openaiThreadId);
        this.logMessage(message);
    }

    logMessage(message) {
        console.log(`->  [channel #${message.channelId}] ${message.author.username}: "${this.getContentFromMessage(message)}"`);
    }

    messageTemplate(messageContent, questionQuota, questionMax) {
        return new EmbedBuilder()
        .setColor(0xFFD700)
        .setDescription(messageContent)
        .addFields(
            { 
                name: '\u200B\nOfficial Links', 
                value: "[Website](https://puffthedragon.xyz) • [Puff's Penthouse](https://www.methlab.xyz/puffpenthouse)" 
            }
        )
        .setFooter({ text: `quota - ${questionQuota} / ${questionMax}` });
    }

    //#region MESSAGE CRUD
    async saveMessage(message, openaiThreadId) {
        const user = await this.getOrCreateUser(message);
        const thread = await this.threadRepository.updateThread(message.channelId, openaiThreadId, null, null, null);
        const messageDb = await this.messageRepository.saveMessage(this.getContentFromMessage(message), user.id, thread.id);
        
        return messageDb;
    }
    //#endregion
    //#endregion
}