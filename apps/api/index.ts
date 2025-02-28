import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import WebSocket from 'ws';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import dotenv from 'dotenv';
import http from 'http';
import fs from 'fs';
import { Writer } from 'wav';

dotenv.config();

const app = express();
const wss = new WebSocket.Server({ noServer: true });

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = parseInt(process.env.PORT || '5050');

const SYSTEM_MESSAGE = "You are a fast-talking crypto assistant. Keep responses short and direct. Always check balances before transactions, verify details quickly, and stick to ETH, USDC, and DAI only. No speculation, only use provided function data.";
const VOICE = 'ash';
const LOG_EVENT_TYPES = [
  'response.content.done', 'rate_limits.updated', 'response.done',
  'input_audio_buffer.committed', 'input_audio_buffer.speech_stopped',
  'input_audio_buffer.speech_started', 'response.create', 'session.created', 
  'conversation.item.created'
];
const SHOW_TIMING_MATH = false;

if (!OPENAI_API_KEY) {
  throw new Error('Missing the OpenAI API key. Please set it in the .env file.');
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.send('<html><body><h1>Twilio Media Stream Server is running!</h1></body></html>');
});

app.all('/incoming-call', (req, res) => {
  console.log("Received incoming call request from:", req.ip);
  
  const response = new VoiceResponse();
  const host = req.get('host');
  const connect = response.connect();
  connect.stream({ url: `wss://${host}/media-stream` });
  
  res.type('text/xml');
  res.send(response.toString());
});

// Add this function that will be called by the AI
async function getCurrentTime(): Promise<string> {
  // date is 12pm 28th feb 2025
  const now = new Date('2025-02-28T12:00:00');
  // wait 10 seconds
  await new Promise(resolve => setTimeout(resolve, 10000));
  return now.toLocaleTimeString();
}

// Add these mock Web3 functions
async function mockSendCrypto(toPhoneNumber: string, amount: string, coinType: string): Promise<{
  success: boolean;
  message: string;
}> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock validation and response
  if (!toPhoneNumber.match(/^\+?[\d-]{10,}$/)) {
    return {
      success: false,
      message: "Invalid phone number format"
    };
  }

  return {
    success: true,
    message: `MOCK: Successfully sent ${amount} ${coinType} to ${toPhoneNumber}`
  };
}

async function mockExchangeTokens(
  fromToken: string,
  toToken: string,
  amount: string
): Promise<{
  success: boolean;
  message: string;
}> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock validation
  if (fromToken === toToken) {
    return {
      success: false,
      message: "Cannot exchange a token for itself"
    };
  }

  return {
    success: true,
    message: `MOCK: Successfully exchanged ${amount} ${fromToken} for ${toToken}`
  };
}

// Add this mock function with the other mock functions
async function mockCheckBalance(coinType: string): Promise<{
  success: boolean;
  message: string;
  balance?: string;
}> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock balances
  const mockBalances = {
    'ETH': '1.5',
    'USDC': '1000',
    'DAI': '750'
  };

  const balance = mockBalances[coinType];
  if (!balance) {
    return {
      success: false,
      message: `Invalid coin type: ${coinType}`
    };
  }

  return {
    success: true,
    message: `Your ${coinType} balance is ${balance}`,
    balance: balance
  };
}

// Add these helper functions for audio conversion
function ulawToLinear(ulawSample: number): number {
  const BIAS = 0x84;
  const CLIP = 32767;
  
  ulawSample = ~ulawSample;
  let sign = (ulawSample & 0x80) ? -1 : 1;
  let exponent = ((ulawSample >> 4) & 0x07);
  let mantissa = (ulawSample & 0x0F);
  
  let sample = mantissa << 3;
  sample += 0x84;
  sample <<= exponent;
  
  if (sign < 0) {
    sample = -sample;
  }
  
  return sample;
}

function base64ToBuffer(base64: string): Buffer {
  const raw = Buffer.from(base64, 'base64');
  const pcm = Buffer.alloc(raw.length * 2); // 16-bit samples
  
  for (let i = 0; i < raw.length; i++) {
    const sample = ulawToLinear(raw[i]);
    pcm.writeInt16LE(sample, i * 2);
  }
  
  return pcm;
}

