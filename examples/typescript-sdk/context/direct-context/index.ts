/**
 * Sample: Direct Context - API-based indexing with import/export state
 *
 * This sample demonstrates:
 * - Creating a Direct Context instance
 * - Adding files to the index
 * - Searching the indexed files
 * - Using Generation API to ask questions about indexed code
 * - Generating documentation from indexed code
 * - Exporting state to a file
 * - Importing state from a file
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DirectContext } from "@augmentcode/auggie-sdk";

async function main() {
  console.log("=== Direct Context Sample ===\n");

  // Create a Direct Context instance
  // Authentication is automatic via:
  // 1. AUGMENT_API_TOKEN / AUGMENT_API_URL env vars, or
  // 2. ~/.augment/session.json (created by `auggie login`)
  console.log("Creating Direct Context...");
  const context = await DirectContext.create({ debug: true });

  // Add some sample files to the index
  console.log("\nAdding files to index...");
  // Using realistic, detailed code examples for better search results
  const files = [
    {
      path: "src/utils/string-helpers.ts",
      contents: `/**
 * String utility functions for text processing and formatting
 */

/**
 * Format a number with thousands separators
 * @param num Number to format
 * @param locale Locale for formatting (default: 'en-US')
 * @returns Formatted number string
 */
export function formatNumber(num: number, locale: string = 'en-US'): string {
  return num.toLocaleString(locale);
}

/**
 * Check if a number is even
 * @param num Number to check
 * @returns True if number is even, false otherwise
 */
export function isEven(num: number): boolean {
  return num % 2 === 0;
}

/**
 * Check if a number is odd
 * @param num Number to check
 * @returns True if number is odd, false otherwise
 */
export function isOdd(num: number): boolean {
  return num % 2 !== 0;
}

/**
 * Clamp a value between min and max bounds
 * @param value Value to clamp
 * @param min Minimum allowed value
 * @param max Maximum allowed value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Capitalize the first letter of a string
 * @param str String to capitalize
 * @returns String with first letter capitalized
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert string to title case
 * @param str String to convert
 * @returns String in title case
 */
export function toTitleCase(str: string): string {
  return str.split(' ').map(word => capitalize(word)).join(' ');
}

/**
 * Truncate string to specified length with ellipsis
 * @param str String to truncate
 * @param maxLength Maximum length
 * @returns Truncated string
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}`,
    },
    {
      path: "src/data/user-service.ts",
      contents: `/**
 * User service for managing user data and authentication
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role?: 'user' | 'guest';
}

/**
 * Service class for user management operations
 */
export class UserService {
  private users: Map<string, User> = new Map();

  /**
   * Create a new user account
   * @param request User creation request
   * @returns Created user (without password)
   */
  async createUser(request: CreateUserRequest): Promise<User> {
    const id = this.generateUserId();
    const user: User = {
      id,
      email: request.email,
      name: request.name,
      role: request.role || 'user',
      createdAt: new Date(),
    };

    this.users.set(id, user);
    return user;
  }

  /**
   * Find user by ID
   * @param id User ID
   * @returns User if found, undefined otherwise
   */
  async findUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  /**
   * Find user by email address
   * @param email Email address
   * @returns User if found, undefined otherwise
   */
  async findUserByEmail(email: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * Update user's last login timestamp
   * @param id User ID
   */
  async updateLastLogin(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.lastLoginAt = new Date();
    }
  }

  /**
   * Get all users with optional role filter
   * @param role Optional role filter
   * @returns Array of users
   */
  async getUsers(role?: User['role']): Promise<User[]> {
    const allUsers = Array.from(this.users.values());
    if (role) {
      return allUsers.filter(user => user.role === role);
    }
    return allUsers;
  }

  /**
   * Delete user by ID
   * @param id User ID
   * @returns True if user was deleted, false if not found
   */
  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }
}`,
    },
    {
      path: "src/api/http-client.ts",
      contents: `/**
 * HTTP client for making API requests with error handling and retries
 */

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

/**
 * HTTP client class for making API requests
 */
