// // streaming-interruption.ts

// // Markdown comments are not directly translated to TypeScript,
// // but we'll use regular comments to explain the code.

// // # Streaming

// // ## Review

// // In module 2, we covered a few ways to customize graph state and memory.

// // We built up to a Chatbot with external memory that can sustain long-running conversations.

// // ## Goals

// // This module will dive into human-in-the-loop, which builds on memory and allows users to interact directly with graphs in various ways.

// // To set the stage for human-in-the-loop, we'll first dive into streaming, which provides several ways to visualize graph output (e.g., node state or chat model tokens) over the course of execution.

// // Note: Unlike Python's %pip, we'll assume necessary packages are installed via npm or yarn.
// // npm install @langchain/langgraph @langchain/openai @langchain/core @langchain/community

// // ## Streaming

// // LangGraph is built with [first class support for streaming](https://langchain-ai.github.io/langgraph/concepts/low_level/#streaming).

// // Let's set up our Chatbot from Module 2, and show various way to stream outputs from the graph during execution.

// import { ChatOpenAI } from "@langchain/openai";
// import {
//   HumanMessage,
//   SystemMessage,
//   AIMessage,
//   Schema,
//   FunctionMessage
// } from "@langchain/core/messages";
// import { RunnableConfig, } from "@langchain/core/runnables";
// import { StateGraph, END } from "@langchain/langgraph";
// import { ToolInvocationMessage } from "@langchain/core/messages";
// import { Client as LangGraphClient, Thread, ThreadState,  ThreadMessage, Run, StreamEvent,  } from "@langchain/langgraph-sdk";

// // In TypeScript, we typically use environment variables directly or a .env file with a library like dotenv.
// import 'dotenv/config'; // If using dotenv for environment variables

// function getEnvironmentVariable(varName: string): string {
//   const value = process.env[varName];
//   if (!value) {
//     throw new Error(`${varName} environment variable not set.`);
//   }
//   return value;
// }

// const OPENAI_API_KEY = getEnvironmentVariable("OPENAI_API_KEY");

// // Note that we use `RunnableConfig` with `call_model` to enable token-wise streaming.
// // This is [only needed with python < 3.11](https://langchain-ai.github.io/langgraph/how-tos/streaming-tokens/).
// // We include in case you are running this notebook in CoLab, which will use python 3.x.

// // LLM
// const model = new ChatOpenAI({
//   modelName: "gpt-4o-mini", //Updated model name as per latest changes
//   temperature: 0,
//   openAIApiKey: OPENAI_API_KEY
// });

