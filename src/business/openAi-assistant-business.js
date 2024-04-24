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
        const thread = await this.openAiClient.beta.threads.create();
        const userRequest = await this.openAiClient.beta.threads.messages.create(
            thread.id,
            {
                role: "user",
                content: this.discordBotBusiness.getContentFromMessage(message)
            }
        );

        let run = await this.openAiClient.beta.threads.runs.createAndPoll(
            thread.id,
            { 
                assistant_id: this.OPEN_AI_ASSISTANT_ID
            }
        );

        return run;
    }
}