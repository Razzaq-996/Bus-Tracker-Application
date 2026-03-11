# 🧪 Testing Production-Grade Features

## Quick Test Guide for New Features

This guide helps you test all the newly implemented production-grade tracking features.

---

## 🚀 Setup

### 1. Start the Application

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 2. Open Browser
- Navigate to `http://localhost:5173`
- Open **DevTools Console** (F12) to see detailed logs

---

## ✅ Feature Tests

### **Test 1: Screen Wake Lock API**

**Objective**: Verify screen stays on during tracking

**Steps**:
1. Login as driver (`driver1` / `password123`)
2. Click "Start Trip"
3. Check console for: `🔒 Screen Wake Lock acquired`
4. Look for "🔒 Screen Locked" indicator in header
5. **On Mobile**: Lock phone and verify GPS continues
6. Click "End Trip"
7. Check console for: `🔓 Screen Wake Lock released`

**Expected Result**:
- ✅ Wake lock indicator shows in header
- ✅ GPS tracking continues when screen locks
- ✅ Wake lock releases on trip end

**Console Logs**:
```
🔒 Screen Wake Lock acquired
📍 GPS Update: 28.6139, 77.2090 (±10m)
🔓 Screen Wake Lock released
```

---

### **Test 2: WebSocket Reconnection**

**Objective**: Verify automatic reconnection with exponential backoff

**Steps**:
1. Login as driver and start trip
2. Open DevTools → Network tab
3. Find WebSocket connection
4. Right-click → "Close connection" (simulate network loss)
5. Watch console for reconnection attempts
6. Observe connection status indicator

**Expected Result**:
- ✅ Status changes to "Offline" or "Reconnecting"
- ✅ Reconnection attempts: 1s, 2s, 4s, 8s...
- ✅ Successfully reconnects
- ✅ Offline batch indicator shows queued GPS points

**Console Logs**:
```
🔌 Disconnected: transport close
🔄 Reconnecting in 1s (attempt 1/10)
🔄 Attempting reconnection...
✅ WebSocket connected
📤 Flushing 5 offline GPS points
```

---

### **Test 3: Heartbeat System**

**Objective**: Verify ping/pong keeps connection alive

**Steps**:
1. Login as driver and start trip
2. Watch console for heartbeat messages
3. Wait 30 seconds
4. Verify ping is sent
5. Verify pong is received

**Expected Result**:
- ✅ Ping sent every 30 seconds
- ✅ Pong received within 1 second
- ✅ Connection stays alive

**Console Logs**:
```
💓 Sending heartbeat ping
💓 Heartbeat pong received
💓 Sending heartbeat ping
💓 Heartbeat pong received
```

---

### **Test 4: Offline GPS Batching**

**Objective**: Verify GPS points are stored when offline

**Steps**:
1. Login as driver and start trip
2. Open DevTools → Network tab
3. Set "Offline" mode (or close WebSocket)
4. Wait for 3-4 GPS updates
5. Check console for batch messages
6. Re-enable network
7. Verify batch upload

**Expected Result**:
- ✅ GPS points stored locally
- ✅ Batch counter shows in UI
- ✅ Points uploaded when online
- ✅ Batch cleared after upload

**Console Logs**:
```
📦 Offline: Batching GPS point
📦 Offline: Batching GPS point
📦 Offline: Batching GPS point
✅ WebSocket connected
📤 Flushing 3 offline GPS points
```

**UI Indicator**:
```
[Online] [3 queued] ← Shows in header
```

---

### **Test 5: Emergency SOS**

**Objective**: Verify SOS alerts broadcast to all users

**Steps**:
1. **Driver Tab**: Login as driver, start trip
2. **Student Tab**: Login as student in new tab
3. **Admin Tab**: Login as admin in new tab
4. **Driver Tab**: Click red "🚨 SOS" button
5. Enter message: "Test emergency"
6. Click "Send Emergency Alert"
7. Check all tabs for notifications

**Expected Result**:
- ✅ SOS dialog appears
- ✅ Confirmation required
- ✅ All users receive notification
- ✅ GPS location included
- ✅ Browser notification appears

**Console Logs (Driver)**:
```
🚨 SOS sent: Test emergency
```

**Console Logs (Backend)**:
```
🚨 EMERGENCY SOS from driver 2: Test emergency
✅ SOS broadcasted to all users
```

**Notification Content**:
```
🚨 EMERGENCY ALERT
Driver John Doe (BUS-101) has sent an emergency SOS: Test emergency
```

---

### **Test 6: Adaptive GPS Frequency**

**Objective**: Verify speed detection and frequency recommendations

