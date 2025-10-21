# Lizdeika – AI Customer Support Platform

Lizdeika is an open source customer support system that blends AI assistance with human oversight. It handles incoming questions, suggests helpful answers, and lets agents decide whether to send them. It also supports fully automated replies when you choose.

## Table of contents
- [Overview](#overview)
- [Key features](#key-features)
- [Quick start with Docker](#quick-start-with-docker)
- [Traditional setup](#traditional-setup)
- [Accessing the platform](#accessing-the-platform)

## Overview

Lizdeika uses embeddings, vector search and large language models to deliver quick and accurate answers. You can add documents through an API or a web UI, and the system embeds them into a Chroma vector database. Queries are rephrased, embedded and matched against the knowledge base. A language model then answers based on the retrieved context. Prompts are provided through Langfuse or manually.

## Key features

- **AI workflow** – query rephrasing, embedding and context‑aware answer generation.
- **Modes of operation**  
  - **Human‑in‑the‑loop (HITL)** – the AI suggests responses; agents approve them.  
  - **Autopilot** – the AI replies directly but adds a warning.  
  - **Offline** – informs users that support will reply later.
- **Document management** – upload and embed documents via API or UI.
- **User management** – admin can create users, change passwords and manage roles.
- **Agent dashboard** – agents can go online/offline, assign or archive conversations and see system status.
- **Scalable chat** – supports multiple concurrent agents and conversations.

## Quick start with Docker

The easiest way to run Lizdeika is with Docker. You need Docker and Docker Compose installed. The following steps will start all services and prepare the database:

```bash
# clone the repository if you haven't already
git clone https://github.com/simonaszilinskas/lizdeika.git
cd lizdeika

# start the containers and run migrations and seed data
docker-compose up -d
docker-compose exec backend npx prisma migrate dev --name init
docker-compose exec backend npm run seed
```

This will build and start the backend, frontend and database on port `3002`.

## Traditional setup

If you prefer to run without containers, you will need Node.js 18+ and PostgreSQL 12+ installed.

### Install dependencies

```bash
cd custom-widget/backend
npm install
```

### Set up the database

1. Create a database called `vilnius_support`:

   ```bash
   createdb vilnius_support
   ```

2. Copy the example environment file and adjust it with your database and API keys:

   ```bash
   cp .env.example .env
   ```

3. Push the Prisma schema to the database:

   ```bash
   npx prisma db push
   ```

4. Seed the database (optional):

   ```bash
   npm run seed
   ```

### Start the server

```bash
npm start
```

## Accessing the platform

Once the server is running (either via Docker or manually), you can access the various interfaces at the following URLs (default port `3002`):

- **Agent dashboard:** http://localhost:3002/agent-dashboard.html  
- **Customer widget demo:** http://localhost:3002/embed-widget.html  
- **Settings / admin:** http://localhost:3002/settings.html  
- **Login page:** http://localhost:3002/login.html  
- **API documentation (Swagger):** http://localhost:3002/docs

## Notes

- All services run on port `3002` when using Docker.
- Do not commit API keys or secrets to the repository. Use environment variables to store sensitive data.
- Contributions are welcome. Please open issues or pull requests with improvements or bug fixes.
