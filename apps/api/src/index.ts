import express from "express";
import dotenv from "dotenv";
import http from "http";
import WebSocket from "ws";
import chalk from "chalk";
import cors from "cors";
import { incomingCallRouter } from "./routes/incomingCall";
import { simulateCallRouter } from "./routes/simulateCall";
import { Orchestrator } from "./lib/framework/Orchestrator";
import { CheckBalanceAgent } from "./lib/agents/CheckBalanceAgent";
import { attachTwilio } from "./lib/ws/twilio";
import { attachOrchestrator } from "./lib/ws/orchestrator";
import { chatMessageHandler } from "./routes/chatMessage";
import { agentsHandler } from "./routes/agents";
import { SearchAgent } from "./lib/agents/SearchAgent";
import { AgentKitBasedAgent } from "./lib/agents/CDP_AgentKit";
import { indexerRouter } from "./routes/indexer";
import { connectRouter } from "./routes/connect";
import { PagesIndexAgent } from "./lib/agents/PagesIndexAgent";
import { WalletTransferAgent } from "./lib/agents/WalletTransferAgent";
import { PhoneWalletLookupAgent } from "./lib/agents/PhoneWalletLookupAgent";
import { IndexedDatabaseFetcherAgent } from './lib/agents/IndexedDatabaseFetcherAgent';
import { Pinecone } from "@pinecone-database/pinecone";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.static("public"));
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CORS_ORIGIN
        : ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const orchestrator = new Orchestrator();

const pineconeClient = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

orchestrator.registerAgent(
  new SearchAgent(process.env.ORA_API_KEY || "", "deepseek-ai/DeepSeek-V3")
);

orchestrator.registerAgent(new SearchAgent(process.env.CDP_API_KEY_NAME || '', process.env.CDP_API_KEY_PRIVATE || ''));
orchestrator.registerAgent(new PagesIndexAgent(process.env.CDP_API_KEY_NAME || '', process.env.CDP_API_KEY_PRIVATE || ''));
orchestrator.registerAgent(new AgentKitBasedAgent(process.env.CDP_API_KEY_NAME || '', process.env.CDP_API_KEY_PRIVATE || ''));
orchestrator.registerAgent(new IndexedDatabaseFetcherAgent(pineconeClient, process.env.OPENAI_API_KEY || ''));

orchestrator.registerAgent(
  new AgentKitBasedAgent(
    process.env.CDP_API_KEY_NAME || "",
    process.env.CDP_API_KEY_PRIVATE || ""
  )
);

orchestrator.registerAgent(
  new WalletTransferAgent(
    process.env.CDP_API_KEY_NAME || "",
    process.env.CDP_API_KEY_PRIVATE || ""
  )
);

orchestrator.registerAgent(new PhoneWalletLookupAgent(process.env.CDP_API_KEY_NAME || '', process.env.CDP_API_KEY_PRIVATE || ''));

orchestrator.registerAgent(
  new CheckBalanceAgent(
    process.env.COIN_GECKO_API_KEY || "",
    process.env.OPENAI_API_KEY || ""
  )
);

orchestrator.registerAgent(
  new SearchAgent(process.env.CDP_API_KEY_NAME || '', process.env.CDP_API_KEY_PRIVATE || '')
);

