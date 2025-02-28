import { Agent } from './Agent';
import WebSocket from 'ws';

export class Orchestrator {
  private agents: Map<string, Agent> = new Map();

  // Store a list of watchers that want real-time updates
  private watchers: Set<WebSocket> = new Set();

  constructor() {
    // Optionally accept environment/context
  }

  /**
   * Registers a new WebSocket to receive Orchestrator events.
   */
  public subscribe(ws: WebSocket) {
    this.watchers.add(ws);
    // Remove from set on close
    ws.on('close', () => {
      this.watchers.delete(ws);
    });
  }

  /**
   * Emit an event to all subscribed watchers.
   */
  private emitEvent(event: any) {
    for (const ws of this.watchers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    }
  }

  /**
   * Registers an Agent. 
   */
  public registerAgent(agent: Agent) {
    this.agents.set(agent.getName(), agent);
  }

  /**
   * Returns a listing of Agents as "tools" or "functions" for the LLM.
   */
  public getOpenAIFunctionDefinitions(): any[] {
    const definitions: any[] = [];
    for (const agent of this.agents.values()) {
      definitions.push({
        type: 'function',
        name: agent.getName(),
        description: agent.getDescription(),
        parameters: agent.getParametersJsonSchema(),
      });
    }
    return definitions;
  }

  /**
   * Orchestrator sees an OpenAI function_call and routes to the correct Agent.
   * 
   * We emit events before and after the call, so watchers see the steps.
   */
  public async handleFunctionCall(functionName: string, functionArgs: any) {
    const agent = this.agents.get(functionName);
    if (!agent) {
      const errorMsg = `No registered agent found for functionName = ${functionName}`;
      // Notify watchers about the error
      this.emitEvent({
        type: 'agent_error',
        functionName,
        error: errorMsg,
        timestamp: new Date().toISOString()
      });
      throw new Error(errorMsg);
    }

    // Notify watchers that we're about to invoke an agent
    this.emitEvent({
      type: 'agent_invocation',
      functionName,
      arguments: functionArgs,
      timestamp: new Date().toISOString()
    });

    // Invoke the agent
    let result;
    try {
      result = await agent.handleTask(functionArgs);
      
      // Notify watchers of success
      this.emitEvent({
        type: 'agent_result',
        functionName,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      // Notify watchers of error
      this.emitEvent({
        type: 'agent_error',
        functionName,
        error: err.message || String(err),
        timestamp: new Date().toISOString()
      });
      throw err;
    }

    return result;
  }
}
