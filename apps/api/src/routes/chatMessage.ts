import { Request, Response } from "express";
import WebSocket from "ws";
import chalk = require("chalk");
import { Orchestrator } from "../lib/framework/Orchestrator";

/**
 * Each chat message can be user or assistant role.
 */
type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string };

const conversation: ChatMessage[] = [];

export function chatMessageHandler(
  orchestrator: Orchestrator,
  systemMessage: string,
  openaiApiKey: string
) {
  return async (req: Request, res: Response) => {
    const { message } = req.body;
    if (!message) {
      console.log(chalk.redBright('Missing "message" in request body.'));
      return res.status(400).json({ error: 'Missing "message" field.' });
    }

    console.log(chalk.blueBright(`Received user message: "${message}"`));
    // Append user's message to local conversation store
    conversation.push({ role: "user", content: message });

    for (const agent of orchestrator.listAgents()) {
      console.log(chalk.blueBright(`Initializing environment for agent: ${agent.getName()}`));
      await agent?.initializeEnvironment?.({ phoneNumber: '+1234567890' });
    }

    // Connect to GPT-4 Realtime endpoint
    const openaiWs = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
      {
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    let finalAssistantReply = "";
    let textBuffer = "";

    function cleanUpAndRespond() {
      console.log(
        chalk.magentaBright("Cleaning up WebSocket and responding to client.")
      );
      conversation.push({ role: "assistant", content: finalAssistantReply });
      res.json({ response: finalAssistantReply });

      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    }

    openaiWs.on("open", () => {
      console.log(chalk.greenBright("OpenAI Realtime WebSocket connected."));

      openaiWs.send(
        JSON.stringify({
          type: "session.update",
          session: {
            turn_detection: { type: "server_vad" },
            input_audio_format: "g711_ulaw",
            output_audio_format: "g711_ulaw",
            voice: "ash",
            instructions: systemMessage,
            modalities: ["text", "audio"],
            temperature: 0.6,
            tools: orchestrator.getOpenAIFunctionDefinitions(),
            tool_choice: "auto",
          },
        })
      );

      for (const msg of conversation) {
        if (msg.role === "user") {
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: msg.content }],
              },
            })
          );
        } else {
          // Assistant message
          openaiWs.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "assistant",
                content: [
                  {
                    type: "text",
                    text: msg.content,
                  },
                ],
              },
            })
          );
        }
      }

      openaiWs.send(JSON.stringify({ type: "response.create" }));
    });

    openaiWs.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log(chalk.gray("WS message from GPT:"), msg.type);

        if (msg.type === "error") {
          console.log({ msg });
          console.log(chalk.redBright("OpenAI WS error:"), msg.error);
          finalAssistantReply = finalAssistantReply || "(Error from LLM)";
          cleanUpAndRespond();
          return;
        }

        if (msg.type === "session.created") {
          console.log(
            chalk.magentaBright("session.created event. Session ID:"),
            msg.session?.id
          );
        }

        // If GPT is streaming partial text
        if (msg.type === "response.text.delta" && msg.delta) {
          textBuffer += msg.delta;
          console.log(chalk.cyanBright("Text delta:"), msg.delta);
        }

        // Once GPT is done with this response
        if (msg.type === "response.done") {
          console.log(
            chalk.yellow("response.done output:"),
            msg.response?.output
          );

          const outputItems = msg.response?.output || [];

          if (!outputItems.length) {
            finalAssistantReply = textBuffer?.trim() || "(No content)";
            cleanUpAndRespond();
            return;
          }

          const firstItem = outputItems[0];

          if (firstItem.type === "message") {
            console.log(JSON.stringify(firstItem, null, 2));

            const messageResponseType = firstItem.content?.[0]?.type;

            if (messageResponseType === "text") {
              finalAssistantReply =
                firstItem.content[0].text?.trim() || "(No content)";
              console.log(
                chalk.green("Assistant final text:"),
                finalAssistantReply
              );
            } else if (messageResponseType === "audio") {
              finalAssistantReply =
                firstItem.content[0].transcript?.trim() || "(No content)";
              console.log(
                chalk.green("Assistant final text:"),
                finalAssistantReply
              );
            } else {
              console.log(chalk.redBright("No text found in message."));
              finalAssistantReply = "(No content)";
            }

            cleanUpAndRespond();
          } else if (firstItem.type === "function_call") {
            const functionCall = firstItem;
            const functionName = functionCall.name;
            const functionCallId = functionCall.call_id;
            const args = JSON.parse(functionCall.arguments || "{}");
            console.log(
              chalk.yellowBright(
                `Function call requested: ${functionName} with args: ${JSON.stringify(args)}`
              )
            );

            try {
              const result = await orchestrator.handleFunctionCall(
                functionName,
                args
              );

              openaiWs.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: functionCallId,
                    output: JSON.stringify(result),
                  },
                })
              );

              openaiWs.send(JSON.stringify({ type: "response.create" }));
            } catch (err) {
              console.log(chalk.redBright("Error calling function:"), err);
              finalAssistantReply = `Function call error: ${String(err)}`;
              cleanUpAndRespond();
            }
          }
        }
      } catch (err) {
        console.log(chalk.red("Error parsing GPT message:"), err);
        finalAssistantReply = `Error: ${String(err)}`;
        cleanUpAndRespond();
      }
    });

    openaiWs.on("error", (err) => {
      console.log(chalk.redBright("OpenAI WS error:"), err);
      finalAssistantReply =
        finalAssistantReply || `OpenAI WebSocket error: ${String(err)}`;
      cleanUpAndRespond();
    });

    openaiWs.on("close", () => {
      console.log(chalk.gray("OpenAI WS closed."));
      if (!res.headersSent) {
        if (!finalAssistantReply) {
          if (textBuffer) {
            finalAssistantReply = textBuffer.trim();
          } else {
            finalAssistantReply = "(No final response from LLM)";
          }
        }
        cleanUpAndRespond();
      }
    });
  };
}
