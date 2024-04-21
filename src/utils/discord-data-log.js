import { promises as fs } from 'fs';

const LOG_PATH = './logs';

//#region DISCORD UTILS
export const isSenderBot = (message) => {
    // The bot always replies in embed messages
    return !!message?.embeds?.length;
}

export const getContentFromMessage = (message) => {
    return isSenderBot(message) ? message.embeds[0].description : message.content;
}
//#endregion

//#region THREADS LOGGING
export const logAndSaveMessage = async (message, threadId = 0) => {
    if(message.type != 0) {
        return;
    }
    await saveMessage(message, threadId);
    logMessage(message, threadId);
}

const logMessage = (message, threadId = 0) => {
    console.log(`->  [channel #${threadId || message.channelId}] ${message.author.username}: "${getContentFromMessage(message)}"`);
}

const saveMessage = async (message, threadId = 0) => {
    let jsonData;
    const messageData = {
        userId: message.author.id,
        username: `${message.author?.globalName ?? message.author?.username}`,
        message: getContentFromMessage(message),
        createdTimestamp: message.createdTimestamp
    };

    if(message.channel.isThread()){
        const data = await fs.readFile(`${LOG_PATH}/threads/thread-${message.channelId}.json`);
        jsonData = JSON.parse(data);

        jsonData.messages.push(messageData);
        jsonData.updatedTimestamp = messageData.createdTimestamp;
    } else {
        jsonData = {
            threadId: threadId,
            userId: messageData.userId,
            username: messageData.username,
            createdTimestamp: messageData.createdTimestamp,
            updatedTimestamp: messageData.createdTimestamp,
            messages: [messageData],
        };
    }
    await fs.writeFile(`${LOG_PATH}/threads/thread-${jsonData.threadId}.json`, JSON.stringify(jsonData));
    await updateLastOpenedThreads({
        threadId: jsonData.threadId,
        createdTimestamp: jsonData.createdTimestamp,
        updatedTimestamp: jsonData.updatedTimestamp,
    });

}
//#endregion

//#region LAST OPENED THREADS
const getInitLastOpenedThreads = () => {
    const now = Date.now();
    return {
        threadCount: 0,
        threads: [],
        createdTimestamp: now,
        updatedTimestamp: now
    };
}

const getLastOpenedThreads = async () => {
    try {
        const data = await fs.readFile(`${LOG_PATH}/last-opened-threads.json`);
        return JSON.parse(data);
    } catch {
        const  initialData = getInitLastOpenedThreads();
        await fs.writeFile(`${LOG_PATH}/last-opened-threads.json`, JSON.stringify(initialData));
        return initialData;
    }

    
}

const updateLastOpenedThreads = async (thread) => {
    let jsonData = await getLastOpenedThreads();

    const location = findLocationInSortedArray(+thread.threadId, jsonData.threads.map(thread => +thread.threadId));
    // No duplicate threadId in threads
    if(+(jsonData.threads[location]?.threadId) != +thread.threadId) {
        jsonData.threadCount++;
        addToSortedArray(thread, jsonData.threads);
    }

    jsonData.threads[location].updatedTimestamp = thread.updatedTimestamp;
    jsonData.updatedTimestamp = thread.updatedTimestamp;
    await fs.writeFile(`${LOG_PATH}/last-opened-threads.json`, JSON.stringify(jsonData));
}

export const getActiveAndUpdateLastOpenedThreads = async () => {
    const lastData = await getLastOpenedThreads();
    // If the last-opened-threads.json was just created
    if(+lastData.updatedTimestamp == +lastData.createdTimestamp) {
        return;
    }

    let newData = getInitLastOpenedThreads();
    let threadIds = [];

    for (let index = 0; index < lastData.threadCount; index++) {
        const thread = lastData.threads[index];
        if((Date.now() - thread.updatedTimestamp) > 3.6e6){
            continue;
        }

        newData.threads.push(thread);
        threadIds.push(thread.threadId);
    }
    newData.threadCount = newData.threads.length;
    newData.updatedTimestamp = Date.now();
    await fs.writeFile(`${LOG_PATH}/last-opened-threads.json`, JSON.stringify(newData));

    return threadIds;
}

const addToSortedArray = (element, array) => { 
    array.splice(findLocationInSortedArray(element, array) + 1, 0, element); 
    return array; 
} 
      
const findLocationInSortedArray = (element, array, start, end) => { 
    start = start || 0; 
    end = end || array.length; 
    var pivot = parseInt(start + (end - start) / 2, 10); 
    if (end - start <= 1 || array[pivot] === element) return pivot; 
    if (array[pivot] < element) { 
        return findLocationInSortedArray(element, array, pivot, end); 
    } else { 
        return findLocationInSortedArray(element, array, start, pivot); 
    } 
}
//#endregion