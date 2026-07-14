# Flouss 💸 — Freelance Cash Flow Tracker

A premium, offline-first personal finance tracker tailored specifically for freelancers and irregular-income earners. Built with **React Native (Expo)**, **TypeScript**, and **SQLite**.

Developed & Maintained by **AMADYN STUDIO - @LORDSNACK.PSD**.

---

## 📖 Project Overview

Unlike standard budgeting apps that assume a fixed monthly salary, **Flouss** is built for the non-linear nature of freelance income. It accounts for irregular client payouts, partial invoice advances, late payments, and complex credit card structures. 

The app adheres to a clean, informational, and non-judgmental product philosophy:
- **On-Demand Reconciliation**: Reconcile balances on your own schedule without nagging notifications.
- **Zero Cloud Dependency**: Offline-first design with local-only storage for maximum privacy and performance.
- **Highly Extensible**: All categories, accounts, and items are user-defined.
- **Safe Archiving**: A dual-confirmation delete model prevents accidental data loss.

---

## ✨ Key Features

### 💵 1. Irregular Income & Client Billing
- Tag income transactions as client work or personal transfers (e.g., roommate reimbursements).
- Manage client profiles with tax details (`Matricule Fiscal`) and custom logos.
- Track **Scheduled Payments** and **Advances**: log a partial payment, set a due date for the remainder, and manage outstanding balances as "Expected Income."

### 📝 2. Quick-Add Expense Flow
- High-speed interactions that complete in under 3 seconds.
- **On-Device Merchant Learning**: Automatically maps normalized description text to categories based on frequency (no external ML models or network requests required).
- **Amount Matching**: Automatically surfaces suggested items based on historical transactions within a ±10% tolerance band.

### 💳 3. Multi-Type Debt Engine
Flouss handles three distinct types of liabilities, each driving its own progress bars and calculations:
- **Term Loans**: Fixed payoff target tracking with split calculations for principal, interest, and penalties (late fees).
- **Revolving Credit**: Spendable floats (credit cards) integrated directly as tiles in the Home accounts grid. repayments calculate net principal freed and bank interest charges automatically.
- **Friend Loans**: Standard interest-free/fee-free personal borrowing.

### 📊 4. The "Unbilled Spending" Metric
- Run manual balance reconciliation checks on any account.
- Compares the `expected_balance` (from transaction log calculations) against the user's `actual_balance` to compute the **unbilled spending** since the last reconciliation.
- Surfaced as an active status alert box on the Home dashboard when unlogged spending exceeds threshold limits configured in Settings.

### 🔄 5. Monthly Review & Insights
- Strict calendar month summaries comparing income vs. spending.
- Aggregates tracked vs. unbilled totals, category breakdowns, and client payment trends.
- Surfaced short narrative logs summarizing debt trajectories and savings opportunities.

---

## 🛠️ Technical Architecture

- **Core Framework**: React Native + TypeScript (Expo environment).
- **Local Database**: SQLite (`op-sqlite`) using a relational structure with UUID primary keys.
- **Local Notifications**: Opt-in scheduled reminders for due dates.
- **File System & Sharing**: Raw JSON database backup exports/restores and CSV report exports.
- **Dark Mode**: High-fidelity dark mode matching colors, gradients, and elevation.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (version `>= 22.11.0`)
- Android SDK / Emulator (or physical device)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/lordSnackPsd/CashflowTracker.git
   cd CashflowTracker
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Metro bundler:
   ```bash
   npx react-native start
   ```
4. Build and run on Android:
   ```bash
   npx react-native run-android
   ```
