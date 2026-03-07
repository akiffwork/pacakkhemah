# Pacak Khemah - Complete Testing Checklist
## Version: March 2026

---

# 🎯 TESTING OVERVIEW

This document covers all features, buttons, and integrations to ensure nothing is broken.

---

# 📱 PART 1: CUSTOMER-FACING PAGES

## 1.1 Landing Page (Directory)
**File:** `app/directory/page.tsx`

### Visual Elements
- [ ] Hero section displays correctly
- [ ] "Sewa Gear Camping. Tanpa Hassle." title visible
- [ ] Trust badges show (Verified Vendors, Secure Booking, etc.)
- [ ] "How it Works" section has 3 steps
- [ ] Testimonials section loads (from Firestore or defaults)
- [ ] Vendor CTA "Got Camping Gear?" section visible
- [ ] Footer shows About, FAQ, Contact links

### Functional Tests
| Test | Action | Expected Result |
|------|--------|-----------------|
| Find Vendors button | Click | Scrolls to vendor grid |
| Become Vendor button | Click | Navigates to /register-vendor |
| Location dropdown | Select location | Filters vendors by city |
| Vendor card click | Click any vendor | Opens vendor modal or navigates to shop |
| About link | Click | Navigates to /about |
| FAQ link | Click | Navigates to /faq |
| Ad Banner | View | Shows after 6th vendor (if AdSense approved) |

---

## 1.2 About Page
**File:** `app/about/page.tsx`

### Visual Elements
- [ ] Sticky header with logo
- [ ] EN/BM language toggle
- [ ] All sections render (Story, What We Do, For Campers, For Vendors, etc.)
- [ ] Contact section shows

### Functional Tests
| Test | Action | Expected Result |
|------|--------|-----------------|
| Language toggle | Click EN/BM | Content switches language |
| Back to Directory | Click logo/back | Returns to /directory |
| WhatsApp contact | Click | Opens WhatsApp |
| Email contact | Click | Opens email client |

---

## 1.3 FAQ Page
**File:** `app/faq/page.tsx`

### Visual Elements
- [ ] Sticky header with EN/BM toggle
- [ ] Section tabs visible
- [ ] FAQ accordion items render
- [ ] Each section has relevant questions

### Functional Tests
| Test | Action | Expected Result |
|------|--------|-----------------|
| Language toggle | Click | Content switches |
| Section tabs | Click different tabs | Shows relevant FAQs |
| Accordion | Click question | Expands/collapses answer |
| Back navigation | Click back | Returns to previous page |

---

## 1.4 Shop Page (Vendor Storefront)
**File:** `app/shop/[slug]/page.tsx`

### Visual Elements
- [ ] Vendor header with logo, name, tagline
- [ ] Social links (IG, TikTok, FB) if configured
- [ ] "Delivery Available" badge (if enabled)
- [ ] "Setup Service" badge (if enabled)
- [ ] Date picker section
- [ ] Gear grid with categories
- [ ] Cart button (when items added)

### Functional Tests - Basic
| Test | Action | Expected Result |
|------|--------|-----------------|
| Back button | Click | Returns to /directory |
| Share button | Click | Copies link / opens share sheet |
| Date picker | Select dates | Updates nights calculation |
| Gear search | Type in search | Filters gear items |
| Add to cart | Click + on item | Item added, toast shows |
| View item | Click item card | Modal opens with details |
| Cart button | Click | Opens cart modal |

### Functional Tests - Cart Modal
| Test | Action | Expected Result |
|------|--------|-----------------|
| Quantity +/- | Click buttons | Updates quantity |
| Remove item | Reduce to 0 | Item removed from cart |
| Promo code | Enter valid code | Discount applied |
| Promo code | Enter invalid | Error message shows |
| Terms checkbox | Toggle | Enables/disables submit |

### Functional Tests - Fulfillment (NEW)
| Test | Action | Expected Result |
|------|--------|-----------------|
| Self Pickup | Select | Shows pickup point dropdown |
| Delivery | Select | Shows delivery options |
| Zone selection | Pick zone | Fee updates in summary |
| Per KM input | Enter distance | Fee calculates correctly |
| Quote mode | View | Shows "TBD via WhatsApp" |
| Time slot | Select | Adds to order |
| Per-item setup | Toggle checkbox | Fee adds to total |
| Bundle combo | Toggle | Combo price applies, savings shown |
| Submit order | Click WhatsApp | Opens WhatsApp with full message |

