import fastify from 'fastify'
import websocketPlugin from '@fastify/websocket'
import dotenv from 'dotenv'
import { twiml } from 'twilio'
import WebSocket from 'ws'

dotenv.config()

const server = fastify()

// Register WebSocket support
server.register(websocketPlugin)

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!OPENAI_API_KEY) {
  throw new Error('Missing the OpenAI API key. Please set it in the .env file.')
}

// Basic health check route
server.get('/ping', async (request, reply) => {
  return 'pong\n'
})

// Handle incoming Twilio calls
server.all('/incoming-call', async (request, reply) => {
  console.log("Received incoming call request")
  
  const response = new twiml.VoiceResponse()
  const host = request.headers.host
  const connect = response.connect()
  connect.stream({ url: `wss://${host}/media-stream` })
  
  reply
    .header('Content-Type', 'text/xml')
    .send(response.toString())
})

// WebSocket endpoint for media streaming
server.register(async function (fastify) {
  fastify.get('/media-stream', { websocket: true }, (connection, req) => {
    console.log("Client connected")

    // Initialize OpenAI WebSocket for speech-to-text
    const sttWs = new WebSocket('wss://api.openai.com/v1/audio/speech-to-text', {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    })

    // Initialize OpenAI WebSocket for text-to-speech
    const ttsWs = new WebSocket('wss://api.openai.com/v1/audio/text-to-speech', {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    })

    let streamSid: string | null = null
    let currentTranscript = ''

    // Handle incoming WebSocket messages from Twilio
    connection.socket.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message)
        
        if (data.event === 'media' && sttWs.readyState === WebSocket.OPEN) {
          // Send audio data for transcription
          sttWs.send(JSON.stringify({
            audio: data.media.payload,
            type: 'audio_data'
          }))
        } else if (data.event === 'start') {
          streamSid = data.start.streamSid
          console.log(`Incoming stream has started ${streamSid}`)
          currentTranscript = ''
        }
      } catch (error) {
        console.error('Error processing message:', error)
      }
    })

    // Handle speech-to-text results
    sttWs.addEventListener('message', async (event) => {
      try {
        const response = JSON.parse(event.data as string)
        
        if (response.type === 'final_transcript') {
          currentTranscript = response.text
          console.log('Transcribed text:', currentTranscript)

          // Call your API here
          const apiResponse = await mockApiCall(currentTranscript)
          
          // Send text to text-to-speech service
          ttsWs.send(JSON.stringify({
            text: apiResponse,
            voice: 'alloy',
            type: 'text_to_speech'
          }))
        }
      } catch (error) {
        console.error('Error processing STT message:', error)
      }
    })

    // Handle text-to-speech audio chunks
    ttsWs.addEventListener('message', async (event) => {
      try {
        const response = JSON.parse(event.data as string)
        
        if (response.type === 'audio_data') {
          const audioDelta = {
            event: "media",
            streamSid,
            media: {
              payload: response.audio
            }
          }
          connection.socket.send(JSON.stringify(audioDelta))
        }
      } catch (error) {
        console.error('Error processing TTS message:', error)
      }
    })

    // Cleanup on connection close
    connection.socket.on('close', () => {
      console.log('Client disconnected')
      sttWs.close()
      ttsWs.close()
    })
  })
})

// Mock API call function - replace with actual API integration
async function mockApiCall(text: string): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`You said: ${text}. This is a mock response.`)
    }, 1000)
  })
}

// Start the server
server.listen({ port: 8080 }, (err, address) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Server listening at ${address}`)
})