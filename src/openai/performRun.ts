import OpenAI from "openai";
import { Thread } from "openai/resources/beta/threads/threads";
import { Run } from "openai/resources/beta/threads/runs/runs";
import { handleRunToolCalls } from "./handleRunToolCalls.js";

export async function performRun(run: Run, client: OpenAI, thread: Thread) {
    console.log(`🚀 Starting run ${run.id} with status: ${run.status}`);

    while (run.status === "requires_action") {
        console.log(`⚙️ Run requires action - handling tool calls`);
        run = await handleRunToolCalls(run, client, thread);
        console.log(`📊 Updated run status: ${run.status}`);
    }

    if (run.status === 'failed') {
        const errorMessage = `I encountered an error: ${run.last_error?.message || 'Unknown error'}`;
        console.error('❌ Run failed:', run.last_error);
        console.log('📝 Creating error message in thread');
        await client.beta.threads.messages.create(thread.id, {
            role: 'assistant',
            content: errorMessage
        });
        return {
            type: 'text',
            text: {
                value: errorMessage,
                annotations: []
            }
        };
    }

    console.log(`📥 Fetching messages from thread ${thread.id}`);
    const messages = await client.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(message => message.role === 'assistant');

    if (!assistantMessage) {
        console.log('⚠️ No assistant message found');
        return { type: 'text', text: { value: 'No response from assistant', annotations: [] } };
    }

    if (assistantMessage.content[0].type === 'text') {
        console.log('🤖 Assistant response:', assistantMessage.content[0].text.value);
    } else {
        console.log('📎 Assistant response type:', assistantMessage.content[0].type);
    }

    return assistantMessage.content[0] ||
        { type: 'text', text: { value: 'No response from assistant', annotations: [] } };
}
