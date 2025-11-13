# Custom Pull-to-Refresh Component

**Date:** November 13, 2025  
**Status:** ✅ Implemented

---

## Overview

A minimal, modern custom pull-to-refresh UI that replaces the native browser gesture (which causes viewport height jumps). Built with immediate visual feedback and smooth animations.

---

## Why Custom Implementation?

### Native Pull-to-Refresh Issue
The native browser pull-to-refresh causes **unavoidable height jumps** after reload:
- Mobile browsers avoid layout updates during scroll (performance)
- After refresh completes, viewport recalculates → height jump
- This is expected behavior—updating at 60fps "looks like shit"

### Solution
Disable native gesture with `overscroll-behavior-y: contain` and provide custom UI that:
- ✅ Maintains layout state during refresh
- ✅ Provides smooth, controlled animations
- ✅ Shows clear visual feedback
- ✅ Follows 2025 PWA best practices

---

## Component Features

### Visual States
1. **Idle** - Hidden, no interaction
2. **Pulling** - Shows indicator as user drags down
3. **Ready** - Arrow flips, text changes to "Release to refresh"
4. **Refreshing** - Spinner animation, "Refreshing..." text

### Key Behaviors
- **Immediate feedback** - Indicator appears instantly on drag
- **Smooth resistance** - Pulls get harder as you go further (2.5x resistance)
- **Visual threshold** - Clear indication when ready to refresh (80px default)
- **Automatic snap-back** - Returns smoothly if released before threshold
- **Content follows** - Main content shifts down during pull

---

## Usage

### Basic Implementation

```tsx
import { PullToRefresh } from '../components/ui/PullToRefresh'

function MyPage() {
  const handleRefresh = async () => {
    // Reload data or refresh page
    await fetchData()
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="content">
        {/* Your content here */}
      </div>
    </PullToRefresh>
  )
}
```

### Props

```typescript
interface PullToRefreshProps {
  onRefresh: () => Promise<void>  // Async refresh handler
  children: ReactNode             // Content to wrap
  disabled?: boolean              // Disable pull-to-refresh
  threshold?: number              // Trigger threshold (default: 80px)
  maxPull?: number                // Max pull distance (default: 120px)
}
```

### Configuration

```tsx
<PullToRefresh
  onRefresh={handleRefresh}
  threshold={60}      // Easier to trigger
  maxPull={100}       // Shorter max pull
  disabled={false}    // Enable/disable
>
  {children}
</PullToRefresh>
```

---

## Implementation Details

### Touch Event Handling

```typescript
// Only activate when scrolled to top
const isAtTop = scrollable.scrollTop === 0
if (!isAtTop) return

// Calculate drag distance with resistance
const resistance = 2.5
const distance = Math.min(diff / resistance, maxPull)
```

### Resistance Formula
As you pull further, it gets harder to pull more:
```
actualDistance = dragDistance / resistance
```
This creates a natural, elastic feel.

### State Transitions
```
idle → pulling (drag starts, distance < threshold)
pulling → ready (distance >= threshold)
ready → refreshing (released past threshold)
refreshing → idle (refresh complete)
```

### Visual Feedback

**Opacity:**
```typescript
const progress = Math.min(pullDistance / threshold, 1)
const indicatorOpacity = Math.min(progress * 1.5, 1)
```

**Scale:**
```typescript
const indicatorScale = 0.5 + progress * 0.5  // 50% → 100%
```

**Arrow Rotation:**
```typescript
transform: state === 'ready' ? 'rotate(180deg)' : 'rotate(0deg)'
```

---

## Integration Points

### MainLayout
```tsx
// src/components/layout/MainLayout.tsx
<PullToRefresh onRefresh={handleRefresh}>
  <main>
    <Outlet />
  </main>
</PullToRefresh>
```

### LoginPage
```tsx
// src/pages/LoginPage.tsx
<PullToRefresh onRefresh={handleRefresh}>
  <div className="login-content">
    {/* Login form */}
  </div>
</PullToRefresh>
```

### Custom Pages
Any page can wrap content in `<PullToRefresh>` for refresh functionality.

---

## CSS Requirements

### Disable Native Pull-to-Refresh
```css
/* src/styles/index.css */
html {
  overscroll-behavior-y: contain;
}

body {
  overscroll-behavior-y: contain;
}
```

### Border Width Utility
```css
.border-3 {
  border-width: 3px;
}
```

### Spinner Animation
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## Design Tokens Used

```css
--color-primary: #E2C33D;          /* Spinner border, icon background */
--text-on-primary: #000000;        /* Icon color */
--color-neutral-200: #D1D5DB;      /* Spinner track */
--text-secondary: #374151;         /* Status text */
```

---

## Performance Considerations

