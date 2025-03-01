export const oraApi = {
    endpoints: {
      chatCompletions: 'https://api.ora.io/v1/chat/completions',
      imageGenerations: 'https://api.ora.io/v1/images/generations',
      videoGenerations: 'https://api.ora.io/v1/videos/generations',
    },
    headers: {
      'Content-Type': 'application/json',
    },
    usageNotes: {
      chat: {
        method: 'POST',
        bodyFormat: {
          model: 'string (name of AI model)',
          messages: 'array (OpenAI-style messages: [{role, content}])',
          search_enabled: 'boolean (optional) - if web search is to be used',
        },
        exampleShellCommand: `curl -X POST "https://api.ora.io/v1/chat/completions" \\
    -H "Authorization: Bearer $ORA_API_KEY" \\
    -H "Content-Type: application/json" \\
    -d '{
      "model": "deepseek-ai/DeepSeek-V3",
      "messages": [{"role": "user", "content": "What are some fun things to do in New York?"}]
    }'`,
      },
      imageGeneration: {
        method: 'POST',
        bodyFormat: {
          model: 'string (name of AI model)',
          prompt: 'string (your text prompt)',
          steps: 'integer (number of diffusion steps)',
          n: 'integer (number of images to generate)',
        },
      },
      videoGeneration: {
        method: 'POST',
        getMethod: 'GET (for result retrieval)',
        bodyFormat: {
          model: 'string (video model name)',
          prompt: 'string (text prompt)',
          seed: 'integer (for random generator seed)',
        },
      },
    },
    searchFeature: {
      notes: `For search-enabled chat completions, you get a 'search_result' array with relevant URLs, contexts, etc.`,
    },
  };
  
  export const oraSupportedModels = {
    // language models:
    "deepseek-ai/DeepSeek-V3": 0.15,            // Per 1M Tokens
    "deepseek-ai/DeepSeek-R1": 1.35,            // Per 1M Tokens
  
    "meta-llama/Llama-3.3-70B-Instruct": 0.68,  // Per 1M Tokens
    "meta-llama/Llama-3.2-3B-Instruct": 0.05,   // Per 1M Tokens
    "meta-llama/Llama-2-13b-chat-hf": 0.17,     // Per 1M Tokens
    "meta-llama/Llama-2-7b-chat-hf": 0.15,      // Per 1M Tokens
    "meta-llama/Llama-3.1-405B-Instruct": 2.69, // Per 1M Tokens
    "meta-llama/Llama-3.2-1B-Instruct": 0.05,   // Per 1M Tokens
    "meta-llama/Meta-Llama-3-8B-Instruct": 0.14,// Per 1M Tokens
  
    "google/gemma-2b-it": 0.08,                 // Per 1M Tokens
    "google/gemma-2-27b-it": 0.62,              // Per 1M Tokens
    "google/gemma-2-9b-it": 0.23,               // Per 1M Tokens
  
    "mistralai/Mistral-7B-Instruct-v0.3": 0.15,  // Per 1M Tokens
    "mistralai/Mixtral-8x22B-Instruct-v0.1": 0.92,// Per 1M Tokens
    "mistralai/Mistral-7B-Instruct-v0.2": 0.15,  // Per 1M Tokens
    "mistralai/Mixtral-8x7B-Instruct-v0.1": 0.46,// Per 1M Tokens
    "mistralai/Mistral-7B-Instruct-v0.1": 0.15,  // Per 1M Tokens
  
    "Qwen/QwQ-32B-Preview": 0.92,               // Per 1M Tokens
    "Qwen/Qwen2.5-Coder-32B-Instruct": 0.62,     // Per 1M Tokens
    "Qwen/Qwen2.5-72B-Instruct": 0.92,          // Per 1M Tokens
    "Qwen/Qwen2-72B-Instruct": 0.96,            // Per 1M Tokens
  
    // image generation models:
    "black-forest-labs/FLUX.1-dev": 0.020,       // Per 1M Pixels @ 28 Steps
    "black-forest-labs/FLUX.1-canny": 0.020,     // Per 1M Pixels @ 28 Steps
    "black-forest-labs/FLUX.1-redux-dev": 0.020, // Per 1M Pixels @ 28 Steps
    "black-forest-labs/FLUX.1-schnell": 0.006,   // Per 1M Pixels @ 4 Steps
  
    "stabilityai/stable-diffusion-3.5-large": 0.05,        // Per Image
    "stabilityai/stable-diffusion-3.5-large-turbo": 0.03,  // Per Image
    "stabilityai/stable-diffusion-3-medium": 0.03,         // Per Image
    "stabilityai/stable-diffusion-3.5-medium": 0.03,       // Per Image
  
    // video generation model:
    "KumoAnonymous/KumoVideo-Turbo": 1.0,        // Per Video
  };
  