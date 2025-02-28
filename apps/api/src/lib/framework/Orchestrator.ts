import WebSocket from 'ws';
import { Agent } from './Agent';
import EventEmitter from 'events';

/**
 * The Orchestrator manages agents, calls them when the LLM requests it,
 * and also optionally checks agent environment intervals if available.
 */
export class Orchestrator extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private watchers: Set<WebSocket> = new Set();
  private agentStatuses: Record<string, string> = {};
  private updateTimers: Record<string, NodeJS.Timeout> = {}; // keep track of interval timers

  constructor() {
    super();
  }

  public subscribe(ws: WebSocket) {
    this.watchers.add(ws);
    ws.on('close', () => {
      this.watchers.delete(ws);
    });
  }

  private emitEvent(event: any) {
    for (const ws of this.watchers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    }
  }

  public registerAgent(agent: Agent) {
    this.agents.set(agent.getName(), agent);
    this.agentStatuses[agent.getName()] = 'IDLE';

    this.emit('agent_added', {
      name: agent.getName(),
      description: agent.getDescription(),
      contextInfo: agent.getContextInfo(),
      status: 'IDLE'
    });

    // Broadcast a system-level message to watchers about registration
    this.emitEvent({
      type: 'agent_invocation',
      functionName: 'SYSTEM',
      arguments: { msg: `Registered agent: ${agent.getName()}` },
      timestamp: new Date().toISOString()
    });

    // If the agent can define an update interval, we check it
    if (typeof agent.getUpdateInterval === 'function') {
      const interval = agent.getUpdateInterval();
      if (interval && interval > 0) {
        // set up an interval timer
        const timer = setInterval(async () => {
          console.log('Checking and updating agent environment for', agent.getName());
          await this.checkAndUpdateAgentEnv(agent);
        }, interval);
        this.updateTimers[agent.getName()] = timer;
      }
    }
  }

  /**
   * When shutting down or removing agents, you can call this
   * to clear the timer. Only if you want dynamic removal logic.
   */
  public deregisterAgent(agentName: string) {
    if (this.updateTimers[agentName]) {
      clearInterval(this.updateTimers[agentName]);
      delete this.updateTimers[agentName];
    }
    this.agents.delete(agentName);
    delete this.agentStatuses[agentName];

    // optionally emit or broadcast removal
    this.emit('agent_removed', { name: agentName });
    this.emitEvent({
      type: 'agent_removed',
      name: agentName
    });
  }

  public listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Expose each agent as an OpenAI function definition
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

  public getAgentStatus(name: string): string | undefined {
    return this.agentStatuses[name];
  }

  public setAgentStatus(name: string, status: string) {
    this.agentStatuses[name] = status;
    this.emitEvent({
      type: 'agent_status_changed',
      name,
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Checks if the agent wants to update environment, if so, do it.
   * If the agent is currently ACTIVE, we can decide to skip or queue for later.
   */
  private async checkAndUpdateAgentEnv(agent: Agent) {
    const agentName = agent.getName();
    const currentStatus = this.agentStatuses[agentName];
    if (currentStatus === 'ACTIVE' || currentStatus === 'UPDATING') {
      // We can skip environment updates if agent is busy or
      // prefer some queue, up to your design
      return;
    }

    if (agent.shouldUpdateEnvironment && (await agent.shouldUpdateEnvironment()) === true) {
      this.setAgentStatus(agentName, 'UPDATING');
      if (agent.initializeEnvironment) {
        try {
          await agent.initializeEnvironment({ someKey: 'someVal' });
        } catch (err) {
          // If there's an error, you can set status to ERROR or revert to IDLE
          this.setAgentStatus(agentName, 'ERROR');
          return;
        }
      }
      // revert to IDLE when done
      this.setAgentStatus(agentName, 'IDLE');
    }
  }

  /**
   * Main method for orchestrating function calls from the LLM
   */
  public async handleFunctionCall(functionName: string, functionArgs: any) {
    const agent = this.agents.get(functionName);
    if (!agent) {
      const errorMsg = `No registered agent found for functionName = ${functionName}`;
      this.emitEvent({
        type: 'agent_error',
        functionName,
        error: errorMsg,
        timestamp: new Date().toISOString()
      });
      throw new Error(errorMsg);
    }

    // Possibly do an environment update if needed
    if (agent.shouldUpdateEnvironment && (await agent.shouldUpdateEnvironment()) === true) {
      this.setAgentStatus(functionName, 'UPDATING');
      if (agent.initializeEnvironment) {
        await agent.initializeEnvironment({ someKey: 'someVal' });
      }
      this.setAgentStatus(functionName, 'IDLE');
    }

    // Mark agent as ACTIVE
    this.emitEvent({
      type: 'agent_invocation',
      functionName,
      arguments: functionArgs,
      timestamp: new Date().toISOString()
    });
    this.emit('agent_invoked', functionName);
    this.setAgentStatus(functionName, 'ACTIVE');

    let result;
    try {
      result = await agent.handleTask(functionArgs);

      // success event
      this.emitEvent({
        type: 'agent_result',
        functionName,
        result,
        timestamp: new Date().toISOString()
      });
      this.emit('agent_result', functionName, true);

      this.setAgentStatus(functionName, 'IDLE');
    } catch (err: any) {
      this.emitEvent({
        type: 'agent_error',
        functionName,
        error: err.message || String(err),
        timestamp: new Date().toISOString()
      });
      this.emit('agent_result', functionName, false);

      this.setAgentStatus(functionName, 'ERROR');
      throw err;
    }

    return result;
  }

  public onAgentInvoked(cb: (agentName: string) => void) {
    this.on('agent_invoked', cb);
  }

  public onAgentResult(cb: (agentName: string, success: boolean) => void) {
    this.on('agent_result', cb);
  }
}
