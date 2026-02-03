/**
 * Default Templates for Flint
 * These templates help users get started with structured note-taking
 */

export const defaultTemplates = [
  // ==================== JOURNAL TEMPLATES ====================
  {
    name: 'Daily Reflection',
    noteType: 'journal' as const,
    isDefault: true,
    content: `# Daily Reflection - {{date}}

## Gratitude 🙏
What am I grateful for today?
- 

## Highlights ✨
What were the best moments of my day?
- 

## Challenges 🎯
What challenged me today?
- 

## Stressors 😰
What caused me stress or anxiety?
- 

## Tomorrow's Focus 🌅
What do I want to focus on tomorrow?
- 

---

**Mood:** {{mood}}
**Time:** {{time}}
`,
  },
  {
    name: 'Morning Pages',
    noteType: 'journal' as const,
    isDefault: true,
    content: `# Morning Pages - {{date}}

*Start writing freely. Let your thoughts flow without judgment or editing. This is your space for stream-of-consciousness writing.*

---

{{time}} - 

`,
  },
  {
    name: 'Weekly Review',
    noteType: 'journal' as const,
    isDefault: true,
    content: `# Weekly Review - {{date}}

## 🏆 Wins & Achievements
What went well this week?
- 

## 🚧 Challenges & Obstacles
What didn't go as planned?
- 

## 📚 Lessons Learned
What did I learn?
- 

## 🎯 Next Week's Goals
What do I want to accomplish?
1. 
2. 
3. 

## 💭 Overall Reflection
How am I feeling about this week?


---

**Mood:** {{mood}}
`,
  },
  {
    name: 'Evening Wind Down',
    noteType: 'journal' as const,
    isDefault: true,
    content: `# Evening Wind Down - {{date}}

## Today's Accomplishments ✅
What did I complete today?
- 

## Energy Level 🔋
How's my energy? (1-10): 

## Social Connections 👥
Who did I connect with today?
- 

## Self-Care 💚
What did I do for myself today?
- 

## Tomorrow's Priorities 📝
Top 3 things for tomorrow:
1. 
2. 
3. 

---

**Mood:** {{mood}}
**Time:** {{time}}
`,
  },

  // ==================== KNOWLEDGE NOTE TEMPLATES ====================
  {
    name: 'Literature Note',
    noteType: 'note' as const,
    isDefault: true,
    content: `# Literature Note: [Title]

## Source Information
- **Author:** 
- **Source:** {{source}}
- **Date:** {{date}}
- **Type:** [Article/Book/Video/Podcast]

## Key Takeaways 💡
What are the main ideas?
1. 
2. 
3. 

## Important Quotes 💬
> 

> 

## My Thoughts & Reflections 🤔


## Connections to Other Ideas 🔗
How does this relate to what I already know?
- 

## Action Items ✅
What will I do with this information?
- 

---

**Tags:** #
`,
  },
  {
    name: 'Meeting Notes',
    noteType: 'note' as const,
    isDefault: true,
    content: `# Meeting Notes - {{date}}

## Meeting Details
- **Date:** {{date}}
- **Time:** {{time}}
- **Attendees:** @

## Agenda 📋
1. 
2. 
3. 

## Discussion Points 💬


## Decisions Made ✅
- 

## Action Items 📝
- [ ] Task - @person - Due: 
- [ ] Task - @person - Due: 

## Follow-up 🔄
- 

---

**Tags:** #meeting
`,
  },
  {
    name: 'Idea Capture',
    noteType: 'note' as const,
    isDefault: true,
    content: `# Idea: [Title]

**Created:** {{date}} at {{time}}

## The Problem 🤔
What problem does this solve?


## The Solution 💡
What's the core idea?


## Why This Matters 🎯
Why is this important or interesting?


## Potential Approaches 🛠️
How could this be implemented?
1. 
2. 
3. 

## Next Steps 📝
What should I do next?
- [ ] 
- [ ] 

## Related Ideas 🔗
What other concepts connect to this?
- 

---

**Tags:** #idea
`,
  },
  {
    name: 'Learning Note',
    noteType: 'note' as const,
    isDefault: true,
    content: `# Learning: [Topic]

**Date:** {{date}}
**Source:** {{source}}

## Concept Overview 📖
What am I learning?


## Key Points 🔑
1. 
2. 
3. 

## Examples 💡


## Connections 🔗
How does this relate to what I already know?
- 

## Practice & Application 🎯
How can I use this?
- 

## Questions & Confusions ❓
What do I still need to understand?
- 

---

**Tags:** #learning
`,
  },
  {
    name: 'Research Note',
    noteType: 'note' as const,
    isDefault: true,
    content: `# Research: [Topic]

**Date:** {{date}}
**Research Question:** 

## Background Context 📚


## Sources 📖
1. {{source}}
2. 

## Findings & Data 📊


## Key Insights 💡
- 

## Contradictions & Gaps 🤔
What's unclear or conflicting?
- 

## Synthesis 🔗
What patterns or conclusions emerge?


## Next Research Steps 🔍
- [ ] 
- [ ] 

---

**Tags:** #research
`,
  },
  {
    name: 'Project Planning',
    noteType: 'note' as const,
    isDefault: true,
    content: `# Project: [Name]

**Created:** {{date}}
**Status:** Planning

## Project Overview 🎯
What are we building?


## Goals & Success Criteria ✅
What does success look like?
1. 
2. 
3. 

## Key Stakeholders 👥
@

## Timeline 📅
- **Start Date:** 
- **Milestones:** 
  - [ ] Milestone 1 - Date
  - [ ] Milestone 2 - Date
- **Target Completion:** 

## Resources Needed 🛠️
- 

## Risks & Challenges ⚠️
- 

## Next Actions 📝
- [ ] 
- [ ] 

---

**Tags:** #project
`,
  },
];

/**
 * Helper function to process template variables
 */
export function fillTemplateVariables(
  template: string,
  variables: {
    date?: string;
    time?: string;
    mood?: number;
    source?: string;
  } = {}
): string {
  const now = new Date();
  
  // Default values
  const date = variables.date || now.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const time = variables.time || now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const mood = variables.mood !== undefined ? variables.mood.toString() : '';
  const source = variables.source || '';

  // Replace all template variables
  return template
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time)
    .replace(/\{\{mood\}\}/g, mood)
    .replace(/\{\{source\}\}/g, source);
}
