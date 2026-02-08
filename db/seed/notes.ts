/**
 * Sample Notes for Flint
 * These demonstrate various note types and content styles
 */

export const sampleNotes = [
  // Journal entries
  {
    title: "Morning Reflection",
    noteType: "journal" as const,
    moodScore: 8,
    content: `# Morning Reflection - Sample Entry

## Gratitude
What am I grateful for today?
- Woke up feeling refreshed after a good night's sleep
- Coffee tastes extra good this morning
- Have a clear schedule to focus on deep work

## Intentions
What do I want to accomplish?
- Finish the quarterly planning document
- Have a productive 1:1 with @Sarah Miller
- Take a proper lunch break

## Mindset
How am I approaching today?
I'm feeling optimistic and energized. Yesterday's challenges are behind me, and today is a fresh start.

---

**Mood:** 8/10
**Energy Level:** High
`,
    metadata: {
      wordCount: 89,
      embeddingStatus: "pending" as const,
    },
    tags: ["reflection", "goal"],
    mentions: ["Sarah Miller"],
  },
  {
    title: "Weekly Review - Week 42",
    noteType: "journal" as const,
    moodScore: 7,
    content: `# Weekly Review

## Wins This Week
- Shipped the new dashboard feature ahead of schedule
- Had a great brainstorming session with @Alex Chen
- Established a morning routine that's actually sticking

## Challenges
- Struggled with context switching between projects
- Meetings ran over multiple times
- Need to improve estimation skills

## Lessons Learned
1. Time-boxing works better than to-do lists for me
2. Saying "no" to some meetings is necessary
3. Writing things down helps clarify thinking

## Next Week's Focus
- Complete API integration with partner system
- Prepare Q4 roadmap presentation
- Schedule dentist appointment (been putting this off!)

## Energy & Mood
Overall a productive week, though I felt drained by Thursday. Need to protect Wednesday afternoons for focused work.

---

**Overall Mood:** 7/10
`,
    metadata: {
      wordCount: 142,
      embeddingStatus: "pending" as const,
    },
    tags: ["reflection", "work", "goal"],
    mentions: ["Alex Chen"],
  },

  // Knowledge notes
  {
    title: "Literature Note: Thinking in Systems",
    noteType: "note" as const,
    sourceUrl:
      "https://www.goodreads.com/book/show/3828902-thinking-in-systems",
    content: `# Literature Note: Thinking in Systems

## Source Information
- **Author:** Donella H. Meadows
- **Type:** Book
- **Date Read:** 2024

## Key Takeaways

### What is a system?
A system is an interconnected set of elements that is coherently organized in a way that achieves something. It consists of:
- Elements (things you can see, feel, count)
- Interconnections (relationships that hold elements together)
- Function/Purpose (the reason the system exists)

### Feedback Loops
1. **Balancing loops** - seek equilibrium, resist change
2. **Reinforcing loops** - amplify change, create growth or collapse

### Leverage Points
Places to intervene in a system (in increasing order of effectiveness):
1. Constants, parameters, numbers
2. Buffer sizes
3. Structure of material flows
4. Delays
5. Feedback loop strength
6. Information flows
7. Rules of the system
8. Power to change rules
9. Goals of the system
10. Paradigm or worldview
11. Power to transcend paradigms

## My Reflections
This framework helps explain why some problems are so "sticky" - we often intervene at low-leverage points. Need to apply this thinking to our product development process.

## Connections
- Relates to @David Lee's advice about second-order effects
- Could improve how we do project planning

---

**Tags:** #book #learning #reference
`,
    metadata: {
      wordCount: 225,
      embeddingStatus: "pending" as const,
    },
    tags: ["book", "learning", "reference"],
    mentions: ["David Lee"],
  },
  {
    title: "Meeting Notes: Q4 Planning",
    noteType: "note" as const,
    content: `# Meeting Notes: Q4 Planning

## Meeting Details
- **Date:** October 15, 2024
- **Attendees:** @Alex Chen, @Sarah Miller, @James Wilson

## Agenda
1. Review Q3 results
2. Discuss Q4 priorities
3. Resource allocation

## Discussion Points

### Q3 Review
- Revenue up 15% vs target
- Customer satisfaction at 4.5/5
- Technical debt increased - need to address

### Q4 Priorities
1. **Dashboard Redesign** - @James Wilson leading
   - User research complete
   - Design phase: Oct-Nov
   - Engineering: Nov-Dec

2. **API v2** - @Alex Chen leading
   - Breaking changes communicated to partners
   - Migration guide needed

3. **Performance Optimization** - TBD lead
   - Target: 50% reduction in load time
   - Focus on mobile experience

## Action Items
- [ ] @Sarah Miller: Draft customer communication - Due: Oct 20
- [ ] @Alex Chen: Create API migration timeline - Due: Oct 18
- [ ] @James Wilson: Share design mockups - Due: Oct 22
- [ ] Schedule follow-up for sprint planning

## Decisions Made
- Q4 theme: "Performance & Polish"
- Hiring pause until January
- Will not pursue enterprise features this quarter

---

**Tags:** #meeting #work #project
`,
    metadata: {
      wordCount: 198,
      embeddingStatus: "pending" as const,
    },
    tags: ["meeting", "work", "project"],
    mentions: ["Alex Chen", "Sarah Miller", "James Wilson"],
  },
  {
    title: "Idea: Personal Knowledge Graph",
    noteType: "note" as const,
    content: `# Idea: Personal Knowledge Graph

**Created:** October 2024

## The Problem
Information is scattered across too many tools:
- Notes in various apps
- Bookmarks never revisited
- Articles read but forgotten
- Conversations lost to time

We capture knowledge but fail to connect it.

## The Solution
A personal knowledge graph that:
1. Automatically extracts entities from notes
2. Finds connections between concepts
3. Surfaces relevant context when writing
4. Grows smarter over time

## Why This Matters
- Second brain that actually works
- Reduces cognitive load of remembering everything
- Enables serendipitous discovery
- Compounds knowledge over time

## Potential Approaches

### Technical Implementation
- Graph database (Neo4j or similar)
- NLP for entity extraction
- Embedding-based similarity
- UI that shows connections visually

### MVP Scope
1. Manual linking between notes
2. Automatic backlink detection
3. Simple graph visualization
4. Search that understands context

## Next Steps
- [ ] Research existing tools (Roam, Obsidian, Notion)
- [ ] Sketch basic data model
- [ ] Talk to @Michael Brown about graph databases

## Related Ideas
- Connects to systems thinking (everything is connected)
- Could integrate with daily journaling

---

**Tags:** #idea #project #learning
`,
    metadata: {
      wordCount: 207,
      embeddingStatus: "pending" as const,
    },
    tags: ["idea", "project", "learning"],
    mentions: ["Michael Brown"],
  },
  {
    title: "Health Check-in",
    noteType: "journal" as const,
    moodScore: 6,
    content: `# Health Check-in

## Physical
- Sleep: 6.5 hours (need more)
- Exercise: Walked 8000 steps, no workout
- Diet: Mostly good, skipped breakfast

## Mental
- Stress level: Medium-high
- Focus: Scattered today
- Anxiety: Some work-related worry

## Notes for Dr. Smith
- Headaches more frequent this month
- Should ask about vitamin D levels
- Sleep quality declining

## Action Items
- [ ] Schedule annual physical with @Dr. Smith
- [ ] Try 10pm bedtime this week
- [ ] Add more vegetables to meals

## What's Working
- Morning meditation (5 mins)
- Afternoon walks
- Limiting coffee after 2pm

## What's Not Working
- Screen time before bed
- Eating lunch at desk
- Skipping stretches

---

**Mood:** 6/10
**Energy:** Low-Medium
`,
    metadata: {
      wordCount: 123,
      embeddingStatus: "pending" as const,
    },
    tags: ["health", "reflection"],
    mentions: ["Dr. Smith"],
  },
  {
    title: "Learning: Introduction to TypeScript Generics",
    noteType: "note" as const,
    sourceUrl: "https://www.typescriptlang.org/docs/handbook/2/generics.html",
    content: `# Learning: TypeScript Generics

## Concept Overview
Generics allow creating reusable components that work with multiple types while maintaining type safety.

## Key Points

### Basic Generic Function
\`\`\`typescript
function identity<T>(arg: T): T {
  return arg;
}

// Usage
const num = identity<number>(42);
const str = identity("hello");  // Type inferred
\`\`\`

### Generic Interfaces
\`\`\`typescript
interface Container<T> {
  value: T;
  getValue: () => T;
}
\`\`\`

### Generic Constraints
\`\`\`typescript
interface Lengthwise {
  length: number;
}

function logLength<T extends Lengthwise>(arg: T): T {
  console.log(arg.length);
  return arg;
}
\`\`\`

### Utility Types (Built-in Generics)
- \`Partial<T>\` - Makes all properties optional
- \`Required<T>\` - Makes all properties required
- \`Pick<T, K>\` - Select subset of properties
- \`Omit<T, K>\` - Remove properties
- \`Record<K, T>\` - Create object type

## Practice
Implemented a generic cache utility for the API layer. @Alex Chen reviewed and suggested improvements.

## Questions
- When to use generics vs union types?
- Performance implications of complex generics?

---

**Tags:** #learning #reference
`,
    metadata: {
      wordCount: 167,
      embeddingStatus: "pending" as const,
    },
    tags: ["learning", "reference"],
    mentions: ["Alex Chen"],
  },
  {
    title: "Travel Plans: Japan 2025",
    noteType: "note" as const,
    content: `# Travel Plans: Japan 2025

## Trip Overview
- **When:** April 2025 (cherry blossom season)
- **Duration:** 2 weeks
- **Cities:** Tokyo, Kyoto, Osaka, Hiroshima

## Itinerary Draft

### Tokyo (5 days)
- Shibuya & Harajuku
- Senso-ji Temple
- TeamLab Borderless
- Tsukiji Fish Market
- Day trip to Mt. Fuji

### Kyoto (4 days)
- Fushimi Inari Shrine
- Arashiyama Bamboo Grove
- Kinkaku-ji (Golden Pavilion)
- Gion district
- Traditional ryokan stay

### Osaka (2 days)
- Dotonbori food street
- Osaka Castle
- Day trip to Nara (deer park!)

### Hiroshima (2 days)
- Peace Memorial Park
- Miyajima Island

## Budget Estimate
- Flights: $1,200
- Accommodation: $2,000
- JR Pass: $300
- Food & Activities: $1,500
- **Total:** ~$5,000

## To Research
- [ ] Best neighborhoods to stay in Tokyo
- [ ] JR Pass vs individual tickets
- [ ] Cherry blossom forecast timing
- [ ] Restaurant reservations (need to book months ahead)

## Packing Notes
- Comfortable walking shoes (lots of walking!)
- Layers for variable weather
- Portable wifi or SIM card

---

**Tags:** #travel
`,
    metadata: {
      wordCount: 185,
      embeddingStatus: "pending" as const,
    },
    tags: ["travel"],
    mentions: [],
  },
];
