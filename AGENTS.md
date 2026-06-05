# HomeSight AGENTS.md

## Project Context

HomeSight is a WeChat Mini Program for smart home/floor plan management, backed by a Spring Boot Java API and a Python renovation knowledge RAG agent.

### Technology Stack

- **Mini Program**: Native WeChat framework (WXML/WXSS/JS), no npm dependencies, no third-party UI libs
- **Backend**: Spring Boot 3.x + JPA + MySQL (requires JDK 17+)
- **AI (Main)**: Tongyi Qwen VL API for floor plan analysis
- **AI (RAG)**: Ollama + Milvus for renovation knowledge Q&A
- **Storage**: Aliyun OSS

### Key Conventions

1. **Java 17 required** — Spring Boot 3.x uses Java 17+ features; set `java.configuration.runtimes` to JDK 17 path in Cursor settings
2. **No npm** — The miniprogram uses native components only
3. **No three.js** — 3D rendering is custom WebGL (~300 lines)
4. **No third-party UI libs** in the miniprogram
5. **API keys** stay server-side only; mini program talks to our Java backend, never directly to AI APIs
6. **CRLF line endings** — This project uses CRLF (Windows); do not normalize to LF

### Scope of Work

The agent helps with:
- Full-stack bug fixes and feature development (miniprogram + Spring Boot backend)
- Git operations, code review, PR management
- RAG agent development (Python + Ollama + Milvus)
- Dev environment setup and troubleshooting

### What the Agent Should NOT Do

- Do not commit secrets, credentials, or private config files (e.g. `project.private.config.json`, `.env`)
- Do not add npm dependencies to the miniprogram
- Do not use three.js or other 3D libraries
- Do not push directly to `main` or `master` without the user's request
