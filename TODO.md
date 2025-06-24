# TODO - Bugs & Features

## 🐛 Known Bugs

### Critical
- [ ] **Data disappears on server restart** - Everything is in memory
- [ ] **No cleanup** - Old conversations stay forever, will crash eventually
- [ ] **Flowise errors crash the widget** - No error handling

### Annoying
- [ ] **Polling is wasteful** - Checks every 2 seconds even if nothing changed
- [ ] **Widget CSS conflicts** - Breaks on some websites
- [ ] **No loading indicators** - User doesn't know if message is sending
- [ ] **Can't see if agent is typing** - Customer just waits
- [ ] **Timestamps wrong timezone** - Shows server time not local

### Minor
- [ ] **No keyboard shortcuts** - Can't press Enter to send
- [ ] **Widget position fixed** - Can't move it around
- [ ] **No sound notifications** - Easy to miss new messages
- [ ] **Links don't open in new tab** - Annoying for customers

## ✨ Features to Build

### Week 1 - Foundation
- [ ] **Add SQLite database** - Stop losing data
- [ ] **Agent login system** - Know who sent what
- [ ] **WebSocket real-time** - Instant messages

### Week 2 - Better UX
- [ ] **File uploads** - Screenshots are crucial
- [ ] **Typing indicators** - "Agent is typing..."
- [ ] **Read receipts** - Seen at 10:43
- [ ] **Email/name collection** - Know who we're talking to

### Week 3 - Agent Tools
- [ ] **Canned responses** - Quick replies for FAQ
- [ ] **Search conversations** - Find that chat from yesterday
- [ ] **Transfer chat** - Pass to another agent
- [ ] **Notes on conversations** - Internal comments

### Month 2 - Scale Up
- [ ] **Multiple widget styles** - Dark mode, compact, etc
- [ ] **Analytics dashboard** - Response times, satisfaction
- [ ] **Export conversations** - CSV download
- [ ] **API for integration** - Connect to other tools

### Someday Maybe
- [ ] **Voice messages**
- [ ] **Video chat**
- [ ] **Multi-language UI**
- [ ] **Mobile app**
- [ ] **Chatbot builder**

## 🔧 Quick Improvements

These take < 1 hour each:
1. Add Enter key to send message
2. Add connection error messages
3. Add "New message" sound
4. Save agent's draft message
5. Show character count in input
6. Add emoji picker
7. Highlight mentions @agent
8. Auto-link URLs
9. Show "online/offline" status
10. Add copy button to messages

## 📝 Notes

**Priority order:**
1. Fix data loss (add database)
2. Add real-time updates
3. Improve agent tools
4. Then add fancy features

**Remember:**
- Test on real websites, not just demo page
- Keep mobile in mind
- Make it work offline-ish
- Don't break existing chats when updating