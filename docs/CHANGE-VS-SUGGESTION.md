# Change vs Suggestion: Detailed Comparison

## Overview

`Change` and `Suggestion` are two distinct domain entities in the Awareness module that represent different stages and perspectives of code modifications. Understanding their differences is crucial for understanding the architecture.

---

## 1. **Purpose & Domain Concept**

### Change
- **Represents**: A raw text document modification event
- **Domain Concept**: "Something changed in the document"
- **Scope**: All changes (AI, user, formatter, unknown)
- **Lifecycle**: Short-lived, used for classification and immediate processing
- **When Created**: Immediately when VS Code fires a `TextDocumentChangeEvent`

### Suggestion
- **Represents**: An AI-generated code suggestion that needs review
- **Domain Concept**: "AI wrote code that the user should review"
- **Scope**: Only AI-generated changes that become "suggestions"
- **Lifecycle**: Long-lived, tracked until resolved (accepted/rejected/adapted)
- **When Created**: Only after a `Change` is classified as AI-generated

---

## 2. **Data Model Differences**

### Change Entity

```javascript
{
    id: string,                    // Unique change ID
    documentUri: string,           // Document where change occurred
    range: Range,                  // Text range (start/end positions)
    text: string,                  // Inserted text
    rangeLength: number,           // Deleted text length
    timestamp: number,             // When change occurred
    
    // Classification state
    classification: {              // Classification result
        label: 'ai'|'user'|'formatter'|'unknown',
        confidence: number,        // 0-1
        reasons: string[]
    },
    classifiedAt: number,         // When classified
    source: string,                // 'ai', 'user', 'formatter', 'unknown'
    
    // Calculated properties
    size: number,                  // Inserted size (text.length)
    deletedSize: number,           // Deleted size (rangeLength)
    netSize: number,               // size - deletedSize
    
    // Metadata
    batchId: string                // If part of a batch
}
```

### Suggestion Entity

```javascript
{
    id: string,                    // Unique suggestion ID
    document: string,              // Document URI
    range: Range,                  // Text range
    text: string,                  // Suggested text content
    size: number,                  // Size in characters
    timestamp: number,             // When suggestion was created
    
    // Lifecycle state
    reviewed: boolean,             // Has user reviewed it?
    reviewTime: number,            // Time spent reviewing (ms)
    reviewStarted: number,         // When review started
    
    status: string,                // 'pending' | 'accepted' | 'rejected' | 'adapted'
    statusTimestamp: number,       // When status changed
    
    // User interaction tracking
    userEdited: boolean,           // Did user edit this?
    editCount: number,             // How many times edited
    
    // Metadata
    isFileCreation: boolean,       // Is this a new file?
    isExternalCreation: boolean,  // Created externally?
    isFileWrite: boolean          // Is this a file write?
}
```

---

## 3. **Key Differences**

### A. **Scope & Filtering**

| Aspect | Change | Suggestion |
|--------|--------|------------|
| **All Changes** | ✅ Yes - tracks ALL changes | ❌ No - only AI-generated |
| **User Changes** | ✅ Yes | ❌ No |
| **Formatter Changes** | ✅ Yes | ❌ No |
| **Unknown Changes** | ✅ Yes | ❌ No |
| **AI Changes** | ✅ Yes | ✅ Yes (only these become suggestions) |

### B. **Lifecycle & Persistence**

| Aspect | Change | Suggestion |
|--------|--------|------------|
| **Lifespan** | Short-lived (seconds/minutes) | Long-lived (hours/days) |
| **Persistence** | Not persisted | Persisted in aggregate |
| **Eviction** | Immediate after processing | Evicted when aggregate full (5000 max) |
| **Tracking** | Tracked during classification | Tracked until resolved |

### C. **Classification vs Review State**

| Aspect | Change | Suggestion |
|--------|--------|------------|
| **Primary State** | Classification (ai/user/formatter/unknown) | Review status (pending/accepted/rejected/adapted) |
| **Confidence** | Has classification confidence (0-1) | No confidence (already classified as AI) |
| **Reasons** | Has classification reasons | No reasons (assumed AI) |
| **Review Tracking** | No review tracking | Full review lifecycle tracking |

### D. **Properties & Behavior**

| Property | Change | Suggestion |
|----------|--------|------------|
| **rangeLength** | ✅ Tracks deleted text | ❌ No (only tracks inserted text) |
| **deletedSize** | ✅ Calculated | ❌ No |
| **netSize** | ✅ Calculated (inserted - deleted) | ❌ No |
| **reviewed** | ❌ No | ✅ Yes |
| **reviewTime** | ❌ No | ✅ Yes |
| **status** | ❌ No | ✅ Yes (pending/accepted/rejected/adapted) |
| **userEdited** | ❌ No | ✅ Yes |
| **editCount** | ❌ No | ✅ Yes |
| **batchId** | ✅ Yes | ❌ No (but has batch tracking in aggregate) |

---

## 4. **Transformation Flow**

### How Changes Become Suggestions

```
VS Code TextDocumentChangeEvent
    ↓
ChangeService.classifyEvent()
    ↓
ChangeClassifier (domain utility)
    ↓
Change entities created (raw changes)
    ↓
Change.classify() - classified as 'ai', 'user', 'formatter', or 'unknown'
    ↓
[IF classification.label === 'ai']
    ↓
SuggestionService.recordAISuggestionBatch()
    ↓
SuggestionAggregate.createSuggestion()
    ↓
Suggestion entity created
    ↓
Suggestion tracked in aggregate (long-term)
```

