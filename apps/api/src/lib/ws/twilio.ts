import WebSocket from 'ws';
import chalk from 'chalk';
import { Orchestrator } from '../framework/Orchestrator';

/**
 * Attaches handlers for Twilio Media Stream -> OpenAI GPT-4 Realtime,
 * bridging audio and function calls.
 *
 * @param wss - The WebSocket.Server instance (for Twilio).
 * @param orchestrator - The Orchestrator instance to handle function calls.
 * @param openaiApiKey - The OpenAI API key from environment.
 * @param systemMessage - The system prompt text for GPT-4.
 */
export function attachTwilio(
  wss: WebSocket.Server,
  orchestrator: Orchestrator,
  openaiApiKey: string,
  systemMessage: string
) {
  wss.on('connection', (twilioWs) => {
    console.log(chalk.greenBright("Twilio Media Stream WebSocket client connected."));

    // Connect to OpenAI Realtime
    const openaiWs = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );

    let streamSid: string | null = null;

    // Add this: Emit an event to the orchestrator's watchers
    orchestrator.emitEvent({
      type: 'agent_invocation',
      functionName: 'SYSTEM',
      arguments: { msg: 'New Twilio call connected' },
      timestamp: new Date().toISOString()
    });

    // When OpenAI socket opens, send the session update
    openaiWs.on('open', () => {
      console.log(chalk.greenBright("Connected to OpenAI WebSocket."));

      openaiWs.send(
        JSON.stringify({
          type: "session.update",
          session: {
            turn_detection: { type: "server_vad" },
            input_audio_format: "g711_ulaw",
            output_audio_format: "g711_ulaw",
            voice: 'ash',
            instructions: systemMessage,
            modalities: ["text", "audio"],
            temperature: 0.6,
            tools: orchestrator.getOpenAIFunctionDefinitions(),
            tool_choice: "auto",
            input_audio_transcription: {
              model: "whisper-1",
              language: "en",
            }
          }
        })
      );
    });

    // Handle messages from the Twilio side
    twilioWs.on('message', async (msg: string) => {
      const data = JSON.parse(msg);

      if (data.event === 'start') {
        streamSid = data.start.streamSid;
        console.log(chalk.greenBright(`Stream started: ${streamSid}`));
      }

      // Add this: Log when we get a transcription from the user
      if (data.event === 'transcript') {
        orchestrator.emitEvent({
          type: 'message',
          role: 'user',
          content: data.transcript.text,
          timestamp: new Date().toISOString()
        });
      }

      if (data.event === 'media' && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: data.media.payload
          })
        );
      }
    });

    // Handle messages from the OpenAI side
    openaiWs.on('message', async (rawMsg: string) => {
      const response = JSON.parse(rawMsg);

      console.log('OpenAI response:', JSON.stringify(response, null, 2));

      // Add this: Log when we get a complete transcript from the assistant
      if (response.type === 'response.audio_transcript.done') {
        orchestrator.emitEvent({
          type: 'message',
          role: 'assistant',
          content: response.transcript,
          timestamp: new Date().toISOString()
        });
      }

      // Forward assistant audio to Twilio
      if (
        response.type === 'response.audio.delta' &&
        response.delta &&
        streamSid
      ) {
        twilioWs.send(
          JSON.stringify({
            event: "media",
            streamSid,
            media: { payload: response.delta }
          })
        );

        // Emit audio response event
        orchestrator.emitEvent({
          type: 'agent_invocation',
          functionName: 'SYSTEM',
          arguments: { msg: 'Assistant speaking...' },
          timestamp: new Date().toISOString()
        });
      }

      // If GPT calls a function, delegate to Orchestrator
      if (
        response.type === 'response.done' &&
        response.response?.output?.[0]?.type === 'function_call'
      ) {
        const functionCall = response.response.output[0];
        const args = JSON.parse(functionCall.arguments || '{}');

        try {
          // Add this: Emit function call event
          orchestrator.emitEvent({
            type: 'agent_invocation',
            functionName: functionCall.name,
            arguments: args,
            timestamp: new Date().toISOString()
          });

          const result = await orchestrator.handleFunctionCall(
            functionCall.name,
            args
          );

          // Add this: Emit function result event
          orchestrator.emitEvent({
            type: 'agent_result',
            functionName: functionCall.name,
            result,
            timestamp: new Date().toISOString()
          });

          // Send result back as a function_call_output
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: functionCall.call_id,
                output: JSON.stringify(result)
              }
            })
          );

          // Prompt LLM to finalize a response
          openaiWs.send(JSON.stringify({ type: "response.create" }));
        } catch (error) {
          console.error(`Error handling agent call ${functionCall.name}:`, error);
          
          // Add this: Emit error event
          orchestrator.emitEvent({
            type: 'agent_error',
            functionName: functionCall.name,
            error: String(error),
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    // Cleanup on Twilio side close
    twilioWs.on('close', () => {
      console.log(chalk.redBright("Twilio WebSocket closed."));
      
      // Add this: Emit call ended event
      orchestrator.emitEvent({
        type: 'agent_invocation',
        functionName: 'SYSTEM',
        arguments: { msg: 'Twilio call ended' },
        timestamp: new Date().toISOString()
      });
      
      openaiWs.close();
    });

    // Cleanup on OpenAI side close
    openaiWs.on('close', () => {
      console.log(chalk.redBright("OpenAI WebSocket closed."));
      twilioWs.close();
    });
  });
}
