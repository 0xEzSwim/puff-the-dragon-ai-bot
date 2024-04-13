import * as fs from "fs";

export const logMessage = (message) => {
    console.log(`[channel #${message.channel.id} - ${message.createdTimestamp}] ${message.author.username}: "${message.content}"`);
}