// // State
// interface ChatState {
//   messages: Array<HumanMessage | AIMessage | SystemMessage | ToolInvocationMessage | FunctionMessage>;
//   summary?: string;
// }
// const state: Schema = {
//   type: "object",
//   properties: {
//       messages: {
//           type: "array",
//           items: {
//               "$ref": "#/definitions/ChatMessage"
//           },
//           default: []
//       },
//       summary: {
//           type: "string"
//       }
//   },
//   required: [
//       "messages"
//   ],
//   definitions: {
//       BaseMessage: {
//           type: "object",
//           properties: {
//               content: {
//                   type: "string"
//               },
//               role: {
//                   type: "string"
//               }
//           },
//           required: [
//               "content",
//               "role"
//           ],
//           "$ref": "#/pydantic__BaseMessage"
//       },
//       HumanMessage: {
//           allOf: [
//               {
//                   "$ref": "#/definitions/BaseMessage"
//               },
//               {
//                   type: "object",
//                   properties: {
//                       example: {
//                           type: "boolean",
//                           default: false
//                       }
//                   },
//                   title: "HumanMessage",
//                   $defs: {
//                       BaseMessage: {
//                           type: "object",
//                           properties: {
//                               content: {
//                                   type: "string"
//                               },
//                               role: {
//                                   type: "string"
//                               }
//                           },
//                           required: [
//                               "content",
//                               "role"
//                           ],
//                           "$ref": "#/pydantic__BaseMessage"
//                       }
//                   }
//               }
//           ]
//       },
//       AIMessage: {
//           allOf: [
//               {
//                   "$ref": "#/definitions/BaseMessage"
//               },
//               {
//                   type: "object",
//                   properties: {
//                       example: {
//                           type: "boolean",
//                           default: false
//                       },
//                       tool_calls: {
//                           title: "Tool Calls",
//                           anyOf: [
//                               {
//                                   type: "array",
//                                   items: {
//                                       "$ref": "#/definitions/ToolCall"
//                                   }
//                               },
//                               {
//                                   type: "null"
//                               }
//                           ]
//                       }
//                   },
//                   title: "AIMessage",
//                   $defs: {
//                       BaseMessage: {
//                           type: "object",
//                           properties: {
//                               content: {
//                                   type: "string"
//                               },
//                               role: {
//                                   type: "string"
//                               }
//                           },
//                           required: [
//                               "content",
//                               "role"
//                           ],
//                           "$ref": "#/pydantic__BaseMessage"
//                       },
//                       ToolCall: {
//                           title: "ToolCall",
//                           type: "object",
//                           properties: {
//                             id: {
//                               title: "Id",
//                               type: "string"
//                             },
//                             name: {
//                               title: "Name",
//                               type: "string"
//                             },
//                             args: {
//                               title: "Args",
//                               type: "string"
//                             }
//                           },
//                           required: [
//                             "id",
//                             "name",
//                             "args"
//                           ]
//                         }
//                   }
//               }
//           ]
//       },
//       FunctionMessage: {
//           allOf: [
//               {
//                   "$ref": "#/definitions/BaseMessage"
//               },
//               {
//                   type: "object",
//                   properties: {
//                       name: {
//                           title: "Name",
//                           type: "string"
//                       }
//                   },
//                   required: [
//                       "name"
//                   ],
//                   title: "FunctionMessage",
//                   $defs: {
//                       BaseMessage: {
//                           type: "object",
//                           properties: {
//                               content: {
//                                   type: "string"
//                               },
//                               role: {
//                                   type: "string"
//                               }
//                           },
//                           required: [
//                               "content",
//                               "role"
//                           ],
//                           "$ref": "#/pydantic__BaseMessage"
//                       }
//                   }
//               }
//           ]
//       },
//       ToolInvocationMessage: {
//           allOf: [
//               {
//                   "$ref": "#/definitions/BaseMessage"
//               },
//               {
//                   type: "object",
//                   properties: {
//                       tool_call_id: {
//                           title: "Tool Call Id",
//                           type: "string"
//                       }
//                   },
//                   required: [
//                       "tool_call_id"
//                   ],
//                   title: "ToolInvocationMessage",
//                   $defs: {
//                       BaseMessage: {
//                           type: "object",
//                           properties: {
//                               content: {
//                                   type: "string"
//                               },
//                               role: {
//                                   type: "string"
//                               }
//                           },
//                           required: [
//                               "content",
//                               "role"
//                           ],
//                           "$ref": "#/pydantic__BaseMessage"
//                       }
//                   }
//               }
//           ]
//       },
//       SystemMessage: {
//           allOf: [
//               {
//                   "$ref": "#/definitions/BaseMessage"
//               },
//               {
//                   type: "object",
//                   properties: {
//                       example: {
//                           type: "boolean",
//                           default: false
//                       }
//                   },
//                   title: "SystemMessage",
//                   $defs: {
//                       BaseMessage: {
//                           type: "object",
//                           properties: {
//                               content: {
//                                   type: "string"
//                               },
//                               role: {
//                                   type: "string"
//                               }
//                           },
//                           required: [
//                               "content",
//                               "role"
//                           ],
//                           "$ref": "#/pydantic__BaseMessage"
//                       }
//                   }
//               }
//           ]
//       },
//       ChatMessage: {
//           title: "ChatMessage",
//           anyOf: [
//               {
//                   "$ref": "#/definitions/HumanMessage"
//               },
//               {
//                   "$ref": "#/definitions/AIMessage"
//               },
//               {
//                   "$ref": "#/definitions/FunctionMessage"
//               },
//               {
//                   "$ref": "#/definitions/ToolInvocationMessage"
//               },
//               {
//                   "$ref": "#/definitions/SystemMessage"
//               }
//           ]
//       }
//   }
// }
// // Define the logic to call the model
// async function callModel(state: ChatState, config: RunnableConfig): Promise<{ messages: AIMessage }> {
//   const summary = state.summary || "";
//   let messages: (HumanMessage | AIMessage | SystemMessage)[];

