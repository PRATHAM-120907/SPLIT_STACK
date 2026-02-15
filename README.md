# Split Stack 💸  
*A Group Expense Management System*

Split Stack is a web application designed to simplify group expense tracking and settlement.  
It provides a clear, transparent, and automated way to manage shared expenses and calculate who owes whom.

---

## 📌 Overview

Split Stack allows users to:
- Create expense groups
- Add shared expenses
- Automatically calculate balances
- Generate a clean settlement summary

The focus of this project is **backend logic, data consistency, and real-world financial calculations**, rather than just UI.

---

## 🚀 Features

### 🔐 Authentication
- Secure user registration and login
- Password hashing
- Session-based authentication using Flask-Login

### 👥 Group Management
- Create groups
- Join groups via invite links
- Automatic membership handling
- Group access restricted to members only

### 💸 Expense Tracking
- Add expenses with amount and description
- Expenses linked to users and groups
- Chronological expense feed

### 📊 Balance Calculation
- Automatically calculates:
  - Total group expense
  - Equal share per member
  - Individual balances (paid vs share)

### 🔁 Settlement Logic
- Determines **who owes whom**
- Minimizes number of transactions
- Clear and human-readable settlement output

### 🛑 End Trip Flow
- Finalizes expense calculations
- Displays settlement summary
- Marks logical completion of the group

---

## 🛠 Tech Stack

- **Backend:** Flask (Python)
- **Database:** SQLite
- **ORM:** SQLAlchemy
- **Authentication:** Flask-Login
- **Frontend:** HTML, CSS, JavaScript
- **Version Control:** Git & GitHub

---

## 🧠 Core Business Logic

The expense split logic follows a real-world financial approach:

