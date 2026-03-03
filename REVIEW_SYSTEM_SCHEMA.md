# Order-Based Review System - Firestore Schema

## Collections Structure

### 1. `orders` (Top-level collection)
Tracks all customer orders for review eligibility.

```javascript
orders/{orderId}
{
  // Order identification
  id: string,                    // Auto-generated
  vendorId: string,              // Reference to vendor
  vendorName: string,            // Denormalized for easy display
  
  // Customer info (from WhatsApp submission)
  customerPhone: string,         // e.g., "60123456789"
  customerName?: string,         // Optional, if provided
  
  // Order details
  items: [
    { id: string, name: string, qty: number, price: number }
  ],
  totalAmount: number,
  pickupLocation: string,
  bookingDates: {
    start: string,               // "2025-03-15"
    end: string                  // "2025-03-17"
  },
  
  // Status tracking
  status: "pending" | "confirmed" | "completed" | "cancelled",
  
  // Review token (generated when status → "completed")
  reviewToken?: string,          // Unique UUID, one-time use
  reviewTokenUsed: boolean,      // Default: false
  reviewTokenSentAt?: Timestamp, // When link was sent to customer
  
  // Timestamps
  createdAt: Timestamp,
  confirmedAt?: Timestamp,
  completedAt?: Timestamp,
}
```

### 2. `reviews` (Top-level collection)
Stores verified customer reviews.

```javascript
reviews/{reviewId}
{
  // Review identification
  id: string,
  orderId: string,               // Reference to the order
  vendorId: string,              // Reference to vendor
  
  // Reviewer info
  customerPhone: string,         // Masked in display: "6012****789"
  customerName?: string,         // Display name (optional)
  
  // Review content
  rating: number,                // 1-5 (firewood logs)
  comment?: string,              // Optional text review
  images?: string[],             // Optional photo uploads
  
  // Verification
  isVerified: true,              // Always true (order-based)
  reviewToken: string,           // The token used (for audit)
  
  // Status
  status: "published" | "hidden" | "flagged",
  
  // Vendor response
  vendorReply?: string,
  vendorRepliedAt?: Timestamp,
  
  // Timestamps
  createdAt: Timestamp,
}
```

### 3. `vendors/{vendorId}` (Updated fields)
Add aggregated rating data to vendor document.

```javascript
vendors/{vendorId}
{
  // ... existing fields ...
  
  // Rating aggregates (updated via Cloud Function)
  rating: number,                // Average: 4.5
  reviewCount: number,           // Total: 28
  ratingBreakdown: {             // For breakdown chart
    5: number,                   // Count of 5-log ratings
    4: number,
    3: number,
    2: number,
    1: number,
  }
}
```

---

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Orders - vendors can read/update their own orders
    match /orders/{orderId} {
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/vendors/$(resource.data.vendorId)).data.owner_uid == request.auth.uid;
      allow update: if request.auth != null && 
        get(/databases/$(database)/documents/vendors/$(resource.data.vendorId)).data.owner_uid == request.auth.uid;
      // Create handled by Cloud Function
    }
    
    // Reviews - public read, create only with valid token
    match /reviews/{reviewId} {
      allow read: if true;  // Public
      allow create: if isValidReviewToken(request.resource.data.reviewToken);
      // Update/delete by vendor owner only (for replies)
      allow update: if request.auth != null && 
        get(/databases/$(database)/documents/vendors/$(resource.data.vendorId)).data.owner_uid == request.auth.uid &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['vendorReply', 'vendorRepliedAt']);
    }
    
    // Helper function
    function isValidReviewToken(token) {
      let order = get(/databases/$(database)/documents/orders/$(token));
      return order != null && 
             order.data.reviewToken == token && 
             order.data.reviewTokenUsed == false;
    }
  }
}
```

---

## Review Token Generation

When vendor marks order as "completed":

```javascript
import { v4 as uuidv4 } from 'uuid';

async function generateReviewToken(orderId: string) {
  const token = uuidv4();  // e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  
  await updateDoc(doc(db, "orders", orderId), {
    status: "completed",
    completedAt: serverTimestamp(),
    reviewToken: token,
    reviewTokenUsed: false,
  });
  
  // Generate review link
  const reviewLink = `https://yoursite.com/review/${token}`;
  
  return { token, reviewLink };
}
```

---

## Review Link Format

```
https://pacakkhemah.com/review/{token}

Example:
https://pacakkhemah.com/review/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

When customer opens this link:
1. System validates token exists and not used
2. Shows review form with order details
3. After submission, marks `reviewTokenUsed: true`
4. Updates vendor rating aggregates

---

## WhatsApp Message Template

When order is completed, send to customer:

```
🏕️ Thanks for camping with {vendorName}!

We hope you had an amazing experience. 

🔥 Rate your rental:
{reviewLink}

Your feedback helps other campers find great gear!

- Pacak Khemah Team
```