### Edge Cases
- [ ] Shop loads with invalid slug → Shows "Hub Building" screen
- [ ] Vendor on vacation → Shows "On Vacation" screen
- [ ] Vendor has 0 credits → Shows "Hub Unavailable" screen
- [ ] Owner views own shop → Shows "Preview Mode" badge

---

# 🏪 PART 2: VENDOR STUDIO

## 2.1 Vendor Dashboard/Store
**File:** `app/store/page.tsx`

### Access Control
- [ ] Unauthenticated → Redirects to login
- [ ] Authenticated but no vendor profile → Shows registration
- [ ] Authenticated vendor → Shows dashboard

### Navigation Tabs
| Tab | Click | Expected |
|-----|-------|----------|
| Storefront | Click | Shows shop preview settings |
| Inventory | Click | Shows gear management |
| Analytics | Click | Shows stats/charts |
| Settings | Click | Shows settings (3 sub-tabs) |

---

## 2.2 Settings Tab (Vendor)
**File:** `src/components/SettingsTab.tsx`

### Sub-tabs
- [ ] Account tab visible
- [ ] Logistics tab visible
- [ ] Delivery & Setup tab visible (NEW)

### Account Tab
| Test | Action | Expected Result |
|------|--------|-----------------|
| Edit shop name | Change & save | Updates in Firestore |
| Edit phone | Change & save | Updates in Firestore |
| Edit slug | Change & save | Updates URL |
| Password reset | Click | Sends reset email |
| Delete account | Confirm | Deletes vendor |

### Logistics Tab
| Test | Action | Expected Result |
|------|--------|-----------------|
| Vacation mode | Toggle | Shop shows vacation screen |
| Stack discounts | Toggle | Enables discount stacking |
| Main city | Edit & save | Updates |
| Service areas | Edit & save | Updates |
| Pickup points | Edit & save | Shows in shop |
| Security deposit | Edit | Updates pricing |
| Rental rules | Add/edit/delete | Updates terms |
| Load defaults | Click | Populates default rules |

### Delivery & Setup Tab (NEW)
| Test | Action | Expected Result |
|------|--------|-----------------|
| Delivery toggle | Enable | Shows pricing options |
| Fixed fee | Select & set | Saves to Firestore |
| Per KM | Select & set rate | Saves |
| Zones | Add zone | Zone appears in list |
| Zones | Remove zone | Zone removed |
| Quote mode | Select | No price input needed |
| Free delivery | Set threshold | Applies in shop |
| Delivery notes | Enter | Shows in shop |
| Setup toggle | Enable | Shows fee input |
| Setup fee | Set amount | Saves |
| Setup description | Enter | Saves |
| Combo toggle | Enable | Shows combo pricing |
| Combo price | Set | Calculates savings |
| Time slots | Enable | Shows slot list |
| Time slots | Add/edit/remove | Updates list |
| Save button | Click | Shows success, saves to Firestore |

---

## 2.3 Inventory Tab
**File:** `src/components/InventoryTab.tsx`

### Gear Management
| Test | Action | Expected Result |
|------|--------|-----------------|
| Add item | Click + Add | Opens modal |
| Fill form | Enter all fields | Validates |
| Upload image | Select file | Preview shows |
| Setup toggle | Enable (NEW) | Shows fee input |
| Setup fee | Enter amount (NEW) | Saves with item |
| Save item | Click save | Item appears in grid |
| Edit item | Click edit | Modal opens with data |
| Delete item | Click delete | Item removed |
| Category filter | Auto-groups | Items grouped by category |

### Discount Management
| Test | Action | Expected Result |
|------|--------|-----------------|
| Add discount | Click | Opens modal |
| Nightly discount | Set trigger + % | Saves |
| Promo code | Set code + % | Saves |
| Public toggle | Toggle | Shows/hides in shop banner |
| Edit discount | Click chip | Opens edit modal |
| Delete discount | Confirm | Removes |

---

# 👨‍💼 PART 3: ADMIN PANEL

## 3.1 Admin Access
**File:** `app/admin/page.tsx`

### Access Control
- [ ] Non-admin email → Access denied
- [ ] akiff.work@gmail.com → Full access

---

## 3.2 Dashboard Tab (Admin)
**File:** `src/components/admin/DashboardTab.tsx`

