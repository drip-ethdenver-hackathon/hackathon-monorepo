import WebSocket from 'ws';
import { Agent } from './Agent';
import EventEmitter from 'events';

export class Orchestrator extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private watchers: Set<WebSocket> = new Set();
  private agentStatuses: Record<string, string> = {};

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
    this.emitEvent({
      type: 'agent_invocation',
      functionName: 'SYSTEM',
      arguments: { msg: `Registered agent: ${agent.getName()}` },
      timestamp: new Date().toISOString()
    });
  }

  public listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

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
  }

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

    this.emitEvent({
      type: 'agent_invocation',
      functionName,
      arguments: functionArgs,
      timestamp: new Date().toISOString()
    });

    this.emit('agent_invoked', functionName);
    this.agentStatuses[functionName] = 'ACTIVE';

    let result;
    try {
      result = await agent.handleTask(functionArgs);
      this.emitEvent({
        type: 'agent_result',
        functionName,
        result,
        timestamp: new Date().toISOString()
      });
      this.emit('agent_result', functionName, true);
      this.agentStatuses[functionName] = 'IDLE';
    } catch (err: any) {
      this.emitEvent({
        type: 'agent_error',
        functionName,
        error: err.message || String(err),
        timestamp: new Date().toISOString()
      });
      this.emit('agent_result', functionName, false);
      this.agentStatuses[functionName] = 'ERROR';
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