export class HttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    this.baseURL = baseURL.replace(/\\/$/, '');
    this.defaultHeaders = defaultHeaders;
  }

  /**
   * Make a GET request
   * @param url Request URL
   * @param headers Optional headers
   * @returns Promise with response data
   */
  async get<T>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      headers,
    });
  }

  /**
   * Make a POST request
   * @param url Request URL
   * @param body Request body
   * @param headers Optional headers
   * @returns Promise with response data
   */
  async post<T>(url: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      body,
      headers,
    });
  }

  /**
   * Make a PUT request
   * @param url Request URL
   * @param body Request body
   * @param headers Optional headers
   * @returns Promise with response data
   */
  async put<T>(url: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      body,
      headers,
    });
  }

  /**
   * Make a DELETE request
   * @param url Request URL
   * @param headers Optional headers
   * @returns Promise with response data
   */
  async delete<T>(url: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
      headers,
    });
  }

  /**
   * Make a generic HTTP request
   * @param config Request configuration
   * @returns Promise with response data
   */
  private async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const url = config.url.startsWith('http') ? config.url : \`\${this.baseURL}\${config.url}\`;

    const headers = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
      ...config.headers,
    };

    const response = await fetch(url, {
      method: config.method,
      headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    const data = await response.json();

    return {
      data,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }
}`,
    },
  ];

  const result = await context.addToIndex(files);
  console.log("\nIndexing result:");
  console.log("  Newly uploaded:", result.newlyUploaded);
  console.log("  Already uploaded:", result.alreadyUploaded);

  // Search the codebase - returns formatted string ready for LLM use or display
  // Using queries that work well with our realistic content
  console.log("\n--- Search 1: Find string utility functions ---");
  const results1 = await context.search("string utility functions for text formatting");
  console.log("Search results:");
  console.log(results1);

  console.log("\n--- Search 2: Find user management service ---");
  const results2 = await context.search("user management service with CRUD operations");
  console.log("Search results:");
  console.log(results2);

  console.log("\n--- Search 3: Find HTTP client for API requests ---");
  const httpResults = await context.search("HTTP client for making API requests");
  console.log("Search results:");
  console.log(httpResults);

  // Use searchAndAsk to ask questions about the indexed code
  console.log("\n--- searchAndAsk Example 1: Ask questions about the code ---");
  const question = "How does the UserService class handle user creation and validation?";
  console.log(`Question: ${question}`);

  const answer = await context.searchAndAsk(
    "user creation and validation in UserService",
    question
  );

  console.log(`\nAnswer: ${answer}`);

  // Use searchAndAsk to generate documentation
  console.log("\n--- searchAndAsk Example 2: Generate documentation ---");
  const documentation = await context.searchAndAsk(
    "string utility functions",
    "Generate API documentation in markdown format for the string utility functions"
  );

  console.log("\nGenerated Documentation:");
  console.log(documentation);

  // Use searchAndAsk to explain code patterns
  console.log("\n--- searchAndAsk Example 3: Explain code patterns ---");
  const explanation = await context.searchAndAsk(
    "utility functions",
    "Explain what these utility functions do and when they would be useful"
  );

  console.log(`\nExplanation: ${explanation}`);

  // Export state to a file
  const stateFile = join("/tmp", "direct-context-state.json");
  console.log(`\nExporting state to ${stateFile}...`);
  await context.exportToFile(stateFile);
  console.log("State exported successfully");

  // Show the exported state
  const exportedState = JSON.parse(readFileSync(stateFile, "utf-8"));
  console.log("\nExported state:");
  console.log(JSON.stringify(exportedState, null, 2));

  // Import state in a new context
  console.log("\n--- Testing state import ---");
  const context2 = await DirectContext.importFromFile(stateFile, { debug: false });
  console.log("State imported successfully");

  // Verify we can still search
  const results3 = await context2.search("string utility functions");
  console.log("\nSearch after importing state:");
  console.log(results3);

  console.log("\n=== Sample Complete ===");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
