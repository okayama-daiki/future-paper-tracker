# AGENTS.md

This file provides guidelines for AI coding agents working on **Future Paper Tracker (FPT)**.

## Project

Future Paper Tracker (FPT) is a web application that tracks upcoming academic conference submissions.

The system aggregates structured information about:

- conferences
- yearly editions
- submission deadlines
- submission requirements

The platform supports both international and Japanese domestic conferences.

## Guideline for Agents

- Use `Codex <noreply@openai.com>` as Co-authored-by in commit messages when you create commits.
- We use `bun` as the package manager for frontend. (`bun run dev` to start the development server, `bun run build` to build the project, and `bun run lint` to run the linter.)

When uncertain:

- keep implementations simple
- prioritize data correctness
- avoid destructive schema changes
