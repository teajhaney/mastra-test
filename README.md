# LinguaFlash - AI Translation Agent

A high-performance AI-powered translation agent built with the Mastra framework, optimized for low-latency, accurate translations across 30+ languages.

## 🌟 Overview

LinguaFlash is an intelligent translation agent that provides instant, context-aware translations using Google's Gemini AI models. The system is designed with speed and accuracy in mind, featuring automatic language detection, smart pattern extraction, and comprehensive evaluation capabilities.

### Key Features

- **🚀 Ultra-Fast Translations**: Optimized with Gemini 2.5 Flash for sub-second response times
- **🌍 30+ Languages**: Support for Korean, Spanish, French, German, Japanese, Chinese, and many more
- **🤖 Intelligent Pattern Recognition**: Automatically extracts text and target language from natural language inputs
- **📊 Quality Evaluation**: Built-in scoring system for translation accuracy and appropriateness
- **💾 Persistent Memory**: Conversation history stored with LibSQL for context-aware responses
- **📡 A2A Protocol**: JSON-RPC 2.0 compliant API for seamless integration
- **🔍 Observability**: Full AI tracing and logging with Pino logger
- **📚 Auto-Generated API Docs**: OpenAPI and Swagger UI support

## 🏗️ Architecture

This project is built using the **Mastra** framework, which provides a powerful abstraction for building AI agents with tools, memory, and evaluation capabilities.

### Project Structure

```
mastra-test/
├── src/
│   └── mastra/
│       ├── index.ts                    # Mastra framework initialization
│       ├── agents/
│       │   └── linguaflash-agent.ts   # Main translation agent
│       ├── tools/
│       │   └── linguaflash-tool.ts    # Translation tool using Gemini API
│       ├── scorers/
│       │   └── translation-scorer.ts  # Quality evaluation scorers
│       └── routes/
│           └── a2a-agent-route.ts     # A2A protocol API endpoint
├── package.json
├── tsconfig.json
└── README.md
```

### Core Components

#### 1. **LinguaFlash Agent** (`agents/linguaflash-agent.ts`)

The main AI agent that processes translation requests. Key features:

- Uses Gemini 2.5 Flash model for fast, accurate translations
- Intelligent language extraction from user input
- Automatic source language detection
- Context-aware responses with persistent memory
- Reduced scorer overhead for minimal latency

#### 2. **Translation Tool** (`tools/linguaflash-tool.ts`)

The execution engine that performs actual translations via Google's Gemini API:

- Direct API calls to Gemini 2.5 Flash Lite endpoint
- Optimized prompt engineering with JSON schema enforcement
- Low temperature (0.1) for deterministic results
- Token limits optimized for speed (maxOutputTokens: 150)
- Comprehensive error handling and JSON parsing

#### 3. **Evaluation Scorers** (`scorers/translation-scorer.ts`)

Quality assessment system with multiple scorers:

- **Tool Call Appropriateness**: Verifies correct tool usage
- **Translation Accuracy**: Custom scorer evaluating semantic accuracy and fluency
- **Completeness**: Ensures full response delivery
- Configurable sampling rates to balance accuracy vs. performance

#### 4. **A2A API Route** (`routes/a2a-agent-route.ts`)

JSON-RPC 2.0 compliant endpoint for agent communication:

- Standardized A2A protocol implementation
- Support for single messages and message arrays
- Context and task ID management
- Artifact generation for tool results
- Full conversation history tracking

## 🚀 Getting Started

### Prerequisites

- **Node.js**: >= 20.9.0
- **npm** or **yarn**
- **Google Gemini API Key**: Get one from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd mastra-test
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:

   ```bash
   GOOGLE_GEMINI_API_KEY=your_api_key_here
   # OR
   GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
   ```

4. **Verify configuration**

   Ensure your `tsconfig.json` is properly configured (already set up).

### Running the Application

#### Development Mode

Start the development server with hot-reloading:

```bash
npm run dev
```

This command:

- Starts the Mastra development server
- Enables hot-reloading for code changes
- Exposes the API at `http://localhost:3000` (default)
- Opens Swagger UI at `http://localhost:3000/docs`

#### Production Build

