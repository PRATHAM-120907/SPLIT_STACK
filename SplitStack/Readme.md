📘 # Split Stack — Product Documentation #
Executive Summary

        Split Stack is a group expense management platform designed to simplify shared financial responsibilities.
        It enables users to track expenses, split costs fairly, and settle balances transparently, removing confusion and conflict from group spending.

        Built with a strong backend-first architecture, Split Stack demonstrates how real-world financial systems are designed, secured, and scaled.

🎯 Vision

    Shared expenses are one of the most common sources of confusion in group travel, events, and daily life.
    Split Stack exists to eliminate ambiguity, increase trust, and automate fairness in group spending.

    Our vision is simple:

    Every group should know exactly who paid, who owes, and how to settle — instantly and accurately.

🧠 Problem Statement

    Traditional group expense tracking suffers from:

    Manual calculations

    Human error

    Poor transparency

    Awkward settlement conversations

    Most users want:

    A single source of truth

    Automatic calculations

    Clear settlement instructions

    Secure and controlled access

    Split Stack directly addresses these problems.

💡 Solution Overview

    Split Stack provides a secure, group-based expense system with:

    Controlled group access

    Structured expense tracking

    Automated balance calculation

    Minimal transaction settlement logic

    The system behaves exactly like a real-world financial ledger, ensuring accuracy, accountability, and fairness.

🧩 Core Features
🔐 User Authentication

        Secure registration and login

        Password hashing

        Session-based authentication

        Access control via Flask-Login

👥 Group Management

    Create expense groups

    Join groups via invite links

    Automatic membership handling

    Creator auto-enrollment

💸 Expense Tracking

    Log expenses with amount and description

    Attribute expenses to users and groups

    Persistent storage via relational database

    Chronological expense feed

📊 Automated Balance Calculation

    Calculates total group expenditure

    Splits costs equally among members

    Determines individual balances

    Identifies creditors and debtors

🔁 Settlement Optimization

    Computes minimal transactions

    Clearly answers: “Who owes whom, and how much?”

    Eliminates redundant payments

🛑 Trip Closure

    End-trip action triggers final calculations

    Presents definitive settlement summary

    Locks logical conclusion of the group

🏗️ Technical Architecture

Split Stack is designed with clarity and correctness over shortcuts.

    Backend

        Framework: Flask

        Language: Python

        ORM: SQLAlchemy

        Authentication: Flask-Login

    Database

        Type: SQLite

        Design: Relational

        Models: User, Group, GroupMember, Expense

    Frontend

        Server-rendered HTML (Jinja2)

        Clean, responsive CSS

        Minimal JavaScript for UX actions
