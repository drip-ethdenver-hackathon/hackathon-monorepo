/**
 * An interface all Agents must implement.
 */
export interface Agent {
  /**
   * A unique name or identifier for the Agent.
   * This maps directly to the "name" property in an OpenAI function call.
   */
  getName(): string;

  /**
   * A short description or docstring for the Agent.
   * This is used to inform the LLM of what the tool does.
   */
  getDescription(): string;

  /**
   * The JSON schema for arguments, which the LLM uses to structure the payload.
   */
  getParametersJsonSchema(): object;

  /**
   * Provide a short textual context, e.g. recent or relevant info
   * to display on a UI or pass along as metadata.
   */
  getContextInfo(): string;

  /**
   * Main handler for executing the Agent’s specialized logic
   * when the LLM calls this function by name.
   */
  handleTask(args: any): Promise<any>;

  /**
   * (Optional) If the Agent wants to update environment data dynamically,
   * it can implement this method. For example, calling external APIs.
   */
  initializeEnvironment?(envData: any): Promise<void>;

  /**
   * (Optional) The Agent can decide if it *should* refresh environment data
   * at a particular time, returning `true` if it’s time to do so.
   */
  shouldUpdateEnvironment?(): Promise<boolean>;

  /**
   * (Optional) The Agent can specify how frequently (in ms) the orchestrator
   * should poll for environment updates. If set to a positive number,
   * the orchestrator can schedule a repeating check. If not set or 0, 
   * no poll scheduling is performed.
   */
  getUpdateInterval?(): number;
}
