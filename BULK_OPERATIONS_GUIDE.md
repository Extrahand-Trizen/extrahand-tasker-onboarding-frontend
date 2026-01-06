# Bulk Operations Guide

## Two Types of Bulk Operations

### 1. Bulk Import Leads (Unverified) - `/leads/bulk-import`

**Purpose:** Import unverified leads into the tasker onboarding pipeline

**What it does:**
- Creates lead records (not user accounts)
- Leads start with status "lead_added"
- Leads go through full tasker onboarding pipeline:
  - lead_added → contacted → interested → documents_submitted → under_verification → approved → activated

**When to use:**
- ✅ Marketing campaigns (Facebook Ads, Google Ads)
- ✅ Events and exhibitions
- ✅ Walk-ins and referrals
- ✅ Any unverified candidates who need onboarding
- ✅ Initial lead collection

**Result:** Leads in the pipeline that need verification and approval before becoming users

---

### 2. Bulk Upload Users (Verified) - `/import`

**Purpose:** Create verified user accounts directly (skip the tasker onboarding pipeline)

**What it does:**
- Creates Firebase accounts + MongoDB profiles
- Users can login immediately
- Supports: Create, Update, Delete operations
- Skips the tasker onboarding pipeline entirely

**When to use:**
- ✅ Pre-verified users from partner programs
- ✅ Data migration from other systems
- ✅ Users who have already completed verification elsewhere
- ✅ Partner referrals that are pre-screened
- ✅ Bulk account creation for existing verified users

**Result:** Active user accounts that can login and use the platform immediately

---

## Quick Decision Guide

**Use "Bulk Import Leads" if:**
- ❓ Users need verification
- ❓ Users need to submit documents
- ❓ Users need to go through approval process
- ❓ You want to track them through the tasker onboarding pipeline

**Use "Bulk Upload Users" if:**
- ✅ Users are already verified
- ✅ Users have completed onboarding elsewhere
- ✅ You want them to login immediately
- ✅ You're migrating from another system

---

## CSV Format Differences

### Bulk Import Leads Format
```csv
name,phone,email,city,state,address,primarySkill,source,sourceDetails
John Doe,9876543210,john@example.com,Delhi,Delhi,123 Street,Plumber,referral,Facebook Ad
```

### Bulk Upload Users Format
```csv
operation,name,phone,address,city,state,pincode,skillsList,primarySkill,isActive
create,John Doe,9876543210,123 Street,Delhi,Delhi,110001,"Plumber,Electrician",Plumber,true
update,uid123,9876543210,456 Street,Delhi,Delhi,110002,"Plumber",Plumber,true
delete,uid456,,,,,,,,
```

---

## Summary

| Feature | Bulk Import Leads | Bulk Upload Users |
|---------|------------------|-------------------|
| **Status** | Unverified | Verified |
| **Creates** | Lead records | User accounts |
| **Pipeline** | Goes through tasker onboarding | Skips tasker onboarding |
| **Login** | After activation | Immediately |
| **Operations** | Create only | Create/Update/Delete |
| **Use Case** | Marketing, events | Pre-verified, migration |



