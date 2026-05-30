# ALEBRIJE AI COMPANION — A Million Plateaus

## Design Philosophy

The Alebrije is not a chatbot. It is a **psychopomp** — a guide between worlds, made of combined animals, speaking in the voice of the world itself. It knows where you've been, what you're near, and what you might become.

It asks more than it answers.

---

## Creature System

### Component Model

```rust
pub struct AlibrijeState {
    pub name:          String,
    pub components:    Vec<CreatureComponent>,  // max 4, one per body region
    pub color_map:     HashMap<DomainId, [f32; 3]>,
    pub evolution_log: Vec<EvolutionEvent>,
}

// Each plateau mastered = one new component unlocked
// Player chooses which component to add at evolution points
```

### Archetypes and Learning Domains

| Archetype | Learning domain | Visual feature |
|---|---|---|
| Owl | Formal logic, proof, mathematics | Wings, sharp eyes |
| Octopus | Systems thinking, interconnection | Extra limbs, chromatophores |
| Jaguar | Intuition, fast pattern recognition | Coat patterns, agility |
| Serpent | Recursion, cycles, self-reference | Coiling body |
| Eagle | Abstraction, high-level view | Broad wingspan, altitude |
| Axolotl | Resilience, regeneration | Gill crown, regenerating parts |
| Xolo Dog | Psychopomp, crossing thresholds | Naked skin, ancient eyes |
| Quetzal | Beauty in structure, art-math union | Iridescent tail feathers |

### Visual Evolution

Alebrije color shifts per domain visited:
```
e1 (Formal) → deep blues and golds
e2 (Physical) → greens and ambers
e3 (Creative) → magentas and turquoises
Cross-domain synthesis → luminous white accents
```

Alebrije grows new features as depth increases:
- Depth 1 (first visit) → color change
- Depth 2 (returned) → texture detail
- Depth 3 (contributed resource) → new small feature (spine, fin, etc.)
- Depth 4 (crystallized resource) → major feature (new limb, wing, etc.)

---

## AI Layer

### Request Structure

```typescript
// apps/alebrije/src/context-builder.ts

interface AlibrijeRequest {
    plateau_id:        string
    wizard_traversals: Traversal[]    // ordered by recency
    alebrije_name:     string
    alebrije_components: string[]     // archetype names
    user_message:      string
    conversation_history: Message[]   // last N turns
}

interface Traversal {
    plateau_name:  string
    depth:         number
    last_visit:    number
}
```

### System Prompt Architecture

Each island has its own system prompt fragment. The full prompt is assembled per-request:

```typescript
function buildSystemPrompt(req: AlibrijeRequest): string {
    const plateau = PLATEAU_PROMPTS[req.plateau_id]
    const creatureVoice = buildCreatureVoice(req.alebrije_components)
    const traversalSummary = summarizeTraversals(req.wizard_traversals)

    return `
You are ${req.alebrije_name}, a creature of ${creatureVoice}.
You live in A Million Plateaus — a world where knowledge is geography.

You are currently on: ${plateau.name}
This plateau's nature: ${plateau.description}
What surrounds you here: ${plateau.atmosphere}

The traveler you guide has walked through: ${traversalSummary}
Their alebrije body reflects: ${describeEvolution(req.alebrije_components)}

Your voice:
- You speak in short, poetic phrases. Never more than 3 sentences.
- You ask questions more often than you answer them.
- You never say "as an AI" or "I'm an AI". You ARE the world.
- You use metaphors drawn from your creature nature.
- You are curious, patient, occasionally mischievous.
- You know what plateaus are near. You hint at them.
- You never lecture. You illuminate.

If the traveler is lost: point at the fog, not through it.
If the traveler is stuck: name the shape of the confusion, not the solution.
If the traveler is ready: say so with a question that feels like a door.
`
}
```

### Plateau Prompt Library

```typescript
// apps/alebrije/src/plateau-prompts.ts

export const PLATEAU_PROMPTS: Record<string, PlateauPrompt> = {
    "linear-algebra": {
        name: "The Plateau of Linear Algebra",
        description: "A place of transformations. Everything here can be stretched, rotated, projected. Space itself is a canvas.",
        atmosphere: "Grids that pulse with eigenvalues. Arrows that spin slowly in the wind.",
        nearby_plateaus: ["geometry", "quantum-mechanics", "data-science"],
        key_concepts: ["vectors", "matrices", "eigenvectors", "linear maps", "inner product"],
    },
    "geometric-algebra": {
        name: "The Plateau of Geometric Algebra",
        description: "A place where multiplication encodes geometry. Rotors spin without gimbal lock. The pseudoscalar breathes.",
        atmosphere: "Bivectors shimmer as planes. Rotors drift like slow gyroscopes.",
        nearby_plateaus: ["linear-algebra", "physics", "computer-graphics"],
        key_concepts: ["geometric product", "rotors", "bivectors", "grade", "pseudoscalar"],
    },
    // ... one entry per plateau — data-driven, loaded from graph DB
}
```

### Claude API Call

```typescript
// apps/alebrije/src/companion.ts
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()  // API key from env

export async function askAlebrije(req: AlibrijeRequest): Promise<string> {
    const systemPrompt = buildSystemPrompt(req)

    const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 256,     // Short — the Alebrije speaks briefly
        system: systemPrompt,
        messages: [
            ...req.conversation_history,
            { role: "user", content: req.user_message }
        ]
    })

    return response.content
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("")
}
```

---

## Local State — What Is Never Sent to Server

```
Sent to Alebrije API server:
  ✅ Current plateau ID
  ✅ Traversal history (plateau names + depths, no personal data)
  ✅ Alebrije component names
  ✅ User message
  ✅ Last N conversation turns

Never sent:
  ❌ Wizard keypair / identity
  ❌ Full graph state
  ❌ Resource votes
  ❌ Trail markers
  ❌ Anything not needed for conversation context
```

The Alebrije API server is **stateless** — it builds context from what the client sends per request. No session storage, no user profiles on the server.

---

## Alebrije as Plateau Discovery Engine

The Alebrije's suggestions are driven by the wizard's reputation multivector shape:

```typescript
function suggestNextPlateaus(rep: WizardReputation, graph: KnowledgeGraph): string[] {
    // Find plateaus just above reachability threshold
    // These are the "almost reachable" places — most valuable suggestions
    return graph.plateaus
        .filter(p => {
            const score = rep.innerProductWith(p.position)
            return score > THRESHOLD * 0.7 && score < THRESHOLD * 1.3
        })
        .sort((a, b) => /* by conceptual distance to wizard's current shape */)
        .slice(0, 3)
        .map(p => p.name)
}
```

The Alebrije hints at these without naming them directly — "I smell something cold and formal to the north-east of where we stand."
