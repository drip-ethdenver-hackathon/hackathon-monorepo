import WebSocket from 'ws';
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
    console.log("Twilio Media Stream WebSocket client connected.");

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

    // When OpenAI socket opens, send the session update
    openaiWs.on('open', () => {
      console.log("Connected to OpenAI WebSocket.");

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
            tool_choice: "auto"
          }
        })
      );
    });

    // Handle messages from the Twilio side
    twilioWs.on('message', async (msg: string) => {
      const data = JSON.parse(msg);

      if (data.event === 'start') {
        streamSid = data.start.streamSid;
        console.log(`Stream started: ${streamSid}`);
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
      }

      // If GPT calls a function, delegate to Orchestrator
      if (
        response.type === 'response.done' &&
        response.response?.output?.[0]?.type === 'function_call'
      ) {
        const functionCall = response.response.output[0];
        const args = JSON.parse(functionCall.arguments || '{}');

        try {
          const result = await orchestrator.handleFunctionCall(
            functionCall.name,
            args
          );

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
        }
      }
    });

    // Cleanup on Twilio side close
    twilioWs.on('close', () => {
      console.log("Twilio WebSocket closed.");
      openaiWs.close();
    });

    // Cleanup on OpenAI side close
    openaiWs.on('close', () => {
      console.log("OpenAI WebSocket closed.");
      twilioWs.close();
    });
  });
}