**Steps**:
1. Login as driver and start trip
2. **Stationary Test**: Stay still
3. Watch console for speed calculation
4. Check for "STATIONARY" message
5. **Moving Test**: Simulate movement (change GPS)
6. Check for "MOVING" message

**Expected Result**:
- ✅ Speed calculated correctly
- ✅ Stationary detected (<0.5 m/s)
- ✅ Moving detected (≥0.5 m/s)
- ✅ Frequency recommendations logged
- ✅ Speed displayed in header (km/h)

**Console Logs**:
```
🚀 Speed: 0.2 m/s (0.7 km/h), Heading: 45°
🔄 Speed changed: STATIONARY (0.20 m/s)
💡 Recommend: Reduce GPS frequency to 30s

🚀 Speed: 5.5 m/s (19.8 km/h), Heading: 90°
🔄 Speed changed: MOVING (5.50 m/s)
💡 Recommend: Increase GPS frequency to 3s
```

**UI Indicator**:
```
🟢 0 km/h  ← Stationary (green)
🔴 20 km/h ← Moving (red)
```

---

### **Test 7: Connection Status Indicators**

**Objective**: Verify all status indicators work

**Steps**:
1. Login as driver and start trip
2. Observe header indicators:
   - Connection status
   - Wake lock status
   - Speed display
   - GPS status

**Expected Result**:
- ✅ All indicators visible
- ✅ Colors match status
- ✅ Tooltips show details
- ✅ Updates in real-time

**Indicators**:
```
[🟢 Online] [🔒 Screen Locked] [🔴 20 km/h] [GPS Active] [🚨 SOS]
```

---

## 🎯 Integration Test

**Full Workflow Test**:

1. **Start Trip**:
   - Login as driver
   - Click "Start Trip"
   - Verify Wake Lock activates
   - Verify GPS tracking starts

2. **Simulate Network Loss**:
   - Disable network
   - Wait for 3 GPS updates
   - Verify offline batching

3. **Reconnect**:
   - Enable network
   - Verify reconnection
   - Verify batch upload

4. **Test SOS**:
   - Click SOS button
   - Send alert
   - Verify broadcast

5. **End Trip**:
   - Click "End Trip"
   - Verify Wake Lock releases
   - Verify GPS stops

**Expected Duration**: 5-10 minutes

---

## 📱 Mobile Testing

### **Android Chrome**:
1. Connect phone to same network
2. Access `http://<your-ip>:5173`
3. Login as driver
4. Start trip
5. Lock phone
6. Verify GPS continues (check backend logs)

### **iOS Safari**:
1. Same as Android
2. Note: Wake Lock support limited on iOS <16.4

---

## 🐛 Troubleshooting

### **Wake Lock Not Working**:
- Check browser support (Chrome 84+)
- Check HTTPS requirement (localhost is OK)
- Check console for errors

### **Reconnection Failing**:
- Check backend is running
- Check network connectivity
- Check max attempts not exceeded

### **SOS Not Broadcasting**:
- Check WebSocket connection
- Check user authentication
- Check backend logs

### **GPS Not Updating**:
- Check location permissions
- Check GPS signal
- Check console for errors

---

## 📊 Performance Benchmarks

**Expected Metrics**:
- Reconnection time: <5 seconds
- SOS broadcast latency: <200ms
- GPS update latency: <100ms
- Offline batch upload: <1 second
- Wake Lock activation: <100ms

---

## ✅ Test Checklist

- [ ] Screen Wake Lock activates/releases
- [ ] WebSocket reconnects automatically
- [ ] Heartbeat ping/pong works
- [ ] Offline batching stores points
- [ ] Offline batch uploads on reconnect
- [ ] SOS broadcasts to all users
- [ ] Speed detection works
- [ ] Adaptive frequency recommendations
- [ ] All status indicators visible
- [ ] Mobile tracking continues when locked

---

## 🎓 Demo Script

**For Presentations**:

1. **Introduction** (30s):
   - "I'll demonstrate production-grade tracking features"

2. **Wake Lock** (1 min):
   - Start trip
   - Show indicator
   - Lock phone
   - Show continued tracking

3. **Reconnection** (1 min):
   - Disconnect network
   - Show reconnection attempts
   - Show batch upload

4. **SOS** (1 min):
   - Click SOS button
   - Send alert
   - Show broadcast to all users

5. **Conclusion** (30s):
   - "These features match industry standards"
   - "Zero data loss, reliable tracking"

**Total Time**: 4 minutes

---

**Last Updated**: 2026-01-17  
**Version**: 1.0.0