### Example Flow

1. **User types code** → `Change` created → Classified as `'user'` → **No Suggestion created**
2. **AI generates code** → `Change` created → Classified as `'ai'` → **Suggestion created**
3. **Formatter runs** → `Change` created → Classified as `'formatter'` → **No Suggestion created**

---

## 5. **Use Cases**

### Change Entity Use Cases

1. **Classification**: Determine if change is AI, user, formatter, or unknown
2. **Immediate Processing**: Process change immediately (e.g., record in ledger)
3. **Batch Analysis**: Analyze batches of changes for patterns
4. **DIFF Bullet Generation**: Generate diff bullets for change tracking
5. **Temporary Tracking**: Track changes during debounce window

### Suggestion Entity Use Cases

1. **Review Tracking**: Track which AI suggestions need user review
2. **Status Management**: Track if suggestion was accepted/rejected/adapted
3. **User Interaction**: Track if user edited the suggestion
4. **Score Calculation**: Calculate awareness score based on pending suggestions
5. **Debt Management**: Track unreviewed AI code as "debt"
6. **UI Display**: Show pending suggestions to user
7. **Long-term Tracking**: Track suggestions until resolved

---

## 6. **Behavioral Differences**

### Change Entity Methods

```javascript
// Classification methods
change.classify(classification)
change.isClassified()
change.isAI()
change.isUser()
change.isFormatter()
change.isUnknown()
change.getConfidence()
change.getReasons()

// Change type methods
change.isPureInsertion()
change.isPureDeletion()
change.isReplacement()
change.isMultiLine()
change.getLineSpan()
```

**Focus**: Classification and change characteristics

### Suggestion Entity Methods

```javascript
// Review lifecycle methods
suggestion.markAsReviewed(reviewTime, reviewStarted)
suggestion.recordUserEdit()
suggestion.updateStatus(status)

// Status query methods
suggestion.isPending()
suggestion.isResolved()
suggestion.getAge()
suggestion.isForDocument(documentUri)
```

**Focus**: Review lifecycle and user interaction

---

## 7. **Storage & Aggregation**

### Change
- **Storage**: Not stored in aggregate
- **Collection**: Temporary during classification
- **Eviction**: Immediately after classification callback
- **Aggregation**: Batched during debounce window (200ms)

### Suggestion
- **Storage**: Stored in `SuggestionAggregate`
- **Collection**: `suggestionsById` Map (up to 5000)
- **Eviction**: LRU-style eviction when threshold reached (90% = 4500)
- **Indexing**: Per-document index (`pendingByDocUri`) for O(1) lookup
- **Batch Tracking**: Tracks batches via `batchesById` and `suggestionsToBatch`

---

## 8. **When to Use Which**

### Use Change When:
- ✅ You need to classify a text modification
- ✅ You need to know if change is AI, user, formatter, or unknown
- ✅ You need change characteristics (insertion, deletion, replacement)
- ✅ You're processing changes immediately
- ✅ You need classification confidence and reasons
- ✅ You're generating DIFF bullets or change ledger entries

### Use Suggestion When:
- ✅ You need to track AI-generated code for review
- ✅ You need to know review status (pending/accepted/rejected/adapted)
- ✅ You need to track user interaction (reviewed, edited)
- ✅ You're calculating awareness score
- ✅ You're managing review debt
- ✅ You're displaying pending suggestions to user
- ✅ You need long-term tracking of AI suggestions

---

## 9. **Relationship**

### One-to-Many Relationship

```
1 Change (classified as 'ai')
    ↓
    Can become
    ↓
1 Suggestion (if AI change is significant enough)
```

**Important Notes:**
- Not all AI `Change` entities become `Suggestion` entities
- Small AI changes might be aggregated into a single `Suggestion`
- Multiple `Change` entities can be batched into one `Suggestion`
- `Suggestion` entities are created from `Change` entities, but they have separate identities

### Example Scenario

**AI makes 10 small changes in 200ms:**
- **10 Change entities** created (one per VS Code change event)
- All classified as `'ai'`
- **1 Suggestion entity** created (batched together)
- The 10 `Change` entities are discarded after classification
- The 1 `Suggestion` entity is stored in aggregate for tracking

---

## 10. **Summary Table**

| Aspect | Change | Suggestion |
|--------|--------|------------|
| **Represents** | Any text modification | AI-generated code needing review |
| **Scope** | All changes (AI, user, formatter, unknown) | Only AI-generated changes |
| **Lifecycle** | Short-lived (seconds) | Long-lived (hours/days) |
| **Primary State** | Classification | Review status |
| **Persistence** | Not persisted | Persisted in aggregate |
| **Tracking** | During classification | Until resolved |
| **Focus** | "What changed?" | "What needs review?" |
| **Created From** | VS Code events | AI-classified Changes |
| **Used For** | Classification, immediate processing | Review tracking, debt management |

---

## Conclusion

**Change** and **Suggestion** serve complementary but distinct roles:

- **Change** = "Something happened" (classification phase)
- **Suggestion** = "AI wrote code, user should review it" (review phase)

The transformation from `Change` to `Suggestion` represents the transition from "detection" to "tracking" - from identifying that AI generated code to managing the review lifecycle of that code.
