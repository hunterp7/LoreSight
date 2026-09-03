# Storyframe Codex Context Pack

Prepared: August 1, 2026

## What this is

This repository began as a playable ChatGPT MCP prototype called **The Agency: Applicant Intake**. Product discovery revealed a stronger opportunity: build a reusable narrative engine and creator platform capable of powering many turn-based games.

The Agency is now the first world pack and conformance test.

## The product in one sentence

Storyframe lets creators write the moments that must matter while a canon-aware AI performs the connective play between them.

## The creator experience in one sentence

A choose-your-own-mystery book that the creator is writing as they move through it.

## The player experience in one sentence

A deeply personalized, turn-based narrative that remembers decisions, characters, knowledge, clues, relationships, and consequences without allowing generated details to break canon.

## Current state

Already implemented and tested:

- Node/TypeScript MCP server using `@modelcontextprotocol/sdk` and `@modelcontextprotocol/ext-apps`;
- React terminal widget bundled into an MCP Apps UI resource;
- six Agency-specific MCP tools;
- one complete Applicant Intake path with three endings;
- protected final evidence;
- deterministic unit tests for the existing hard-coded story;
- local MCP smoke test;
- canon, architecture, Storyframe language, and Creator Studio specifications.

Not yet implemented:

- pure reusable engine packages;
- Storyframe parser/compiler;
- world-package validator;
- AI TweenContract execution and validation;
- structured character ledgers and recaps;
- plain-language Creator Studio;
- durable database persistence and authentication;
- production deployment;
- final graphics.

## First instruction to Codex

Do not add more story content or polish the existing terminal first. Begin with Phase 1 in `03_IMPLEMENTATION_PLAN.md`: establish the package boundaries, typed engine contracts, deterministic reducer, event log, projections, and conformance fixtures.

## Source of truth order

When documents conflict, use this order:

1. `AGENTS.md`
2. `docs/ARCHITECTURE_DECISIONS.md`
3. `docs/ENGINE_ARCHITECTURE.md`
4. `docs/STORYFRAME_LANGUAGE.md`
5. `docs/CREATOR_STUDIO_UX.md`
6. `docs/CANON.md` for The Agency only
7. `docs/PRODUCT.md` for the original Applicant Intake release
8. existing implementation behavior

## Immediate definition of success

The first architectural milestone passes when three very different tiny worlds—Agency investigation, survival travel, and market trading—execute through the same pure runtime without genre-specific code in the core.