Build the application for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## 📖 Usage

### API Endpoints

#### A2A Agent Endpoint

**POST** `/a2a/agent/linguaFlashAgent`

Send a JSON-RPC 2.0 compliant request:

```json
{
  "jsonrpc": "2.0",
  "id": "request-123",
  "method": "generate",
  "params": {
    "message": {
      "role": "user",
      "content": "hello world to Korean",
      "parts": [
        {
          "kind": "text",
          "text": "hello world to Korean"
        }
      ]
    }
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": "request-123",
  "result": {
    "id": "task-uuid",
    "status": {
      "state": "completed",
      "message": {
        "role": "agent",
        "parts": [
          {
            "kind": "text",
            "text": "Translation: 안녕하세요 세계\n-(From English to Korean)"
          }
        ]
      }
    },
    "artifacts": [...],
    "history": [...]
  }
}
```

### Language Extraction Patterns

The agent intelligently extracts text and target language from various input formats:

| Input Pattern                         | Extracted Text       | Target Language |
| ------------------------------------- | -------------------- | --------------- |
| `hello to Korean`                     | `hello`              | `Korean`        |
| `what is your name? to korean`        | `what is your name?` | `Korean`        |
| `translate 'how are you?' to Spanish` | `how are you?`       | `Spanish`       |
| `bonjour French`                      | `bonjour`            | `French`        |

### Supported Languages

The agent supports 30+ languages including:

**European**: Spanish, French, German, Italian, Portuguese, Russian, Polish, Dutch, Swedish, Norwegian, Danish, Finnish, Greek, Czech, Hungarian, Romanian, Bulgarian, Croatian, Serbian, Slovak, Slovenian, Ukrainian

**Asian**: Korean, Japanese, Chinese, Hindi, Thai, Vietnamese, Indonesian, Malay

**Middle Eastern**: Arabic, Hebrew, Turkish

## 🛠️ Configuration

### Model Selection

Edit `agents/linguaflash-agent.ts` to change the AI model:

```typescript
model: 'google/gemini-2.5-flash'; // Recommended: balanced speed/accuracy
// model: 'google/gemini-2.0-flash-lite'  // Fastest: minimal latency
// model: 'google/gemini-2.0-flash-exp'   // Experimental features
```

### Database Storage

The application uses two storage mechanisms:

1. **Memory Storage** (default): Fast but non-persistent
   - Location: `src/mastra/index.ts` - `url: ':memory:'`

2. **File Storage**: Persistent across restarts
   - Location: `src/mastra/agents/linguaflash-agent.ts` - `url: 'file:../mastra.db'`

### Scorer Configuration

Adjust scorer sampling rates in `agents/linguaflash-agent.ts`:

```typescript
scorers: {
  toolCallAppropriateness: {
    scorer: scorers.toolCallAppropriatenessScorer,
    sampling: {
      type: 'ratio',
      rate: 0.05, // 5% of requests are scored (reduced for performance)
    },
  },
}
```

## 🧪 Testing

```bash
npm test
```

## 📊 Observability

The application includes built-in observability features:

- **Logging**: Pino logger with configurable levels
- **Tracing**: AI operation tracing with DefaultExporter
- **Metrics**: Storage of scores and evaluation data
- **API Documentation**: Auto-generated OpenAPI specs

Access Swagger UI: `http://localhost:3000/docs`

## 🔧 Technologies Used

- **[Mastra](https://mastra.ai/)**: AI agent framework
- **[Google Gemini](https://deepmind.google/technologies/gemini/)**: Translation AI models
- **[TypeScript](https://www.typescriptlang.org/)**: Type-safe development
- **[LibSQL](https://github.com/libsql/libsql)**: Embedded SQLite database
- **[Pino](https://github.com/pinojs/pino)**: High-performance logging
- **[Zod](https://zod.dev/)**: Schema validation
- **[Vercel AI SDK](https://sdk.vercel.ai/)**: AI SDK integration

## 📝 License

ISC

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions:

1. Check the [Mastra documentation](https://mastra.ai/docs)
2. Review existing GitHub issues
3. Create a new issue with detailed information

---

**Built with ❤️ using Mastra Framework**
