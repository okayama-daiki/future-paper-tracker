# AGENTS.md

This file provides guidelines for AI coding agents working on **Future Paper Tracker (FPT)**.

## Project

Future Paper Tracker (FPT) is a web application that tracks upcoming academic conference submissions.

The system aggregates structured information about:

- conferences
- yearly editions
- submission deadlines
- submission requirements

Target fields include:

- Operations Research
- Distributed Computing
- Discrete Mathematics
- Theoretical Computer Science

The platform supports both international and Japanese domestic conferences.

---

## Core Concepts

**Conference Series**

Example: PODC

**Edition**

Example: PODC 2026

Agents must treat these as separate entities.

**Submission Round**

Examples:

- abstract deadline
- full paper deadline
- rebuttal
- camera-ready

Deadlines must not be merged.

---

## Basic Rules

1. Store timestamps in **UTC**.
2. Always keep a **source URL** for collected data.
3. Do not invent conference information.
4. Prefer **correct data over large data volume**.

---

## Expected Stack

Backend: Go  
Database: PostgreSQL  
Frontend: Next.js  
Deployment: Docker

Avoid introducing additional frameworks unless necessary.

---

## Guideline for Agents

When uncertain:

- keep implementations simple
- prioritize data correctness
- avoid destructive schema changes

- Use `noreply@openai.com` as the commit email for all code changes.