//   if (summary) {
//     const systemMessage = `Summary of conversation earlier: ${summary}`;
//     messages = [new SystemMessage(systemMessage), ...state.messages];
//   } else {
//     messages = state.messages;
//   }

//   const response = await model.invoke(messages, config);
//   return { messages: response };
// }

// async function summarizeConversation(state: ChatState): Promise<ChatState> {
//   let summary = state.summary || "";
//   let summaryMessage: string;

//   if (summary) {
//     summaryMessage = `This is summary of the conversation to date: ${summary}\n\nExtend the summary by taking into account the new messages above:`;
//   } else {
//     summaryMessage = "Create a summary of the conversation above:";
//   }

//   const messages = [...state.messages, new HumanMessage(summaryMessage)];
//   const response = await model.invoke(messages);

//   const newMessages = state.messages.slice(-2)

//   return {
//     summary: response.content,
//     messages: newMessages
//   };
// }

// // Determine whether to end or summarize the conversation
// function shouldContinue(state: ChatState): string | undefined {
//   const messages = state.messages;

//   if (messages.length > 6) {
//     return "summarize_conversation";
//   }

//   return END;
// }

// // Define a new graph
// const workflow = new StateGraph({
//   channels: state
// });
// workflow.addNode("conversation", callModel);
// workflow.addNode("summarize_conversation", summarizeConversation);

// workflow.setEntryPoint("conversation");
// workflow.addConditionalEdges("conversation", shouldContinue, {
//   summarize_conversation: "summarize_conversation",
//   [END]: END,
// });
// workflow.addEdge("summarize_conversation", END);

// // Compile
// // Note: MemorySaver equivalent might need a custom implementation or a different approach in TypeScript.
// const graph = workflow.compile();

// // ### Streaming full state

// // Now, let's talk about ways to [stream our graph state](https://langchain-ai.github.io/langgraph/concepts/low_level/#streaming).

// // `.stream` and `.astream` are sync and async methods for streaming back results.

// // LangGraph supports a few [different streaming modes](https://langchain-ai.github.io/langgraph/how-tos/stream-values/) for [graph state](https://langchain-ai.github.io/langgraph/how-tos/stream-values/):

// // * `values`: This streams the full state of the graph after each node is called.
// // * `updates`: This streams updates to the state of the graph after each node is called.

// // ![values_vs_updates.png](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbaf892d24625a201744e5_streaming1.png)

// // Let's look at `stream_mode="updates"`.

// // Because we stream with `updates`, we only see updates to the state after node in the graph is run.

// // Each `chunk` is a dict with `node_name` as the key and the updated state as the value.

// // Create a thread
// const config: RunnableConfig = { configurable: { thread_id: "1" } };

// // Start conversation
// async function streamUpdates() {
//   const stream = await graph.stream({ messages: [new HumanMessage("hi! I'm Lance")] }, {
//     ...config,
//   });

//   for await (const chunk of stream) {
//       if (!chunk.has("summarize_conversation") && chunk.has("conversation")) {

//         console.log(chunk.get("conversation"));
//       }
//   }
// }

// streamUpdates();

// // Let's now just print the state update.
// async function printStateUpdate() {
//     const stream = await graph.stream({ messages: [new HumanMessage("hi! I'm Lance")] }, {
//         ...config,
//     });
//     for await (const chunk of stream) {
//       if (!chunk.has("summarize_conversation") && chunk.has("conversation")) {
//         const conv = chunk.get("conversation")
//         if(conv){
//           console.log(conv.messages)
//         }
//       }
//     }
// }

// printStateUpdate();

// // Now, we can see `stream_mode="values"`.

// // This is the `full state` of the graph after the `conversation` node is called.

