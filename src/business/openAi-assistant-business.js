import * as dotenv from "dotenv/config.js";
import { DiscordBotBusiness } from "../business/index.js";
import { ThreadRepository } from "../repository/index.js";
import { OpenAI } from "openai"; 

export class OpenAiAssistantBusiness {
    OPEN_AI_ORGANIZATION_ID = process.env.OPEN_AI_ORGANIZATION_ID;
    OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;
    OPEN_AI_ASSISTANT_ID = process.env.OPEN_AI_ASSISTANT_ID;
    
    discordBotBusiness;
    threadRepository;
    openAiClient;
    instance;

    constructor() {
        if (OpenAiAssistantBusiness.instance) {
            return OpenAiAssistantBusiness.instance;
        }

        // Perform initialization tasks here...
        this.openAiClient = new OpenAI({
            organization: this.OPEN_AI_ORGANIZATION_ID,
            apiKey: this.OPEN_AI_API_KEY
        });

        this.discordBotBusiness = new DiscordBotBusiness();
        this.threadRepository = new ThreadRepository();

        OpenAiAssistantBusiness.instance = this;
    }

    async askOpenAiAssistant(message) {
        let isFirstAnswer = false;
        let openaiThreadId = (await this.threadRepository.getThreadFromDiscordThreadId(message.channelId)).openaiThreadId;
        if(!openaiThreadId) {
            isFirstAnswer = true;
            openaiThreadId = (await this.openAiClient.beta.threads.create()).id;
        }

        

        await this.openAiClient.beta.threads.messages.create(
            openaiThreadId,
            {
                role: "user",
                content: this.discordBotBusiness.getContentFromMessage(message)
            }
        );

        let run = await this.openAiClient.beta.threads.runs.createAndPoll(
            openaiThreadId,
            { 
                assistant_id: this.OPEN_AI_ASSISTANT_ID,
                additional_instructions: `${isFirstAnswer ? `The user talking to you is called ${this.discordBotBusiness.getDiscordUserInfo(message).discordUsername}. You DO NOT have to put the user's name in every reply.` : ''}`
            }
        );

        return run;
    }
}