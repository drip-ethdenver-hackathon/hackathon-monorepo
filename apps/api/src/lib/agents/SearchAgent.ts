import { Agent } from "../framework/Agent";
import { oraApi } from "../framework/interfaces/oraApi";

export class SearchAgent implements Agent {
  private recentAction: string = "No recent action.";
  private oraModelName: string;

  constructor(
    private oraApiKey: string,
    modelName: string
  ) {
    this.oraModelName = modelName || "deepseek-ai/DeepSeek-V3";
  }

  getName(): string {
    return "search_agent";
  }

  getDescription(): string {
    return "Uses the Ora API to produce AI completions or reasoning with native web search.";
  }

  getParametersJsonSchema(): object {
    return {
      type: "object",
      properties: {
        userPrompt: {
          type: "string",
          description: "The user query or prompt to handle via Ora.",
        },
        searchEnabled: {
          type: "boolean",
          description: "Enable Ora API’s native search feature or not.",
          default: false,
        },
      },
      required: ["userPrompt"],
    };
  }

  getContextInfo(): string {
    return this.recentAction;
  }

  getReasoningModel?(): string {
    return `Ora: ${this.oraModelName}`;
  }

  async handleTask(args: any): Promise<any> {
    const { userPrompt } = args;

    this.recentAction = `OraAgent handleTask invoked with prompt: ${userPrompt}`;

    let apiResponse;

    try {
      apiResponse = await fetch(oraApi.endpoints.chatCompletions, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.oraApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.oraModelName,
          messages: [
            { role: "user", content: userPrompt },
          ],
          search_enabled: true,
        }),
      }).then((res) => res.json());
    } catch (err: any) {
      this.recentAction = `OraAgent handleTask failed: ${String(err)}`;
      return {
        success: false,
        message: `Failed calling Ora API: ${String(err)}`,
      };
    }

    const messageObj = apiResponse?.choices?.[0]?.message;

    let finalText = "(No content)";

    if (messageObj?.content) {
      finalText = messageObj.content;
    }

    this.recentAction = `OraAgent responded with: ${finalText.slice(0, 50)}...`;

    return {
      success: true,
      message: finalText,
    };
  }
}