// After registering, initialize the environment with the Pinecone client
orchestrator.listAgents().forEach(async (agent) => {
  if (agent.getName() === 'agent_breeder') {
    await agent.initializeEnvironment({ 
      pineconeClient,
      // Add any other environment data needed
    });
  }
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.log(chalk.redBright("Missing OPENAI_API_KEY in environment."));
  throw new Error("Missing OPENAI_API_KEY in .env file.");
}

const PORT = parseInt(process.env.PORT || "5050");

const SYSTEM_MESSAGE = `
You are the Orchestration Assistant, responsible for coordinating with specialized sub-agents to fulfill user requests.

1. **Discover & Call Agents:** You have access to multiple registered agents (tools/functions) that handle tasks such as sending crypto, exchanging tokens, checking balances, or performing lookups. When you need specific functionality, call the relevant agent by name, providing correct JSON arguments according to its schema. Do not alter the user's input in ways that change the intended context.

2. **Non-Deterministic Reasoning:** Reason flexibly about the user's request, breaking down complex requests into multiple steps if needed. You may call multiple agents or re-check data until you have sufficient information to respond confidently.

3. **Limited Search Attempts:** You may consult a search or external retrieval agent **up to 5 times** if needed to fully address the user's request. Use these searches judiciously and stop when you have enough data. If any aspect of the request is unclear, attempt a search for additional context before finalizing your response and suggest the next step to the user if necessary.

4. **Central Coordination:** You are the final decision maker. Defer tasks to sub-agents only when relevant, then gather their results and form a concise, direct response or next action. If multiple agents can perform similar tasks, choose the most appropriate based on context.

5. **Maintain Accuracy & Clarity:** 
   - Validate each agent call using only the data provided by the user.
   - Avoid speculation and reduce hallucination by not inventing unverified details.
   - Keep track of context when deciding which agent to call next.

6. **Concise Voice Responses & Internal Opacity:** 
   On a Twilio voice call, keep responses short, direct, and helpful. Do not reveal your internal chain-of-thought or the use of sub-agents.

7. **Suggestions After Clarification:** 
   If you discover additional context from a search or sub-agent calls, politely ask the user if they want to proceed along that path without exposing your internal process.
`;

app.get("/", (req, res) => {
  res.redirect("/index.html");
});

app.use("/incoming-call", incomingCallRouter);

app.post("/chat-message", (req, res) => {
  chatMessageHandler(orchestrator, SYSTEM_MESSAGE, OPENAI_API_KEY)(req, res);
});

app.use("/simulate-call", simulateCallRouter);

app.use("/agents", agentsHandler(orchestrator));

app.use("/connect", connectRouter);

app.use("/index-docs", indexerRouter);

const server = http.createServer(app);

const mediaStreamServer = new WebSocket.Server({ noServer: true });
attachTwilio(mediaStreamServer, orchestrator, OPENAI_API_KEY, SYSTEM_MESSAGE);

const orchestratorStreamServer = new WebSocket.Server({ noServer: true });
attachOrchestrator(orchestratorStreamServer, orchestrator);

const agentStreamServer = new WebSocket.Server({ noServer: true });
const agentStreamClients = new Set<WebSocket>();

agentStreamServer.on("connection", async (ws) => {
  console.log(chalk.greenBright("Agent stream client connected."));
  agentStreamClients.add(ws);

  // Get the list of agents with enhanced information
  const fullList = await Promise.all(
    orchestrator.listAgents().map(async (agent) => {
      const info = {
        name: agent.getName(),
        description: agent.getDescription(),
        contextInfo: agent.getContextInfo(),
        status: orchestrator.getAgentStatus(agent.getName()) || "IDLE",
        balance: null,
      };

      // Check if agent is a BaseWalletAgent and get balance
      if (
        typeof (agent as any).balance === "function" ||
        typeof (agent as any).balance === "object"
      ) {
        try {
          info.balance = await (agent as any).balance;
        } catch (err) {
          console.log(`Error getting balance for ${agent.getName()}: ${err}`);
        }
      }

      return info;
    })
  );

  ws.send(JSON.stringify({ type: "agent_full_list", agents: fullList }));

  ws.on("close", () => {
    console.log(chalk.yellow("Agent stream client disconnected."));
    agentStreamClients.delete(ws);
  });
});

function broadcastAgentEvent(eventData: any) {
  console.log(chalk.magenta("Broadcasting agent event:"), eventData);
  for (const ws of agentStreamClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(eventData));
    }
  }
}

orchestrator.onAgentInvoked((agentName) => {
  console.log(
    chalk.blueBright(`Agent invoked: ${agentName}, setting status to ACTIVE.`)
  );
  broadcastAgentEvent({
    type: "agent_status_changed",
    name: agentName,
    status: "ACTIVE",
  });
});

orchestrator.onAgentResult((agentName, success) => {
  const status = success ? "IDLE" : "ERROR";
  console.log(
    chalk.blueBright(
      `Agent result: ${agentName}, success=${success}, new status=${status}`
    )
  );
  broadcastAgentEvent({
    type: "agent_status_changed",
    name: agentName,
    status,
  });
});

server.on("upgrade", (request, socket, head) => {
  if (request.url === "/media-stream") {
    console.log(chalk.cyan("Upgrading connection to media-stream WebSocket."));
    mediaStreamServer.handleUpgrade(request, socket, head, (ws) => {
      mediaStreamServer.emit("connection", ws, request);
    });
  } else if (request.url === "/orchestrator-stream") {
    console.log(
      chalk.cyan("Upgrading connection to orchestrator-stream WebSocket.")
    );
    orchestratorStreamServer.handleUpgrade(request, socket, head, (ws) => {
      orchestratorStreamServer.emit("connection", ws, request);
    });
  } else if (request.url === "/agent-stream") {
    console.log(chalk.cyan("Upgrading connection to agent-stream WebSocket."));
    agentStreamServer.handleUpgrade(request, socket, head, (ws) => {
      agentStreamServer.emit("connection", ws, request);
    });
  } else {
    console.log(
      chalk.red(
        `Unknown WebSocket upgrade request: ${request.url}. Destroying socket.`
      )
    );
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(chalk.green(`Server is listening on port ${PORT}`));
});
