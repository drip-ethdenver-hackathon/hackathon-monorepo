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
   * (Optional) If the Agent wants to update its environment data dynamically,
   * it can implement this method. This might be a fetch to an external API
   * or some other piece of context. 
   */
  initializeEnvironment?(envData: any): Promise<void>;

  /**
   * (Optional) The Agent can decide if it *should* refresh environment data
   * at any point, returning `true` if it’s time to do so. 
   * For example, the agent could keep track of timestamps or usage counts.
   */
  shouldUpdateEnvironment?(): Promise<boolean>;

  /**
   * (Optional) If the Agent wants to refresh environment data on a fixed schedule,
   * it can return a number (in milliseconds) specifying how frequently the 
   * Orchestrator should check `shouldUpdateEnvironment()` and then call 
   * `initializeEnvironment()` if needed. 
   */
  getUpdateInterval?(): number;
}
