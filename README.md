# TicketFlow: Distributed Real-Time Kitchen Display System (KDS)

TicketFlow is an enterprise-grade, real-time Kitchen Display System designed for high-concurrency food service environments. The system guarantees reliable state synchronization across dynamic kitchen stations with zero lost events, zero duplicate state transitions, and automatic reconnect recovery over unstable network connections.

---

## Key System Capabilities

- **Monotonic Event Sourcing**: Guaranteed total ordering of all state transitions per kitchen instance via database-generated sequence numbers.
- **Reconnect and Replay Protocol**: Client-side state machine with live event buffering and gap detection to handle network drops without state drift or duplicate processing.
- **Distributed Concurrency Control**: Redis-backed atomic locking (`SET NX PX`) and idempotency key evaluation to eliminate race conditions under concurrent order modifications.
- **Multi-Tenant Station Routing**: Dynamic work queues segregated by kitchen station roles (e.g., Intake, Prep, Grill, Assembly, Expedite).
- **Automated CI/CD Pipeline**: GitHub Actions workflow supporting multi-target verification, Turborepo builds, Cloudflare Pages frontend deployment, and Render backend hosting.

---

## High-Level Architecture

The system follows Clean Architecture principles, isolating domain state machines, repository data access, infrastructure adapters, and real-time transport layers.

```mermaid
flowchart TB
    subgraph Clients["Client Layer"]
        ManagerUI["Manager Dashboard\n(React / Vite)"]
        StationUI["Station Display Boards\n(React / Vite)"]
    end

    subgraph Transport["Transport & API Layer"]
        Gateway["Socket.IO Real-Time Gateway\n(WebSocket Router)"]
        API["Express REST Controllers\n(HTTP API)"]
    end

    subgraph Application["Application Layer"]
        OrderService["Order Service\n(State Orchestration)"]
        StateMachine["Domain State Machine\n(Validation Rules)"]
    end

    subgraph Infrastructure["Infrastructure & Persistence"]
        RedisLock["Redis Distributed Lock Service\n(Idempotency & Redlock)"]
        PrismaRepo["Order Repository\n(Transactional Persistence)"]
        PostgresDB[("PostgreSQL Database\n(Orders & Event Log)")]
    end

    ManagerUI <--> Gateway
    StationUI <--> Gateway
    ManagerUI --> API
    StationUI --> API

    Gateway --> OrderService
    API --> OrderService
    OrderService --> StateMachine
    OrderService --> RedisLock
    OrderService --> PrismaRepo
    PrismaRepo --> PostgresDB
```

---

## Reconnect and Replay Protocol

To prevent out-of-order execution during temporary client disconnections, the client operates as a finite state machine:

1. **ONLINE**: Incoming socket events with `sequenceNumber == lastProcessedSequence + 1` are processed immediately.
2. **GAP DETECTED**: If `sequenceNumber > lastProcessedSequence + 1`, the client switches to `SYNCING` mode and pushes incoming live frames to a `liveBuffer`.
3. **REPLAY REQUEST**: The client emits `order:replayRequest` containing its `lastProcessedSequence`.
4. **RECONCILIATION**: The server streams all missed events. The client applies missing events in strict order, drains the `liveBuffer`, filters duplicates, and resumes `ONLINE` mode.

```mermaid
sequenceDiagram
    autonumber
    participant Client as Station Display
    participant Server as Backend Gateway
    participant Store as Event Store (PostgreSQL)

    Note over Client,Server: Client disconnected after sequence number 2
    Server->>Store: Process Order Transition (Seq 3)
    Server->>Store: Process Order Transition (Seq 4)
    
    Note over Client,Server: Client reconnects to network
    Client->>Server: Connect (station:join)
    Client->>Server: Emit order:replayRequest (lastProcessedSequence: 2)
    Client->>Client: Switch Status to SYNCING (Buffer live events)

    Server->>Store: Fetch events WHERE sequenceNumber > 2
    Store-->>Server: Return Events [Seq 3, Seq 4]
    
    par Live Event Broadcast
        Server->>Client: Emit order:transition (Seq 5)
        Note over Client: Buffer Seq 5 in liveBuffer
    and Replay Payload Delivery
        Server->>Client: Emit order:replayResponse [Seq 3, Seq 4]
    end

    Note over Client: Apply Seq 3 and Seq 4 to local state
    Note over Client: Drain liveBuffer (Apply Seq 5)
    Note over Client: Switch Status to ONLINE
```

---

## Database Schema Design

The relational persistence model enforces integrity using strict sequence uniqueness constraints per kitchen.

