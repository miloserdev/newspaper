---
title: Search without external services
description: The full-text index is built from the same files and updates together with them.
tags: [search, engine]
date: 2026-11-01
---

Search covers titles, descriptions, tags and text. A title weighs more than the body, a tag more than the description.

> Matching is prefix-based and typo-tolerant: "engi" finds "engine".

| Field | Weight |
| --- | --- |
| title | 4 |
| tags | 2.5 |
| description | 1.5 |
| text | 1 |