### Passive Event Listeners
```typescript
touchstart: { passive: true }   // No preventDefault
touchmove: { passive: false }   // Allow preventDefault when needed
touchend: { passive: true }     // No preventDefault
```

### Transition Optimization
- **During drag:** No transitions (instant response)
- **On release:** Smooth transitions (0.3s ease-out)

```typescript
transition: state === 'idle' 
  ? 'transform 0.3s ease-out' 
  : 'none'
```

### Rendering Optimization
- Only renders indicator when pulling
- Opacity/scale calculated from pull distance
- No unnecessary re-renders

---

## Accessibility

### Touch Target
- Entire top area responsive (full width)
- Minimum 80px pull threshold (comfortable drag)

### Visual Feedback
- ✅ Clear state indicators (text + icon)
- ✅ Color contrast meets WCAG standards
- ✅ Smooth animations (unless prefers-reduced-motion)

### States Communicated
- **Idle:** No visual indicator
- **Pulling:** Icon visible, "Pull to refresh"
- **Ready:** Icon rotated, "Release to refresh"
- **Refreshing:** Spinner, "Refreshing..."

---

## Browser Compatibility

### Supported
- ✅ iOS Safari 11+ (touch events)
- ✅ Chrome Android 85+ (touch events)
- ✅ Samsung Internet 14+
- ✅ Firefox Mobile 100+

### Fallback
- Desktop browsers: Component renders but doesn't activate (no touch)
- Old browsers: Content still scrollable, just no pull-to-refresh

---

## Testing Checklist

### Functional Tests
- [x] Pull from top triggers refresh
- [x] Pull from middle does nothing
- [x] Release before threshold snaps back
- [x] Release after threshold triggers refresh
- [x] Multiple quick pulls handled correctly
- [x] Refresh completes and resets state

### Visual Tests
- [x] Indicator appears smoothly
- [x] Arrow rotates at threshold
- [x] Spinner animates during refresh
- [x] Content shifts down while pulling
- [x] Snap-back animation smooth
- [x] Text changes correctly

### Edge Cases
- [x] Disabled prop works
- [x] Custom threshold works
- [x] Custom maxPull works
- [x] Fast swipes handled
- [x] Slow drags handled
- [x] Touch interrupted (call/notification)

---

## Customization Guide

### Change Threshold
```tsx
<PullToRefresh threshold={60}> {/* Easier to trigger */}
```

### Change Max Pull Distance
```tsx
<PullToRefresh maxPull={100}> {/* Shorter pull */}
```

### Change Resistance
Edit component:
```typescript
const resistance = 3.0  // Harder to pull (default: 2.5)
```

### Change Indicator Style
Edit `PullToRefresh.tsx`:
```tsx
// Change spinner colors
borderColor: 'var(--color-primary)'
borderTopColor: 'var(--color-secondary)'

// Change icon background
backgroundColor: 'var(--color-secondary)'
```

### Change Animation Speed
```tsx
transition: state === 'idle' 
  ? 'transform 0.5s ease-out'  // Slower snap-back
  : 'none'
```

---

## Future Enhancements

### Haptic Feedback (iOS)
```typescript
if (state === 'ready') {
  // Trigger haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate(10)
  }
}
```

### Custom Refresh Logic
```typescript
const handleRefresh = async () => {
  // Instead of page reload, refresh data
  await refetchQuery()
  await invalidateCache()
}
```

### Progress Indicator
Show actual progress instead of just spinner:
```tsx
<div className="progress-bar" style={{ width: `${progress * 100}%` }} />
```

---

## Comparison: Native vs Custom

| Feature | Native | Custom |
|---------|--------|--------|
| Height jumps | ❌ Yes | ✅ No |
| Visual feedback | ⚠️ Minimal | ✅ Clear states |
| Customizable | ❌ No | ✅ Fully |
| Animation control | ❌ Browser-dependent | ✅ Smooth, controlled |
| Performance | ✅ Native | ✅ Optimized |
| PWA compatibility | ⚠️ iOS standalone disables | ✅ Works everywhere |

---

## Summary

### What Was Built
- ✅ Minimal, modern pull-to-refresh component
- ✅ Three clear states with smooth transitions
- ✅ Immediate visual feedback
- ✅ Resistance-based drag feel
- ✅ Integrated in MainLayout and LoginPage

### Key Benefits
- **No height jumps** - Maintains layout during refresh
- **Better UX** - Clear feedback at every stage
- **Full control** - Customizable thresholds and animations
- **PWA-ready** - Works with native gestures disabled

### Best Practices Applied
- Passive event listeners for performance
- Smooth 60fps animations
- Proper touch handling
- Resistance for natural feel
- WCAG-compliant visuals

---

**Status:** Production-ready and deployed to https://bill.finetune.store ✅


