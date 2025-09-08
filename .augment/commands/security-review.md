---
description: Perform security analysis on code
argument-hint: [file-path]
model: gpt5
---

Perform a security review of: $ARGUMENTS

Focus on:

1. Input validation and sanitization
2. Authentication and authorization checks
3. Data exposure and privacy concerns
4. Injection vulnerabilities (SQL, XSS, etc.)
5. Cryptographic implementations
6. Dependencies with known vulnerabilities

Provide specific recommendations for any issues found.
