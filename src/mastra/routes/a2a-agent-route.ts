import { registerApiRoute } from '@mastra/core/server';
import { randomUUID } from 'crypto';
import { Message } from '@mastra/core/a2a';

export const a2aAgentRoute = registerApiRoute('/a2a/agent/:agentId', {
  method: 'POST',
  handler: async c => {
    try {
      const mastra = c.get('mastra');
      const agentId = c.req.param('agentId');

      // Parse JSON-RPC 2.0 request
      const body = await c.req.json();
      const { jsonrpc, id: requestId, method, params } = body;

      // Validate JSON-RPC 2.0 format
      if (jsonrpc !== '2.0' || !requestId) {
        return c.json(
          {
            jsonrpc: '2.0',
            id: requestId || null,
            error: {
              code: -32600,
              message:
                'Invalid Request: jsonrpc must be "2.0" and id is required',
            },
          },
          400
        );
      }

      const agent = mastra.getAgent(agentId);
      if (!agent) {
        return c.json(
          {
            jsonrpc: '2.0',
            id: requestId,
            error: {
              code: -32602,
              message: `Agent '${agentId}' not found`,
            },
          },
          404
        );
      }

      // Extract messages from params
      const { message, messages, contextId, taskId, metadata } = params || {};

      let messagesList = [];

      if (message) {
        messagesList = [message];
      } else if (messages && Array.isArray(messages)) {
        messagesList = messages;
      }

      // Convert A2A messages to Mastra format - optimize for speed
      // Extract text content more efficiently, prioritize text parts
      const mastraMessages = messagesList
        .map((msg: Message) => {
          const textParts = msg.parts
            ?.filter(part => part.kind === 'text')
            .map(part => part.text)
            .join(' ')
            .trim();

          // Only include data parts if no text parts exist (reduces token usage)
          const content =
            textParts ||
            msg.parts
              ?.filter(part => part.kind === 'data')
              .map(part =>
                typeof part.data === 'string'
                  ? part.data
                  : JSON.stringify(part.data)
              )
              .join(' ')
              .trim() ||
            '';

          return {
            role: msg.role,
            content,
          };
        })
        .filter(msg => msg.content.length > 0); // Filter empty messages

      // Execute agent with optimized message format
      // Use simpler format to reduce processing overhead
      const response = await agent.generate(
        mastraMessages.map(msg => `${msg.role}: ${msg.content}`)
      );

      const agentText = response.text || '';

      // Build artifacts array
      const artifacts = [
        {
          artifactId: randomUUID(),
          name: `${agentId}Response`,
          parts: [{ kind: 'text', text: agentText }],
        },
      ];

      // Add tool results as artifacts
      if (response.toolResults && response.toolResults.length > 0) {
        artifacts.push({
          artifactId: randomUUID(),
          name: 'ToolResults',
          //@ts-ignore
          parts: response.toolResults.map(result => ({
            kind: 'text',
            text: result,
          })),
        });
      }

      // Build conversation history
      const history = [
        ...messagesList.map(msg => ({
          kind: 'message' as const,
          role: msg.role,
          parts: msg.parts,
          messageId: msg.messageId || randomUUID(),
          taskId: msg.taskId || taskId || randomUUID(),
        })),
        {
          kind: 'message' as const,
          role: 'agent',
          parts: [{ kind: 'text', text: agentText }],
          messageId: randomUUID(),
          taskId: taskId || randomUUID(),
        },
      ];

      // Return A2A-compliant response
      return c.json({
        jsonrpc: '2.0',
        id: requestId,
        result: {
          id: taskId || randomUUID(),
          contextId: contextId || randomUUID(),
          status: {
            state: 'completed',
            timestamp: new Date().toISOString(),
            message: {
              messageId: randomUUID(),
              role: 'agent',
              parts: [{ kind: 'text', text: agentText }],
              kind: 'message' as const,
            },
          },
          artifacts,
          history,
          kind: 'task' as const,
        },
      });
    } catch (error) {
      return c.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: { details: (error as unknown as Error).message },
          },
        },
        500
      );
    }
  },
});
