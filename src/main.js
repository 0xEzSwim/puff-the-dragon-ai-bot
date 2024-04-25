import { Events } from "discord.js";
import { DiscordBotController } from "./controller/index.js";

const main = () => {
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    const discordBotController = new DiscordBotController();
    const discord = discordBotController.discordBotBusiness.discordClient;

    //#region DISCORD EVENTS
    discord.once(Events.ClientReady, async () => {
        await discordBotController.setupBot();
        console.log(`${discord.user} is now running`);
    });

    discord.on(Events.InteractionCreate, async (interaction) => {
        await discordBotController.openNewDiscordThread(interaction);
    });

    discord.on(Events.ThreadDelete, async (thread) =>{
        console.log(thread);
    });

    discord.on(Events.MessageCreate, async (message) => {
        await discordBotController.getBotReply(message);
    });
    //#endregion

    //#region DISCORD BOT LAUNCH
    discord.login(DISCORD_BOT_TOKEN);
    //#endregion
};

main();