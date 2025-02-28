// src/routes/agents.ts
import { Router, Request, Response } from 'express';
import { Orchestrator } from '../lib/framework/Orchestrator';

export function agentsHandler(orchestrator: Orchestrator) {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const agents = orchestrator.listAgents().map(agent => ({
      name: agent.getName(),
      description: agent.getDescription(),
      contextInfo: agent.getContextInfo(),
      status: orchestrator.getAgentStatus(agent.getName()) || 'IDLE'
    }));
    return res.json({ agents });
  });

  return router;
}
