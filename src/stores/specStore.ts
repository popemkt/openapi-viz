import { create } from 'zustand';
import type { ParsedSpec, ParseError, SourceMap } from '@/types';

interface SpecState {
  rawText: string;
  parsedSpec: ParsedSpec | null;
  parseErrors: ParseError[];
  sourceMap: SourceMap | null;
  fileName: string | null;
  isDirty: boolean;
  isLoading: boolean;

  setText: (text: string) => void;
  setParsedSpec: (spec: ParsedSpec | null, sourceMap: SourceMap | null, errors: ParseError[]) => void;
  loadFile: (content: string, fileName: string) => void;
  markSaved: () => void;
  reset: () => void;
  setLoading: (loading: boolean) => void;
}

const INITIAL_TEXT = `openapi: 3.1.0
info:
  title: Sample API
  version: 1.0.0
  description: A sample OpenAPI specification

paths:
  /users:
    get:
      summary: List all users
      operationId: listUsers
      tags:
        - Users
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
    post:
      summary: Create a new user
      operationId: createUser
      tags:
        - Users
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

  /users/{id}:
    get:
      summary: Get a user by ID
      operationId: getUser
      tags:
        - Users
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          description: Unique identifier
        name:
          type: string
          description: User's full name
        email:
          type: string
          format: email
          description: User's email address
        createdAt:
          type: string
          format: date-time
          description: Creation timestamp
      required:
        - id
        - name
        - email

    CreateUserRequest:
      type: object
      properties:
        name:
          type: string
          description: User's full name
        email:
          type: string
          format: email
          description: User's email address
      required:
        - name
        - email
`;

export const useSpecStore = create<SpecState>((set) => ({
  rawText: INITIAL_TEXT,
  parsedSpec: null,
  parseErrors: [],
  sourceMap: null,
  fileName: null,
  isDirty: false,
  isLoading: false,

  setText: (text) =>
    set({
      rawText: text,
      isDirty: true,
    }),

  setParsedSpec: (spec, sourceMap, errors) =>
    set({
      parsedSpec: spec,
      sourceMap,
      parseErrors: errors,
    }),

  loadFile: (content, fileName) =>
    set({
      rawText: content,
      fileName,
      isDirty: false,
      parsedSpec: null,
      parseErrors: [],
    }),

  markSaved: () =>
    set({
      isDirty: false,
    }),

  reset: () =>
    set({
      rawText: INITIAL_TEXT,
      parsedSpec: null,
      parseErrors: [],
      sourceMap: null,
      fileName: null,
      isDirty: false,
    }),

  setLoading: (isLoading) => set({ isLoading }),
}));
