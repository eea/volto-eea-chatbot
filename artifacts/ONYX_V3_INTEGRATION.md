# Onyx v3 Integration for Volto EEA Chatbot

This document summarizes the major architectural changes and features implemented to support **Onyx 3.x** while maintaining full backward compatibility with **Onyx 2.x**.

## 1. Version Switching & Configuration
- **Onyx Version Toggle**: Added a configuration setting in the Chat Block schema to switch between Onyx 2 and 3.
- **Dynamic Routing**: The `streamingService` now branches logic based on the selected version, targeting the appropriate API endpoints:
  - **v2**: `/send-message`
  - **v3**: `/send-chat-message`

## 2. Packet-Based Architecture (v3)
Implemented support for the new Onyx 3.x packet schema, which utilizes turn indices (`ind`) for better synchronization:
- **New Packet Types**: Integrated support for `search_tool_start`, `search_tool_queries_delta`, `search_tool_documents_delta`, `citation_info`, and `reasoning_done`.
- **Packet Normalization**: Developed a normalization layer in `streamingService.ts` to map v3 packets into the chatbot's internal `Packet` structure.
- **Turn Index Mapping**: Updated `MessageProcessor` to use explicit `ind` values from the backend for reliable turn completion detection, replacing the synthetic index fallback used in v2.

## 3. Streaming & UI Visibility
- **Eager Rendering**: Updated `MultiToolRenderer` and `SearchToolRenderer` to display search queries and documents as they arrive via delta packets, rather than waiting for tool completion.
- **Improved Context**: Added distinct labels for "Web Queries" and "Internal Search Queries" in the Search Tool UI.
- **Reasoning Support**: Enhanced `ReasoningRenderer` to handle v3 reasoning packets and provide a smoother transition between "thinking" and "answering" phases.

## 4. Related Questions (RQ) Restoration
- **Middleware Routing**: Updated the RQ workflow to route through the specialized `/_rq/` middleware proxy for both session creation and message sending.
- **Dedicated Sessions**: Ensured that Related Questions use a fresh chat session correctly targeting the QGen assistant on the appropriate version backend.
- **Completion Resiliency**: Patched a race condition where missing `section_end` packets for the main message turn would block RQ interrogation. The system now automatically synthesizes turn completion when the stream ends.

## 5. Middleware & Proxying
- **Proxy Expansion**: Synchronized `middleware.js` to handle both standard (`/_da/`) and related questions (`/_rq/`) paths for all v3 endpoints.
- **Payload Alignment**: Updated the payload builders to support v3-specific fields like `alternate_assistant_id`, `file_descriptors`, and `internal_search_filters`.

## 6. Bug Fixes & Stability
- **Citation Fallback**: Added a fallback for citations in v3 if explicit `citation_info` packets are missing, leveraging the `final_documents` array in `message_start`.
- **Typewriter Synchronization**: Adjusted `MessageTextRenderer` to coordinate with the new turn-based completion logic, ensuring the UI remains interactive.
- **Logging & Observability**: Injected comprehensive tracing logs (`[RQ]`, `[sendMessage]`, `[MessageProcessor]`) to monitor the end-to-end flow of packets.
