# Flouss 💸 — Freelance Cash Flow Tracker

A premium, offline-first personal finance tracker tailored specifically for freelancers and irregular-income earners. Built with **React Native (Expo)**, **TypeScript**, and **SQLite**.

Developed & Maintained by **AMADYN STUDIO - @LORDSNACK.PSD**.

---

## 📖 Project Overview

Unlike standard budgeting apps that assume a fixed monthly salary, **Flouss** is designed for the non-linear, irregular nature of freelance income. It accounts for erratic client payouts, partial invoice advances, late payments, and complex credit card or loan structures.

The app adheres to a clean, informational, and non-judgmental product philosophy:
- **On-Demand Reconciliation**: Reconcile balances on your own schedule without nagging notifications.
- **Zero Cloud Dependency**: Offline-first design with local-only storage for maximum privacy and performance.
- **Highly Extensible**: All categories, accounts, and items are user-defined.
- **Safe Archiving**: A dual-confirmation delete model prevents accidental data loss by archiving rather than hard-deleting records.

---

## ✨ Key Features Explained

### 💵 1. Irregular Income & Client Billing
- **Client Profiles**: Manage client details with tax details (`Matricule Fiscal`), custom logos, contact information (email, phone), and payment history.
- **Expected Income & Invoice Advances**: Track **Scheduled Payments** and **Advances**. Log a partial payment/advance, set a due date for the remainder, and manage outstanding balances as "Expected Income" in the Business tab.
- **Payment Reminders**: Configure opt-in offline reminders for invoice due dates.

### 📝 2. Quick-Add Expense Flow
- **High-Speed Entry**: Input transactions in under 3 seconds using the persistent Quick Add Floating Action Button.
- **On-Device Merchant Learning**: Automatically maps normalized description text to categories based on frequency (no external ML models or network requests required).
- **Amount Matching**: Automatically surfaces suggested items based on historical transactions within a ±10% tolerance band.

### 💳 3. Multi-Type Debt Engine
Flouss handles three distinct types of liabilities, each driving its own progress bars, interest calculations, and payment schedules:
- **Term Loans**: Fixed payoff target tracking with split calculations for principal, interest, and penalties (late fees).
- **Revolving Credit**: Spendable floats (credit cards) integrated directly as tiles in the Home accounts grid. Repayments calculate net principal freed and bank interest charges automatically.
- **Friend Loans**: Standard interest-free/fee-free personal borrowing.

### 📊 4. The "Unbilled Spending" Metric
- **Balance Reconciliation**: Run manual balance checks on any account.
- **Discrepancy Calculation**: Compares the `expected_balance` (from transaction log calculations) against the user's `actual_balance` to compute the **unbilled spending** since the last reconciliation.
- **Configurable Alerts**: Surfaced as an active status alert box on the Home dashboard when unlogged spending exceeds threshold limits configured in Settings (can be based on percentage of monthly budget, flat monthly allowance, or daily allowance).

### 🔄 5. Monthly Review & Insights
- **Monthly Inflows vs. Outflows**: Strict calendar month summaries comparing income vs. spending.
- **Aggregated Totals**: View tracked vs. unbilled totals, category breakdowns, and client payment trends.
- **Narrative Logs**: Automatically generated text summaries of debt trajectories and savings opportunities.

---

## 📱 App Navigation & Screen Breakdown

The application is structured around a central Tab navigator inside a customizable Drawer menu:

### 🏠 Main Tab Screens
1. **Home Screen (`HomeScreen`)**:
   - Displays total net cash balance (excluding credit limits).
   - Dynamic accounts grid (supporting drag-and-drop reordering) which merges cash accounts and active revolving credit cards.
   - Unlogged spending warning banners.
   - List of recent transactions.
   - Monthly review narrative box.
2. **History Screen (`TransactionsScreen`)**:
   - Scrollable timeline of all cash movements.
   - Details filter and search logic by category, account, client, or type (income/expense/transfer).
3. **Spending Screen (`SpendingScreen`)**:
   - Interactive charts of expenses grouped by category.
   - Budget targets versus actual spending indicators.
4. **Business Screen (`BusinessScreen`)**:
   - Master list of client profiles.
   - Expected payments panel highlighting outstanding invoices, paid vs pending metrics, and invoice due dates.

### 🍔 Drawer Navigation Screens
- **Cash Management (`CashManagementScreen`)**: Main panel to view, create, edit, or archive cash accounts (Bank, Cash, Savings) and log balance corrections.
- **Loans & Debts (`LoansScreen`)**: Lists active and paid-off liabilities. Direct access to term loan details, revolving credit rules, and peer loans.
- **Categories & Items (`CategoriesScreen`)**: Interface to customize expense categories, set budgets, and map specific items under each category.
- **Settings (`SettingsScreen`)**: Primary control panel for app configurations including currency settings, unlogged spending alert modes, raw JSON backup imports/exports, CSV export tools, and the Archive recovery manager.

### 📄 Detailed View Screens
- **Account Detail (`AccountDetailScreen`)**: Specific account transaction history, settings, and reconciliation triggers.
- **Debt Detail (`DebtDetailScreen`)**: Payoff progress bars, list of logged payments (principal vs interest splits), and debt payment calculators.
- **Client Detail (`ClientDetailScreen`)**: Client profile, tax metadata, logo, and client payment ledger.
- **Category Detail (`CategoryDetailScreen`)**: Spend details for a category, items lists, and budget configurations.
- **Transaction Detail (`TransactionDetailScreen`)**: Edit page for single transactions, transfer settings, client links, and note updates.
- **Expected Payments (`ExpectedPaymentsScreen`)**: Detailed tracking of outstanding invoices and schedules.
- **Archive Manager (`ArchiveScreen`)**: Soft-deleted entities repository allowing easy restoration of archived accounts, clients, categories, items, and transactions.

---

## 🛠️ Technical Architecture

- **Core Framework**: React Native + TypeScript (Expo prebuild workflow).
- **Local Database**: SQLite using `op-sqlite` for rapid, native SQL queries with a custom relational schema (`schema.ts`).
- **State Management & Database Syncing**: Context-based state provider (`AppContext`) trigger-reloading UI on DB mutations.
- **Notifications Engine**: `expo-notifications` for scheduled invoice due alerts.
- **Data Portability**: Local JSON export/import and CSV spreadsheet generators.
- **UI Design System**: Vanilla CSS rules leveraging a consistent token palette (`theme/tokens.ts`) with custom icons (`lucide-react-native`). Fully optimized for high-contrast dark mode aesthetics.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (version `>= 22.11.0`)
- Android SDK & Emulator / physical device (for Android builds)
- iOS Xcode / Simulator (for iOS builds, Mac required)

### Installation
1. **Clone the repository**:
   ```bash
   git clone https://github.com/lordSnackPsd/CashflowTracker.git
   cd CashflowTracker
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start the Metro bundler**:
   ```bash
   npx react-native start
   ```
4. **Run on Emulator / Connected Device**:
   - **Android**:
     ```bash
     npx react-native run-android
     ```
   - **iOS** (macOS only):
     ```bash
     npx react-native run-ios
     ```