// async function streamValues() {
//   const config: RunnableConfig = { configurable: { thread_id: "2" } };
//   const inputMessage = new HumanMessage("hi! I'm Lance");
//   const stream = await graph.stream({ messages: [inputMessage] }, {
//     ...config,
//   });
//   for await (const event of stream) {
//     console.log(event);
//     console.log("---".repeat(25));
//   }
// }

// streamValues();

// // ### Streaming tokens

// // We often want to stream more than graph state.

// // In particular, with chat model calls it is common to stream the tokens as they are generated.

// // We can do this [using the `.astream_events` method](https://langchain-ai.github.io/langgraph/how-tos/streaming-from-final-node/#stream-outputs-from-the-final-node), which streams back events as they happen inside nodes!

// // Each event is a dict with a few keys:

// // * `event`: This is the type of event that is being emitted.
// // * `name`: This is the name of event.
// // * `data`: This is the data associated with the event.
// // * `metadata`: Contains`langgraph_node`, the node emitting the event.

// // Let's have a look.

// async function streamEvents() {
//   const config: RunnableConfig = { configurable: { thread_id: "3" } };
//   const inputMessage = new HumanMessage("Tell me about the 49ers NFL team");

//   const eventsStream = await graph.stream({ messages: [inputMessage] }, {
//     ...config,
//   });
//   for await (const event of eventsStream) {
//     if(event.has("conversation")){
//       const conv = event.get("conversation")
//       if (conv){
//         const ev = conv.messages.content
//         console.log(ev)
//       }
//     }

//   }
// }

// streamEvents();

// // The central point is that tokens from chat models within your graph have the `on_chat_model_stream` type.

// // We can use `event['metadata']['langgraph_node']` to select the node to stream from.

// // And we can use `event['data']` to get the actual data for each event, which in this case is an `AIMessageChunk`.

// async function streamFromNode() {
//     const nodeToStream = "conversation";
//     const config: RunnableConfig = { configurable: { thread_id: "4" } };
//     const inputMessage = new HumanMessage("Tell me about the 49ers NFL team");
//     const eventsStream = await graph.stream({ messages: [inputMessage] }, {
//         ...config,
//     });
//     for await (const event of eventsStream) {
//       if(event.has("conversation")){
//         const conv = event.get("conversation")
//         if (conv){
//           const ev = conv.messages.content
//           console.log(ev)
//         }
//       }
//     }
// }

// streamFromNode();

// // As you see above, just use the `chunk` key to get the `AIMessageChunk`.

// async function streamAIMessageChunk() {
//   const nodeToStream = "conversation";
//   const config: RunnableConfig = { configurable: { thread_id: "5" } };
//   const inputMessage = new HumanMessage("Tell me about the 49ers NFL team");
//   const eventsStream = await graph.stream({ messages: [inputMessage] }, {
//     ...config,
// });
// for await (const event of eventsStream) {
//   if(event.has("conversation")){
//     const conv = event.get("conversation")
//     if (conv){
//       const ev = conv.messages.content
//       console.log(ev)
//     }
//   }
// }
// }

// streamAIMessageChunk();

// // ### Streaming with LangGraph API

// // --

// // **⚠️ DISCLAIMER**

// // *Running Studio currently requires a Mac. If you are not using a Mac, then skip this step.*

// // *Also, if you are running this notebook in CoLab, then skip this step.*

// // --

// // The LangGraph API [has first class support for streaming](https://langchain-ai.github.io/langgraph/cloud/concepts/api/#streaming).

// // Let's load our `agent` in the Studio UI, which uses `module-3/studio/agent.py` set in `module-3/studio/langgraph.json`.

// // The LangGraph API serves as the back-end for Studio.

// // We can interact directly with the LangGraph API via the LangGraph SDK.

// // We just need to get the URL for the local deployment from Studio.

// // ![Screenshot 2024-08-27 at 2.20.34 PM.png](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbaf8943c3d4df239cbf0f_streaming2.png)

// // Note: Skipping platform check as it's not relevant for TypeScript execution environment.

// // Replace this with the URL of your own deployed graph
// const URL = "http://localhost:8000"; // Replace with your actual URL if different
// const client = new LangGraphClient({
//   url: URL,
// });

// async function searchAssistants() {
//   const assistants = await client.assistants.search();
//   console.log(assistants);
// }