```
+-------------------------------------------------------+
|                       Kitchen                         |
+-------------------------------------------------------+
| id         : String (UUID, PK)                        |
| name       : String                                   |
| createdAt  : Timestamp                                |
| updatedAt  : Timestamp                                |
+---------------------------+---------------------------+
                            | 1
                            |
                            | *
+---------------------------v---------------------------+
|                        Station                        |
+-------------------------------------------------------+
| id           : String (UUID, PK)                      |
| kitchenId    : String (FK -> Kitchen.id)              |
| name         : String                                 |
| displayOrder : Integer                                |
| route        : String                                 |
+-------------------------------------------------------+

+-------------------------------------------------------+
|                         Order                         |
+-------------------------------------------------------+
| id                : String (UUID, PK)                 |
| kitchenId         : String (FK -> Kitchen.id)         |
| customerName      : String                            |
| items             : String (JSON)                     |
| priority          : Integer                           |
| estimatedPrepTime : Integer                           |
| status            : OrderStatus (Enum)                |
| currentStationId  : String (Nullable)                 |
| createdAt         : Timestamp                         |
| updatedAt         : Timestamp                         |
+---------------------------+---------------------------+
                            | 1
                            |
                            | *
+---------------------------v---------------------------+
|                      OrderEvent                       |
+-------------------------------------------------------+
| id             : String (UUID, PK)                    |
| sequenceNumber : BigInt                               |
| kitchenId      : String (FK -> Kitchen.id)            |
| orderId        : String (FK -> Order.id)              |
| type           : String                               |
| payload        : Json                                 |
| createdAt      : Timestamp                            |
+-------------------------------------------------------+
| UNIQUE INDEX   : (kitchenId, sequenceNumber)          |
+-------------------------------------------------------+
```

---

## Domain State Machine

Order state transitions follow strict unidirectionality. Invalid status jumps are rejected at the domain layer prior to database locking.

```
   +----------+        +-----------+        +-------+        +--------+
   |  PLACED  | ---->  | PREPARING | ---->  | READY | ---->  | SERVED |
   +----------+        +-----------+        +-------+        +--------+
```

Allowed Transitions:
- `PLACED` -> `PREPARING`
- `PREPARING` -> `READY`
- `READY` -> `SERVED`

Any attempt to bypass sequence steps (e.g., `PLACED` directly to `SERVED`) raises a domain-level validation error (`Invalid state transition`).

---

## Workspace Structure

The project is structured as a Turborepo monorepo:

```
ticketFlow/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Automated CI/CD verification workflow
├── apps/
│   ├── backend/                   # Node.js / Express / Socket.IO server
│   │   ├── prisma/
│   │   │   └── schema.prisma      # PostgreSQL Prisma schema definition
│   │   └── src/
│   │       ├── controllers/       # HTTP request handlers
│   │       ├── domain/            # State machine domain rules
│   │       ├── lib/               # Redis & Prisma client initializers
│   │       ├── repositories/      # Transactional database access
│   │       ├── services/          # Business logic & distributed locks
│   │       ├── sockets/           # Real-time WebSocket handlers
│   │       └── index.ts           # HTTP & Socket server bootstrap
│   └── frontend/                  # React / Vite / Tailwind KDS UI
│       ├── public/
│       │   └── _redirects         # Cloudflare Pages SPA routing rules
│       └── src/
│           ├── App.tsx            # Main application component
│           ├── main.tsx           # React DOM entrypoint
│           └── index.css          # Tailwind CSS design system
├── packages/
│   └── types/                     # Shared TypeScript interfaces & types
├── package.json                   # Root monorepo workspace configuration
├── pnpm-workspace.yaml            # Monorepo workspace mapping
└── turbo.json                     # Turborepo task pipeline configuration
```

---

## Environment Variables Configuration

Create a `.env` file inside `apps/backend/` using the following parameters:

```env
PORT=4000
NODE_ENV=production
DATABASE_URL="postgresql://user:password@host-pooler.region.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@host-direct.region.aws.neon.tech/neondb?sslmode=require"
REDIS_URL="rediss://default:password@host.upstash.io:6379"
```

---

## Getting Started

### Prerequisites

- Node.js version 20 or higher
- npm version 10 or higher
- Running PostgreSQL database (or Neon / Supabase instance)
- Running Redis instance (or Upstash Redis endpoint)

### Installation

Clone the repository and install all monorepo dependencies:

```bash
git clone https://github.com/ynuvt/TicketFlow.git
cd ticketFlow
npm ci
```

### Database Initialization

Generate the Prisma client and push the schema to your PostgreSQL database:

```bash
cd apps/backend
npx prisma generate
npx prisma db push
```

### Local Development

Run both frontend and backend concurrently via Turborepo:

```bash
# Run from root directory
npm run dev
```

- Frontend Dev Server: `http://localhost:3000`
- Backend Server: `http://localhost:4000`

---

## Deployment Architecture

### Continuous Integration and Deployment (GitHub Actions)

The repository uses GitHub Actions (`.github/workflows/ci.yml`) for end-to-end verification and deployment:

1. **Verification**: Executes TypeScript compilation (`tsc --noEmit`) across all workspace packages and builds production bundles using Turborepo.
2. **Frontend Deployment**: Deploys static SPA assets from `apps/frontend/dist` to **Cloudflare Pages** using `npx wrangler pages deploy`.
3. **Backend Deployment**: Sends a secure webhook trigger to **Render** to deploy the Node.js application from `apps/backend`.
