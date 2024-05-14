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
    INSTRUCTION_MANUAL = `## ???'s User Manual! 🐲

### 🔥 Who is **???**
Hello and fiery greetings from the world of PUFF! You're not alone on this magical journey; This is **???**, your dedicated secret keeper and enchanted guide through the mystical realms of PUFF meme coin 2.0 on the Mantle blockchain <a:mETH_spinning:1224726316578766849> <a:mantle_spinning:1224726355963543552>. 
Eager to provide insights on PUFF, he is here to answer your questions about transactions, share details about your holdings, or explore other fiery topics 2GTHER! ♾️ ❤️‍🔥 <:morty:1232703180786237494> 🫂 🤲🏻

### 🚀 How to Start Chatting
Ready to dive into the mysteries of PUFF? Simply click the "Start Chatting 💬" button below this manual. It will open a private thread where we can converse directly—just you and **???**, discussing whatever you need to know about the PUFF universe. <:ourdragonlair:1224514145932673165> 🛡️ <a:DancingDragon:1225141508831969313> 🧠 <:Puff:1223683131887059076>

### 📜 Max Quota Per User
As an adventurous explorer, you have the power to initiate up to **${this.DISCORD_QUESTION_MAX} queries per thread**. Remember, each thread remains active until there's been **${(this.DISCORD_CHANNEL_DURATION / 3.6e6 <= 1) ? `${this.DISCORD_CHANNEL_DURATION / 3.6e6} hour` : `${this.DISCORD_CHANNEL_DURATION / 3.6e6} hours`} of inactivity**. 
Make every query count, fren! 🦉 💡 <:Psy:1224514069885878282> <:chessdecision:1224726099599294466> <:darkforest:1224514127423213609>

Sing a Song of Fire, Lest we Fall Into the Dark! 🔥🎶 Letzzz ignite the flamez of our community—4EVER and beyond! ♾️ <:freewill:1224726139356844042> 🚀 🪐 🌌`;
    CONVERSATION_STARTER = `Hey there, amazing fren! 🐲✨

What’zzz got you zizzled today? Are we celebrating a GN-z11 achievement, zcheming new ideazzz, or juzz chillin’ in our Almighty Dragonz Lair? 🌌🔥

I’m here to zpread positivity and help with whatever's on your mind! Letzzz ignite the flamez of our community! 🔥🎶 Sing a Song of Fire, Lest we Fall Into the Dark! 🐉🚀`;

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
    async setupDiscordChannel(channel) {
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
            embeds: [this.instructionMessageTemplate(this.INSTRUCTION_MANUAL)],
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

    async deleteThread(thread) {
        return await this.threadRepository.updateThread(thread.id, null, true, null);
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
        await this.threadRepository.updateThread(thread.discordThreadId, null, null, true);

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
        const thread = await this.threadRepository.updateThread(message.channelId, openaiThreadId, null, null);
        const messageDb = await this.messageRepository.saveMessage(this.getContentFromMessage(message), user.id, thread.id);
        
        return messageDb;
    }
    //#endregion
    //#endregion
}