### Visual Elements
- [ ] Time range selector (7d/30d/90d)
- [ ] Alert banners (pending vendors, low credits)
- [ ] 4 stat cards render
- [ ] Revenue chart (7 days)
- [ ] Top vendors list
- [ ] Location distribution chart
- [ ] Recent transactions list
- [ ] Quick Actions section

### Functional Tests
| Test | Action | Expected Result |
|------|--------|-----------------|
| Time range | Switch 7d/30d/90d | Data updates |
| Review Pending | Click | Navigates to Vendors tab |
| Send Reminder | Click | Shows alert with low-credit vendors / Opens WhatsApp |
| Export Report | Click | Downloads JSON file |
| Site Settings | Click | Navigates to Settings tab |

### Data Validation
- [ ] Stats match Firestore data
- [ ] Chart shows correct days
- [ ] Top vendors sorted by credits
- [ ] Transactions load from `transactions` collection

---

## 3.3 Finance Tab (Admin)
**File:** `src/components/admin/FinanceTab.tsx`

### Visual Elements
- [ ] Time range selector
- [ ] 4 stat cards (Revenue, Credits, Refunds, Avg)
- [ ] Monthly revenue chart
- [ ] Low credit vendors list
- [ ] Transaction table

### Functional Tests
| Test | Action | Expected Result |
|------|--------|-----------------|
| Time filter | Change | Filters transactions |
| Type filter | Click all/purchase/bonus/refund | Filters table |
| Add transaction | Click + | Opens modal |
| Fill form | Select vendor, amount, credits, type | Validates |
| Save transaction | Submit | Appears in table |
| Low credit vendors | View | Shows vendors with ≤5 credits |

---

## 3.4 Content Tab (Admin)
**File:** `src/components/admin/ContentTab.tsx`

### Sub-sections
- [ ] Announcement banner
- [ ] About page editor
- [ ] FAQ manager
- [ ] Testimonials CRUD
- [ ] Events CRUD
- [ ] Homepage editor

### Functional Tests
| Test | Action | Expected Result |
|------|--------|-----------------|
| Announcement toggle | Enable | Shows on site |
| Announcement type | Change | Preview updates |
| About fields | Edit & save | Updates /about page |
| FAQ section | Add | New section appears |
| FAQ question | Add to section | Question appears |
| FAQ | Edit/delete | Updates |
| Testimonial | Add | Opens modal |
| Testimonial | Fill & save | Appears in grid |
| Testimonial | Edit/delete | Updates |
| Event | Add | Opens modal |
| Event | Fill & save | Appears in grid |
| Event | Edit/delete | Updates |
| Homepage hero | Edit & save | Updates directory page |
| Save all | Click | Saves to Firestore |

---

## 3.5 Settings Tab (Admin)
**File:** `src/components/admin/SettingsTab.tsx`

### Sub-sections
- [ ] Site Info
- [ ] Social Links
- [ ] Admin Access
- [ ] Default Policies
- [ ] Danger Zone

### Functional Tests
| Test | Action | Expected Result |
|------|--------|-----------------|
| Site name | Edit & save | Updates |
| Tagline | Edit & save | Updates |
| Contact email | Edit & save | Updates |
| WhatsApp | Edit & save | Updates |
| Maintenance mode | Toggle ON | Site shows maintenance |
| Maintenance message | Edit | Shows in maintenance screen |
| Social links | Edit any | Saves |
| Add admin | Enter email + Add | Appears in list |
| Remove admin | Click X | Removed (min 1 required) |
| Default deposit | Edit | Sets for new vendors |
| Cancellation hours | Edit | Saves |
| Damage policy | Edit | Saves |
| Export data | Click | Downloads JSON |
| Clear transactions | Click + confirm | Deletes all transactions |
| Reset settings | Click + confirm | Resets to defaults |
| Save all | Click | Saves to Firestore |

---

# 🔗 PART 4: INTEGRATION TESTS

## 4.1 Firestore Rules
**Test each collection has proper access:**

| Collection | Public Read | Write Access |
|------------|-------------|--------------|
| vendors | ✅ | Owner + Admin |
| gear | ✅ | Vendor owner + Admin |
| events | ✅ | Admin only |
| testimonials | ✅ | Admin only |
| transactions | ❌ Admin only | Admin only |
| settings | ✅ | Admin only |
| analytics | ❌ | Create: public, Read: owner/admin |

