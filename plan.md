# Agent Status System Fix - Minimal Implementation Plan

**Branch**: `fix/agent-status-timeout-and-source-tracking`

**Issue**: https://github.com/simonaszilinskas/lizdeika/issues/28

---

## Problem Statement

### Current Issues
1. **120-minute timeout is absurdly long** - Agents appear online for 2 hours after closing browser
2. **Settings page marks agents as working** - Opening settings forces agent status to "online"
3. **No differentiation between connection and activity** - All heartbeats treated equally

### User Requirements
- Agents should NOT be marked offline when switching to another tab to research answers
- Agents should NOT stay online for 2 hours after disconnecting
- Settings page should NOT mark agents as actively working

---

## Solution: Minimal Changes Only

### Core Strategy

**Keep it simple**: Use existing `online`/`offline` statuses. Add heartbeat source tracking to differentiate dashboard activity from settings page presence.

**Key Insight**:
- **Dashboard heartbeat** = "I'm actively working on conversations" → Update agent status
- **Settings heartbeat** = "My browser is open but I'm just browsing settings" → Keep socket alive only

This naturally solves the problem:
- Agent on dashboard → marked online ✅
- Agent switches to settings → stays online (settings heartbeats don't claim active work) ✅
- Agent switches to Google to research → still online (dashboard keeps sending heartbeats for ~5min) ✅
- Agent closes browser → offline after 5 minutes ✅

---

## Implementation Plan

### Step 1: Reduce Timeout (CRITICAL - 1 line change)

**File**: `custom-widget/backend/src/services/agentService.js`

**Line 645**: Change from 120 minutes to 5 minutes

```javascript
// BEFORE
async findActiveAgents(statusFilter = ['online', 'busy'], minutesAgo = 120) {

// AFTER
async findActiveAgents(statusFilter = ['online', 'busy'], minutesAgo = 5) {
```

**Impact**: Agents marked offline after 5 minutes of no heartbeat instead of 2 hours

**Reasoning**: 5 minutes gives reasonable grace period for:
- Switching between tabs
- Brief network interruptions
- Page reloads
- But quickly detects truly disconnected agents

---

### Step 2: Add Heartbeat Source Tracking

#### 2a. Backend: Check Source Before Updating Status

**File**: `custom-widget/backend/src/services/websocketService.js`

**Lines 218-233**: Modify heartbeat handler

```javascript
// BEFORE
socket.on('heartbeat', async (data) => {
    if (socket.agentId) {
        try {
            // Update agent status timestamp to keep them "online"
            await agentService.updateAgentActivity(socket.agentId);

            // Send heartbeat acknowledgment
            socket.emit('heartbeat-ack', {
                timestamp: new Date(),
                agentId: socket.agentId
            });
        } catch (error) {
            console.error('Error handling heartbeat for agent', socket.agentId, ':', error);
        }
    }
});

// AFTER
socket.on('heartbeat', async (data) => {
    if (socket.agentId) {
        try {
            const source = data.source || 'unknown';

            // Only update agent status if heartbeat is from dashboard
            // Settings heartbeats just keep socket alive
            if (source === 'dashboard') {
                await agentService.updateAgentActivity(socket.agentId);
                console.log(`💓 Dashboard heartbeat from ${socket.agentId} - updating status`);
            } else if (source === 'settings') {
                console.log(`💓 Settings heartbeat from ${socket.agentId} - socket keepalive only`);
            }

            // Always send acknowledgment
            socket.emit('heartbeat-ack', {
                timestamp: new Date(),
                agentId: socket.agentId
            });
        } catch (error) {
            console.error('Error handling heartbeat for agent', socket.agentId, ':', error);
        }
    }
});
```

#### 2b. Frontend (Dashboard): Send Source in Heartbeat

**File**: `custom-widget/js/agent-dashboard/core/SocketManager.js`

**Lines 167-170**: Add source field

```javascript
// BEFORE
this.socket.emit(WEBSOCKET_EVENTS.HEARTBEAT, {
    timestamp: Date.now(),
    agentId: this.agentId
});

// AFTER
this.socket.emit(WEBSOCKET_EVENTS.HEARTBEAT, {
    timestamp: Date.now(),
    agentId: this.agentId,
    source: 'dashboard'
});
```

#### 2c. Frontend (Settings): Send Source in Heartbeat

**File**: `custom-widget/js/settings/core/ConnectionManager.js`

**Lines 264-268**: Add source field

```javascript
// BEFORE
this.socket.emit('heartbeat', {
    timestamp: Date.now(),
    userId: currentUser.id,
    source: 'settings'
});

// AFTER
this.socket.emit('heartbeat', {
    timestamp: Date.now(),
    userId: currentUser.id,
    source: 'settings'  // Already has this! Just verify it's there
});
```

**Note**: Settings already sends `source: 'settings'` on line 267! Just need to verify.

---

### Step 3: Optional - Settings Page Join Behavior

**File**: `custom-widget/backend/src/services/websocketService.js`

**Lines 128-156**: Optionally prevent settings from calling `setAgentOnline()`

This is **optional** because heartbeat source tracking already solves the main issue. But for cleanliness:

```javascript
socket.on('join-agent-dashboard', async (agentId, options = {}) => {
    const source = options?.source || 'dashboard';

    socket.join('agents');
    socket.join('settings');
    socket.agentId = agentId;

    // Only mark as online if joining from dashboard
    // Settings page just observes, doesn't claim active status
    if (source === 'dashboard') {
        await agentService.setAgentOnline(agentId, socket.id);
        console.log(`✅ Agent ${agentId} connected from dashboard - marked ONLINE`);
    } else {
        console.log(`📋 Agent ${agentId} connected from ${source} - socket joined only`);
    }

    // Rest of handler unchanged...
});
```

And update settings frontend to pass source:

**File**: `custom-widget/js/settings/core/ConnectionManager.js`

**Line 177**: Add options parameter

```javascript
// BEFORE
this.socket.emit('join-agent-dashboard', currentUser.id);

// AFTER
this.socket.emit('join-agent-dashboard', currentUser.id, { source: 'settings' });
```

---

## Expected Behavior After Changes

### Scenario 1: Agent Working Normally
1. Agent opens dashboard → `join-agent-dashboard` → marked **online** ✅
2. Dashboard sends heartbeat every 15s with `source: 'dashboard'` → status updated ✅
3. Agent actively receives and handles conversations ✅

### Scenario 2: Agent Researches in Another Tab
1. Agent has dashboard open (sending heartbeats) → **online** ✅
2. Agent switches to Google in another tab → dashboard still in background ✅
3. Dashboard continues sending heartbeats for ~5 minutes → still **online** ✅
4. Agent returns to dashboard within 5 minutes → seamless, still **online** ✅

### Scenario 3: Agent Opens Settings Page
1. Agent has dashboard open → **online** from dashboard heartbeats ✅
2. Agent opens settings page in new tab → settings sends heartbeats with `source: 'settings'` ✅
3. Settings heartbeats do NOT update agent status → agent stays at current status ✅
4. Agent closes dashboard → no more dashboard heartbeats → offline after 5 min ✅

### Scenario 4: Agent Closes Browser
1. Agent closes all tabs → no more heartbeats (any source) ✅
2. After 5 minutes → marked **offline** ✅
3. UI reflects accurate status ✅

### Scenario 5: Agent Only Has Settings Open
1. Agent opens ONLY settings page (no dashboard) → joins socket with `source: 'settings'` ✅
2. Settings heartbeats keep socket alive but don't claim "working" ✅
3. Agent appears as whatever their previous status was (likely offline) ✅
4. This is correct: settings page != actively handling conversations ✅

---

## Testing Plan

### Manual Testing Checklist

- [ ] **Test 1**: Open dashboard → verify shown as online
- [ ] **Test 2**: Close dashboard → verify offline within 5 minutes
- [ ] **Test 3**: Open dashboard + settings in separate tabs → verify online
- [ ] **Test 4**: Close dashboard, keep settings → verify offline within 5 minutes
- [ ] **Test 5**: Open dashboard, switch to Google tab, return within 5 min → verify stays online
- [ ] **Test 6**: Open dashboard, leave in background for >5 min → verify goes offline
- [ ] **Test 7**: Multiple agents - verify each tracked independently

### Unit Tests to Update

**File**: `custom-widget/backend/tests/unit/websocketService.test.js`

Add tests for:
- Heartbeat with `source: 'dashboard'` updates agent status
- Heartbeat with `source: 'settings'` does NOT update agent status
- Heartbeat with no source (backward compatibility) updates agent status

**File**: `custom-widget/backend/tests/unit/agentService.test.js`

Update tests that rely on 120-minute timeout:
- Update to expect 5-minute timeout
- Verify `findActiveAgents()` uses new threshold

---

## Files Modified Summary

| File | Lines Changed | Change Type | Risk Level |
|------|--------------|-------------|------------|
| `agentService.js` | 1 line | Change constant | 🟢 Low |
| `websocketService.js` | ~15 lines | Add source check | 🟡 Medium |
| `SocketManager.js` (dashboard) | 1 line | Add field | 🟢 Low |
| `ConnectionManager.js` (settings) | 1 line | Verify field exists | 🟢 Low |
| `websocketService.test.js` | ~20 lines | Add tests | 🟢 Low |
| `agentService.test.js` | ~5 lines | Update assertions | 🟢 Low |

**Total**: ~43 lines changed across 6 files

---

## Rollback Plan

If issues arise:

1. **Immediate**: Change timeout back to 120 minutes (1 line revert)
2. **Full rollback**: Revert entire branch via git
3. **No database changes**: No migrations required, fully reversible

---

## Success Criteria

✅ Agents no longer stay "online" for 2 hours after disconnect
✅ Settings page presence doesn't mark agent as actively working
✅ Agents can research on other tabs without being marked offline
✅ Truly disconnected agents detected within 5 minutes
✅ All existing tests pass
✅ Manual testing scenarios pass

---

## Timeline

1. **Branch creation**: 2 minutes
2. **Code changes**: 20 minutes
3. **Testing**: 30 minutes
4. **PR review**: Variable
5. **Deployment**: Standard process

**Total development time**: ~1 hour

---

## Notes

- **Backward compatibility**: Heartbeats without `source` field default to updating status (safe)
- **No database changes**: Uses existing schema and enums
- **No new dependencies**: Pure logic changes
- **Minimal risk**: Small, focused changes with clear rollback path

---

*Plan created: 2025-10-06*
*Issue reference: https://github.com/simonaszilinskas/lizdeika/issues/28*