function createWavWriter(): Writer {
  return new Writer({
    channels: 1,
    sampleRate: 8000,
    bitDepth: 16,
    signed: true,
    float: false
  });
}

// Add these types and helper functions
type AudioChunk = {
  timestamp: number;
  buffer: Buffer;
  isAssistant: boolean;
};

function combineAudioChunks(chunks: AudioChunk[]): Buffer {
  // Sort chunks by timestamp
  chunks.sort((a, b) => a.timestamp - b.timestamp);
  
  // Calculate total length needed
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.buffer.length, 0);
  const combined = Buffer.alloc(totalLength);
  
  let offset = 0;
  chunks.forEach(chunk => {
    chunk.buffer.copy(combined, offset);
    offset += chunk.buffer.length;
  });
  
  return combined;
}

// Modify the WebSocket connection handler
wss.on('connection', async (ws) => {
  console.log("Client connected");

  // Add these variables for audio recording
  const conversationId = Date.now().toString();
  const audioChunks: AudioChunk[] = [];
  let startTime: number | null = null;
  
  // Create directory for recordings if it doesn't exist
  const recordingsDir = path.join(__dirname, 'recordings');
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir);
  }

  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  let streamSid: string | null = null;
  let latestMediaTimestamp = 0;
  let lastAssistantItem: string | null = null;
  let markQueue: string[] = [];
  let responseStartTimestampTwilio: number | null = null;

  // Wait for OpenAI WebSocket connection
  openaiWs.on('open', () => {
    console.log("OpenAI WebSocket connected");
    
    const sessionUpdate = {
      type: "session.update",
      session: {
        turn_detection: { type: "server_vad" },
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        voice: VOICE,
        instructions: SYSTEM_MESSAGE,
        modalities: ["text", "audio"],
        temperature: 0.6,
        tools: [
          {
            type: "function",
            name: "get_current_time",
            description: "Get the current time",
            parameters: {
              type: "object",
              properties: {},
              required: []
            }
          },
          {
            type: "function",
            name: "send_crypto",
            description: "Send cryptocurrency to a phone number (MOCK)",
            parameters: {
              type: "object",
              properties: {
                phoneNumber: {
                  type: "string",
                  description: "The recipient's phone number (e.g., +1234567890)"
                },
                amount: {
                  type: "string",
                  description: "The amount of cryptocurrency to send"
                },
                coinType: {
                  type: "string",
                  description: "The type of cryptocurrency",
                  enum: ["ETH", "USDC", "DAI"]
                }
              },
              required: ["phoneNumber", "amount", "coinType"]
            }
          },
          {
            type: "function",
            name: "exchange_tokens",
            description: "Exchange one cryptocurrency for another (MOCK)",
            parameters: {
              type: "object",
              properties: {
                fromToken: {
                  type: "string",
                  description: "The token to exchange from",
                  enum: ["ETH", "USDC", "DAI"]
                },
                toToken: {
                  type: "string",
                  description: "The token to exchange to",
                  enum: ["ETH", "USDC", "DAI"]
                },
                amount: {
                  type: "string",
                  description: "The amount to exchange"
                }
              },
              required: ["fromToken", "toToken", "amount"]
            }
          },
          {
            type: "function",
            name: "check_balance",
            description: "Check the balance of a cryptocurrency (MOCK)",
            parameters: {
              type: "object",
              properties: {
                coinType: {
                  type: "string",
                  description: "The type of cryptocurrency to check",
                  enum: ["ETH", "USDC", "DAI"]
                }
              },
              required: ["coinType"]
            }
          }
        ],
        tool_choice: "auto"
      }
    };
    
    openaiWs.send(JSON.stringify(sessionUpdate));
  });

  // Modify the Twilio message handler
  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);
      
      if (data.event === 'media' && openaiWs.readyState === WebSocket.OPEN) {
        const timestamp = parseInt(data.media.timestamp);
        if (startTime === null) {
          startTime = timestamp;
        }
        
        // Save user audio with relative timestamp
        const audioBuffer = base64ToBuffer(data.media.payload);
        audioChunks.push({
          timestamp: timestamp - (startTime || 0),
          buffer: audioBuffer,
          isAssistant: false
        });

        // Original audio handling
        latestMediaTimestamp = timestamp;
        const audioAppend = {
          type: "input_audio_buffer.append",
          audio: data.media.payload
        };
        openaiWs.send(JSON.stringify(audioAppend));
      } else if (data.event === 'start') {
        // Reset audio chunks and timing on new call
        audioChunks.length = 0;
        startTime = null;
        streamSid = data.start.streamSid;
        console.log(`Incoming stream has started ${streamSid}`);
        responseStartTimestampTwilio = null;
        latestMediaTimestamp = 0;
        lastAssistantItem = null;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Modify the OpenAI message handler
  openaiWs.on('message', async (message: string) => {
    try {
      const response = JSON.parse(message);
      
      // Only log specific important events
      if (response.type === 'conversation.item.created') {
        console.log('User input:', response.item?.content?.[0]?.text);
      } else if (response.type === 'response.done') {
        console.log('AI response completed');
      }

      // Handle function calls
      if (response.type === 'response.done' && 
          response.response.output?.[0]?.type === 'function_call') {
        const functionCall = response.response.output[0];
        const args = JSON.parse(functionCall.arguments);
        console.log(`Executing function: ${functionCall.name}`);
        let result;

        // Execute the appropriate mock function based on the name
        if (functionCall.name === 'send_crypto') {
          result = await mockSendCrypto(args.phoneNumber, args.amount, args.coinType);
        } else if (functionCall.name === 'exchange_tokens') {
          result = await mockExchangeTokens(args.fromToken, args.toToken, args.amount);
        } else if (functionCall.name === 'check_balance') {
          result = await mockCheckBalance(args.coinType);
        } else if (functionCall.name === 'get_current_time') {
          result = await getCurrentTime();
        }

        if (result) {
          console.log('Function result:', result.message);
          const functionResult = {
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: functionCall.call_id,
              output: JSON.stringify(result)
            }
          };
          openaiWs.send(JSON.stringify(functionResult));

          // Generate a new response with the function result
          openaiWs.send(JSON.stringify({ type: "response.create" }));
        }
      }

      // Handle regular audio responses
      if (response.type === 'response.audio.delta' && response.delta) {
        const audioBuffer = base64ToBuffer(response.delta);
        // Save assistant audio with relative timestamp
        audioChunks.push({
          timestamp: latestMediaTimestamp - (startTime || 0),
          buffer: audioBuffer,
          isAssistant: true
        });

        // Original audio handling
        const audioPayload = Buffer.from(response.delta, 'base64').toString('base64');
        const audioDelta = {
          event: "media",
          streamSid,
          media: {
            payload: audioPayload
          }
        };
        ws.send(JSON.stringify(audioDelta));

        if (responseStartTimestampTwilio === null) {
          responseStartTimestampTwilio = latestMediaTimestamp;
          if (SHOW_TIMING_MATH) {
            console.log(`Setting start timestamp for new response: ${responseStartTimestampTwilio}ms`);
          }
        }

        if (response.item_id) {
          lastAssistantItem = response.item_id;
        }
      }
    } catch (error) {
      console.error('Error processing OpenAI message:', error);
    }
  });

  // Modify the cleanup handler
  ws.on('close', async () => {
    console.log('Client disconnected, saving conversation audio...');
    
    try {
      // Create combined audio file
      const writer = createWavWriter();
      const audioFile = fs.createWriteStream(path.join(recordingsDir, `${conversationId}_conversation.wav`));
      writer.pipe(audioFile);
      
      const combinedAudio = combineAudioChunks(audioChunks);
      writer.write(combinedAudio);
      writer.end();

      // Save transcript
      const transcript = audioChunks.map(chunk => ({
        time: chunk.timestamp,
        speaker: chunk.isAssistant ? 'Assistant' : 'User',
        duration: chunk.buffer.length / 16 // Approximate duration in ms
      }));

      fs.writeFileSync(
        path.join(recordingsDir, `${conversationId}_transcript.json`),
        JSON.stringify(transcript, null, 2)
      );

      console.log(`Saved conversation audio and transcript with ID: ${conversationId}`);
    } catch (error) {
      console.error('Error saving audio files:', error);
    }

    openaiWs.close();
  });
});

// Error handling
app.use((req, res, next) => {
  next(createError(404));
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

// Create HTTP server
const server = http.createServer(app);

// Attach WebSocket server to HTTP server
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/media-stream') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Start the server
const port = process.env.PORT || '5050';
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});