### Test Commands (Firebase Console > Rules Playground)
```
# Test vendor read (should pass)
Path: /vendors/any-id
Method: get
Auth: None

# Test transaction read as non-admin (should fail)
Path: /transactions/any-id
Method: get
Auth: user@gmail.com

# Test transaction read as admin (should pass)
Path: /transactions/any-id
Method: get
Auth: akiff.work@gmail.com
```

---

## 4.2 Data Flow Tests

### Vendor → Shop Flow
1. [ ] Vendor enables delivery in Settings
2. [ ] Vendor sets zones/fees
3. [ ] Vendor saves
4. [ ] Open shop page for that vendor
5. [ ] Verify delivery option appears
6. [ ] Verify zones/fees match

### Vendor → Inventory → Shop Flow
1. [ ] Vendor adds item with setup fee
2. [ ] Vendor saves
3. [ ] Open shop page
4. [ ] Add item to cart
5. [ ] Verify setup checkbox appears
6. [ ] Toggle setup, verify fee in total

### Admin → Content → Public Flow
1. [ ] Admin edits testimonial
2. [ ] Admin saves
3. [ ] Open directory page
4. [ ] Verify testimonial updated

### WhatsApp Message Validation
1. [ ] Add items to cart
2. [ ] Select delivery + zone
3. [ ] Add setup for items
4. [ ] Submit order
5. [ ] Verify WhatsApp message contains:
   - [ ] All items with quantities
   - [ ] Setup fees per item
   - [ ] Delivery address
   - [ ] Zone name
   - [ ] Delivery fee
   - [ ] Time slot
   - [ ] Total amount

---

# 📊 PART 5: ANALYTICS & TRACKING

## 5.1 Google Analytics (G-LTMWBHSF7G)
- [ ] Page views tracking on all pages
- [ ] Event tracking on button clicks

## 5.2 WhatsApp Lead Tracking
- [ ] Credit deducted on WhatsApp click
- [ ] Analytics document created with:
  - vendorId
  - vendorName
  - totalAmount
  - fulfillmentType (NEW)
  - deliveryAddress (NEW)
  - cartItems with setup flags (NEW)

---

# 🐛 PART 6: EDGE CASES & ERROR HANDLING

## 6.1 Empty States
- [ ] Directory with no vendors → Shows empty message
- [ ] Shop with no gear → Shows empty message
- [ ] Cart empty → Shows "Add items" message
- [ ] No transactions → Chart shows empty state
- [ ] No testimonials → Shows defaults

## 6.2 Loading States
- [ ] Directory → Skeleton cards while loading
- [ ] Shop → Skeleton cards while loading
- [ ] Admin tabs → Spinner while loading

## 6.3 Error States
- [ ] Network error → Console logs, graceful fallback
- [ ] Invalid vendor slug → Block screen
- [ ] Firestore permission denied → Console error (check rules)

---

# 🔧 PART 7: QUICK DEBUG COMMANDS

## Browser Console Checks
```javascript
// Check if Firebase loaded
console.log(firebase.apps.length > 0 ? "Firebase OK" : "Firebase FAILED");

// Check current user
firebase.auth().onAuthStateChanged(u => console.log("User:", u?.email || "None"));

// Test Firestore read
firebase.firestore().collection("vendors").limit(1).get().then(s => console.log("Vendors:", s.size));

// Test transactions (admin only)
firebase.firestore().collection("transactions").limit(1).get()
  .then(s => console.log("Transactions:", s.size))
  .catch(e => console.log("Permission denied (expected for non-admin)"));
```

## Network Tab Checks
- [ ] No failed requests (red)
- [ ] Firestore requests return 200
- [ ] Images load successfully

---

# ✅ SIGN-OFF CHECKLIST

## Before Deploy
- [ ] All tests above pass
- [ ] No console errors
- [ ] Mobile responsive check
- [ ] Firestore rules published
- [ ] Environment variables set

## After Deploy
- [ ] Verify production URL works
- [ ] Test one full booking flow
- [ ] Check WhatsApp message format
- [ ] Verify admin panel access
- [ ] Monitor for errors

---

# 📝 NOTES

**Testing Environment:**
- Use incognito for non-authenticated tests
- Use separate browser for admin tests
- Clear localStorage between tests if needed

**Common Issues:**
1. "Permission denied" → Check Firestore rules
2. Buttons not working → Check if onClick handler exists
3. Data not showing → Check collection names match
4. Styles broken → Check Tailwind classes

---

*Last Updated: March 2026*
*Created for Pacak Khemah by Claude*