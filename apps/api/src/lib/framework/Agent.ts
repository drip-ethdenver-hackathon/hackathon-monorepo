/**
 * Agents must implement this interface. They can optionally supply environment
 * update logic, or a reasoning model descriptor if they rely on a specific LLM or
 * specialized model for internal reasoning.
 */
export interface Agent {
  /**
   * A unique name or identifier for the Agent.
   * This maps directly to the "name" property in an OpenAI-like function call.
   */
  getName(): string;

  /**
   * A short description or docstring for the Agent.
   * This is used to inform the LLM (or other orchestrator) of what the tool does.
   */
  getDescription(): string;

  /**
   * The JSON schema for arguments, which an LLM or orchestrator uses
   * to structure the payload for this agent's handleTask method.
   */
  getParametersJsonSchema(): object;

  /**
   * Provide a short textual context (recent activity, status, etc.)
   * so the orchestrator/UI can show the agent’s latest state.
   */
  getContextInfo(): string;

  /**
   * The main call that performs an agent's function logic. Must return a promise.
   */
  handleTask(args: any): Promise<any>;

  /**
   * Optional: Decide if this agent’s environment or data must be updated prior to handling tasks.
   * If returning `true`, the orchestrator can call `initializeEnvironment()`.
   */
  shouldUpdateEnvironment?(): Promise<boolean>;

  /**
   * Optional: Actually refresh environment data or state. This is only called if
   * shouldUpdateEnvironment() returns `true`. 
   */
  initializeEnvironment?(envData: any): Promise<void>;

  /**
   * Optional: Provide a short descriptor or name of the LLM or model
   * the agent itself uses for reasoning (if any).
   * This is purely informational and doesn’t couple the orchestrator to a specific model.
   */
  getReasoningModel?(): string;

  /**
   * Optional: Provide the interval (in seconds) at which the agent should check to update its environment.
   */
  getUpdateInterval?(): number;
}
