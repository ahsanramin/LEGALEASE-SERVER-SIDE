# 🏛️ LegalEase Enterprise Backend API — SaaS Legal Platform

![Node.js](https://img.shields.io/badge/Node.js-v20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-orange?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Stripe](https://img.shields.io/badge/Payments-Stripe-008CDD?style=for-the-badge&logo=stripe&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployment-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](http://makeapullrequest.com)

> **LegalEase** is an enterprise-grade, scalable SaaS backend platform meticulously engineered to bridge the gap between legal seekers, clients, and verified lawyers. This API powers the entire ecosystem—from seamless role-based authentication and secure Stripe-integrated payments to rich data analytics and robust comment moderation. It is built to handle complex legal hiring workflows with extreme data integrity.

---

## 📑 Table of Contents
- [✨ Key Enterprise Features](#-key-enterprise-features)
- [🧠 System Architecture & Database ERD](#-system-architecture--database-erd)
- [⚙️ Technical Stack Deep Dive](#-technical-stack-deep-dive)
- [🚀 Quick Start & Developer Onboarding](#-quick-start--developer-onboarding)
- [🔐 Environment Variables Configuration](#-environment-variables-configuration)
- [🗂️ Core API Endpoint Reference](#-core-api-endpoint-reference)
- [🌊 High-Level Business Workflows](#-high-level-business-workflows)
- [🧪 Database Seeding & QA Testing Strategy](#-database-seeding--qa-testing-strategy)
- [🔒 Enterprise Security & Error Handling](#-enterprise-security--error-handling)
- [☁️ Cloud Deployment (Vercel Serverless)](#-cloud-deployment-vercel-serverless)
- [📝 Contribution & Commit Guidelines](#-contribution--commit-guidelines)
- [📜 Changelog & Versioning](#-changelog--versioning)
- [👤 Author & System Admin Info](#-author--system-admin-info)

---

## ✨ Key Enterprise Features

✅ **Role-Based Access Control (RBAC):** Granular access for `User`, `Lawyer`, and `Admin` with server-side validation.  
✅ **Enterprise Payment Gateway:** Seamless Stripe integration managing `$10,000` one-time publishing fees and variable consultation fees.  
✅ **Multi-Tier Transaction Logging:** Captures both `publishing` and `hiring` transactions with unique Stripe IDs for absolute audit compliance.  
✅ **High-Fidelity Image Service:** Leverages `imgBB` API to handle high-resolution profile image uploads securely.  
✅ **Dynamic Employee Hiring Workflow:** `Pending` → `Accepted/Rejected` → `Paid` state machine for tracking legal engagements.  
✅ **Gated Community Comment System:** Users can only comment after they have successfully completed a paid hiring transaction.  
✅ **Comprehensive Admin Console:** Provides platform-wide user management, transaction monitoring, and real-time business analytics.  

---

## 🧠 System Architecture & Database ERD

The API follows a modern **Document-Oriented Architecture** using `Mongoose`. Below is the Entity-Relationship mapping:

### 📂 Core Data Models
| Model Name | Description | Key Fields |
| :--- | :--- | :--- |
| **User** | Platform authentication entity. | `_id`, `name`, `email`, `password (hashed)`, `role (user/lawyer/admin)`, `shortlist (Lawyer[] ref)` |
| **Lawyer** | Core professional profile for Lawyers. | `userId (User ref)`, `experience`, `location`, `fee`, `isPublished` |
| **Hiring** | Binding contract between a Client and a Lawyer. | `userId (User ref)`, `lawyerId (Lawyer ref)`, `status`, `paymentStatus` |
| **Transaction** | Immutable financial ledger. | `userId (User ref)`, `lawyerId (Lawyer ref)`, `amount`, `type (publishing/hiring)`, `transactionId (Stripe)` |
| **Comment** | User-generated reviews for lawyers. | `userId`, `lawyerId`, `content` |

### 🔗 Relationships Diagram (ERD)
```text
[ User (Client) ]           [ User (Lawyer) ]
        | (1)                       | (1)
        |                           |
        v (N)                       v (N)
[ Hiring ] <---(relates to)---- [ Lawyer ]
        |                           | (1)
        | (N)                       |
        v                           v (N)
[ Transaction ]                 [ Comment ] <---(has author)--- [ User (Client) ]