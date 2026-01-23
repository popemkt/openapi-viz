export const NEW_SPEC_TEMPLATE = `openapi: 3.1.0
info:
  title: New API
  version: 1.0.0
  description: A new OpenAPI specification

servers:
  - url: https://api.example.com/v1

paths:
  /example:
    get:
      summary: Example endpoint
      description: This is an example endpoint
      operationId: getExample
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExampleResponse'

components:
  schemas:
    ExampleResponse:
      type: object
      properties:
        message:
          type: string
          description: A message
        timestamp:
          type: string
          format: date-time
`;