// searchAssistants();

// // Let's [stream `values`](https://langchain-ai.github.io/langgraph/cloud/how-tos/stream_values/), like before.

// async function streamValuesFromAPI() {
//   const thread: Thread = await client.threads.create();
//   const inputMessage = new HumanMessage("Multiply 2 and 3");
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: { messages: [inputMessage] },
//     stream_mode: "values",
//   });

//   for await (const event of stream) {
//     console.log(event);
//   }
// }

// streamValuesFromAPI();

// // The streamed objects have:

// // * `event`: Type
// // * `data`: State

// async function printStateFromAPI() {
//   const thread: Thread = await client.threads.create();
//   const inputMessage = new HumanMessage("Multiply 2 and 3");
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: { messages: [inputMessage] },
//     stream_mode: "values",
//   });

//   for await (const event of stream) {

//     const messages = event.data.messages || null;
//     if (messages) {
//       console.log(messages.slice(-1))
//     }
//     console.log("=".repeat(25));
//   }
// }

// printStateFromAPI();

// // There are some new streaming mode that are only supported via the API.

// // For example, we can [use `messages` mode](https://langchain-ai.github.io/langgraph/cloud/how-tos/stream_messages/) to better handle the above case!

// // This mode currently assumes that you have a `messages` key in your graph, which is a list of messages.

// // All events emitted using `messages` mode have two attributes:

// // * `event`: This is the name of the event
// // * `data`: This is data associated with the event

// async function streamMessagesFromAPI() {
//   const thread = await client.threads.create();
//   const inputMessage = new HumanMessage("Multiply 2 and 3");
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: { messages: [inputMessage] },
//     stream_mode: "messages",
//   });

//   for await (const event of stream) {
//     console.log(event.event);
//   }
// }

// streamMessagesFromAPI();

// // We can see a few events:

// // * `metadata`: metadata about the run
// // * `messages/complete`: fully formed message
// // * `messages/partial`: chat model tokens

// // You can dig further into the types [here](https://langchain-ai.github.io/langgraph/cloud/concepts/api/#modemessages).

// // Now, let's show how to stream these messages.

// // We'll define a helper function for better formatting of the tool calls in messages.

// function formatToolCalls(toolCalls: any[]): string {
//   if (toolCalls && toolCalls.length > 0) {
//     const formattedCalls = toolCalls.map(
//       (call) =>
//         `Tool Call ID: ${call.id}, Function: ${call.name}, Arguments: ${call.args}`
//     );
//     return formattedCalls.join("\n");
//   }
//   return "No tool calls";
// }

// async function streamAndFormatMessages() {
//   const thread = await client.threads.create();
//   const inputMessage = new HumanMessage("Multiply 2 and 3");
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: { messages: [inputMessage] },
//     stream_mode: "messages",
//   });

//   for await (const event of stream) {
//     if (event.event === "metadata") {
//       console.log(`Metadata: Run ID - ${event.data.run_id}`);
//       console.log("-".repeat(50));
//     } else if (event.event === "messages/partial") {
//       for (const dataItem of event.data) {
//         if (dataItem.role && dataItem.role === "user") {
//           console.log(`Human: ${dataItem.content}`);
//         } else {
//           const toolCalls = dataItem.tool_calls || [];
//           const invalidToolCalls = dataItem.invalid_tool_calls || [];
//           const content = dataItem.content || "";
//           const responseMetadata = dataItem.response_metadata || {};

//           if (content) {
//             console.log(`AI: ${content}`);
//           }

//           if (toolCalls.length > 0) {
//             console.log("Tool Calls:");
//             console.log(formatToolCalls(toolCalls));
//           }

//           if (invalidToolCalls.length > 0) {
//             console.log("Invalid Tool Calls:");
//             console.log(formatToolCalls(invalidToolCalls));
//           }

//           if (Object.keys(responseMetadata).length > 0) {
//             const finishReason = responseMetadata.finish_reason || "N/A";
//             console.log(`Response Metadata: Finish Reason - ${finishReason}`);
//           }
//         }
//       }
//       console.log("-".repeat(50));
//     }
//   }
// }

// streamAndFormatMessages();
