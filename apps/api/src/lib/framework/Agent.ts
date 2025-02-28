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
     * Handle the actual function call and return results that the Orchestrator 
     * will pass back to the LLM in a function_call_output message.
     */
    handleTask(args: any): Promise<any>;
  }
  