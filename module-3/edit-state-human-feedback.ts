// // edit-state-human-feedback.ts

// // Markdown comments are not directly translated to TypeScript,
// // but we'll use regular comments to explain the code.

// // # Editing graph state

// // ## Review

// // We discussed motivations for human-in-the-loop:

// // (1) `Approval` - We can interrupt our agent, surface state to a user, and allow the user to accept an action

// // (2) `Debugging` - We can rewind the graph to reproduce or avoid issues

// // (3) `Editing` - You can modify the state

// // We showed how breakpoints support user approval, but don't yet know how to modify our graph state once our graph is interrupted!

// // ## Goals

// // Now, let's show how to directly edit the graph state and insert human feedback.

// // Note: Unlike Python's %pip, we'll assume necessary packages are installed via npm or yarn.
// // npm install @langchain/langgraph @langchain/openai @langchain/core @langchain/community

// import { ChatOpenAI } from "@langchain/openai";
// import {
//   HumanMessage,
//   SystemMessage,
//   AIMessage,
//   FunctionMessage,
//   ToolInvocationMessage,
//   ToolInvocation,
//   Schema,
// } from "@langchain/core/messages";
// import { RunnableConfig } from "@langchain/core/runnables";
// import { StateGraph, END } from "@langchain/langgraph";
// import {
//   ToolExecutor,
//   formatToOpenAIFunction,
// } from "@langchain/core/utils/function_calling";
// import {
//   Client as LangGraphClient,
//   Thread,
//   ThreadState,
//   ThreadMessage,
//   Run,
//   StreamEvent,
// } from "@langchain/langgraph-sdk";
// import { DynamicStructuredTool } from "@langchain/core/tools";

// // In TypeScript, we typically use environment variables directly or a .env file with a library like dotenv.
// import "dotenv/config"; // If using dotenv for environment variables
// import { z } from "zod";

// function getEnvironmentVariable(varName: string): string {
//   const value = process.env[varName];
//   if (!value) {
//     throw new Error(`${varName} environment variable not set.`);
//   }
//   return value;
// }

// const OPENAI_API_KEY = getEnvironmentVariable("OPENAI_API_KEY");

// // ## Editing state

// // Previously, we introduced breakpoints.

// // We used them to interrupt the graph and await user approval before executing the next node.

// // But breakpoints are also [opportunities to modify the graph state](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/edit-graph-state/).

// // Let's set up our agent with a breakpoint before the `assistant` node.

// function multiply(args: { a: number; b: number }) {
//   return args.a * args.b;
// }
// // This will be a tool
// function add(args: { a: number; b: number }) {
//   return args.a + args.b;
// }
// function divide(args: { a: number; b: number }) {
//   return args.a / args.b;
// }

// const multiplyTool = new DynamicStructuredTool({
//   name: "multiply",
//   description: "multiply two numbers",
//   schema: z.object({
//     a: z.number().describe("the first number"),
//     b: z.number().describe("the second number"),
//   }),
//   func: multiply,
//   returnDirect: false,
// });
// const addTool = new DynamicStructuredTool({
//   name: "add",
//   description: "add two numbers",
//   schema: z.object({
//     a: z.number().describe("the first number"),
//     b: z.number().describe("the second number"),
//   }),
//   func: add,
//   returnDirect: false,
// });
// const divideTool = new DynamicStructuredTool({
//   name: "divide",
//   description: "divide two numbers",
//   schema: z.object({
//     a: z.number().describe("the first number"),
//     b: z.number().describe("the second number"),
//   }),
//   func: divide,
//   returnDirect: false,
// });
// const tools = [multiplyTool, addTool, divideTool];

// const llm = new ChatOpenAI({
//   modelName: "gpt-4o-mini",
//   temperature: 0,
//   openAIApiKey: OPENAI_API_KEY,
// });
// const llm_with_tools = llm.bind({
//   tools: tools.map(formatToOpenAIFunction),
// });

// // System message
// const sysMsg = new SystemMessage(
//   "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
// );

// // State
// interface ChatState {
//   messages: Array<
//     | HumanMessage
//     | AIMessage
//     | SystemMessage
//     | ToolInvocationMessage
//     | FunctionMessage
//   >;
// }
// const state: Schema = {
//   type: "object",
//   properties: {
//     messages: {
//       type: "array",
//       items: {
//         $ref: "#/definitions/ChatMessage",
//       },
//       default: [],
//     },
//   },
//   required: ["messages"],
//   definitions: {
//     BaseMessage: {
//       type: "object",
//       properties: {
//         content: {
//           type: "string",
//         },
//         role: {
//           type: "string",
//         },
//       },
//       required: ["content", "role"],
//       $ref: "#/pydantic__BaseMessage",
//     },
//     HumanMessage: {
//       allOf: [
//         {
//           $ref: "#/definitions/BaseMessage",
//         },
//         {
//           type: "object",
//           properties: {
//             example: {
//               type: "boolean",
//               default: false,
//             },
//           },
//           title: "HumanMessage",
//           $defs: {
//             BaseMessage: {
//               type: "object",
//               properties: {
//                 content: {
//                   type: "string",
//                 },
//                 role: {
//                   type: "string",
//                 },
//               },
//               required: ["content", "role"],
//               $ref: "#/pydantic__BaseMessage",
//             },
//           },
//         },
//       ],
//     },
//     AIMessage: {
//       allOf: [
//         {
//           $ref: "#/definitions/BaseMessage",
//         },
//         {
//           type: "object",
//           properties: {
//             example: {
//               type: "boolean",
//               default: false,
//             },
//             tool_calls: {
//               title: "Tool Calls",
//               anyOf: [
//                 {
//                   type: "array",
//                   items: {
//                     $ref: "#/definitions/ToolCall",
//                   },
//                 },
//                 {
//                   type: "null",
//                 },
//               ],
//             },
//           },
//           title: "AIMessage",
//           $defs: {
//             BaseMessage: {
//               type: "object",
//               properties: {
//                 content: {
//                   type: "string",
//                 },
//                 role: {
//                   type: "string",
//                 },
//               },
//               required: ["content", "role"],
//               $ref: "#/pydantic__BaseMessage",
//             },
//             ToolCall: {
//               title: "ToolCall",
//               type: "object",
//               properties: {
//                 id: {
//                   title: "Id",
//                   type: "string",
//                 },
//                 name: {
//                   title: "Name",
//                   type: "string",
//                 },
//                 args: {
//                   title: "Args",
//                   type: "string",
//                 },
//               },
//               required: ["id", "name", "args"],
//             },
//           },
//         },
//       ],
//     },
//     FunctionMessage: {
//       allOf: [
//         {
//           $ref: "#/definitions/BaseMessage",
//         },
//         {
//           type: "object",
//           properties: {
//             name: {
//               title: "Name",
//               type: "string",
//             },
//           },
//           required: ["name"],
//           title: "FunctionMessage",
//           $defs: {
//             BaseMessage: {
//               type: "object",
//               properties: {
//                 content: {
//                   type: "string",
//                 },
//                 role: {
//                   type: "string",
//                 },
//               },
//               required: ["content", "role"],
//               $ref: "#/pydantic__BaseMessage",
//             },
//           },
//         },
//       ],
//     },
//     ToolInvocationMessage: {
//       allOf: [
//         {
//           $ref: "#/definitions/BaseMessage",
//         },
//         {
//           type: "object",
//           properties: {
//             tool_call_id: {
//               title: "Tool Call Id",
//               type: "string",
//             },
//           },
//           required: ["tool_call_id"],
//           title: "ToolInvocationMessage",
//           $defs: {
//             BaseMessage: {
//               type: "object",
//               properties: {
//                 content: {
//                   type: "string",
//                 },
//                 role: {
//                   type: "string",
//                 },
//               },
//               required: ["content", "role"],
//               $ref: "#/pydantic__BaseMessage",
//             },
//           },
//         },
//       ],
//     },
//     SystemMessage: {
//       allOf: [
//         {
//           $ref: "#/definitions/BaseMessage",
//         },
//         {
//           type: "object",
//           properties: {
//             example: {
//               type: "boolean",
//               default: false,
//             },
//           },
//           title: "SystemMessage",
//           $defs: {
//             BaseMessage: {
//               type: "object",
//               properties: {
//                 content: {
//                   type: "string",
//                 },
//                 role: {
//                   type: "string",
//                 },
//               },
//               required: ["content", "role"],
//               $ref: "#/pydantic__BaseMessage",
//             },
//           },
//         },
//       ],
//     },
//     ChatMessage: {
//       title: "ChatMessage",
//       anyOf: [
//         {
//           $ref: "#/definitions/HumanMessage",
//         },
//         {
//           $ref: "#/definitions/AIMessage",
//         },
//         {
//           $ref: "#/definitions/FunctionMessage",
//         },
//         {
//           $ref: "#/definitions/ToolInvocationMessage",
//         },
//         {
//           $ref: "#/definitions/SystemMessage",
//         },
//       ],
//     },
//   },
// };
// // Node
// async function assistant(state: ChatState): Promise<{ messages: AIMessage[] }> {
//   const response = await llm_with_tools.invoke([sysMsg, ...state.messages]);
//   return { messages: [response] };
// }

// function tools_condition(state: ChatState) {
//   const messages = state.messages;
//   const lastMessage = messages[messages.length - 1];

//   if (!lastMessage) {
//     return;
//   }
//   if (
//     !lastMessage.content &&
//     "tool_calls" in lastMessage &&
//     lastMessage.tool_calls &&
//     lastMessage.tool_calls.length > 0
//   ) {
//     return "tools";
//   } else {
//     return END;
//   }
// }

// async function toolNode(
//   state: ChatState
// ): Promise<{ [key: string]: FunctionMessage[] }> {
//   const messages = state.messages;
//   const toolExecutor = new ToolExecutor({
//     tools: tools,
//   });
//   const newMessages = await toolExecutor.invoke(messages);
//   return {
//     messages: newMessages,
//   };
// }

// // Graph
// const builder = new StateGraph({
//   channels: state,
// });

// // Define nodes: these do the work
// builder.addNode("assistant", assistant);
// builder.addNode("tools", toolNode);

// // Define edges: these determine the control flow
// builder.setEntryPoint("assistant");
// builder.addConditionalEdges("assistant", tools_condition);
// builder.addEdge("tools", "assistant");

// const graph = builder.compile();

// // Let's run!

// // We can see the graph is interrupted before the chat model responds.

// // Input
// const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };

// // Thread
// const threadConfig = { configurable: { thread_id: "1" } };

// // Run the graph until the first interruption
// async function runUntilInterruption() {
//   const events = await graph.stream(initialInput, threadConfig);
//   for await (const event of events) {
//     if (event.has("messages")) {
//       const newMessages = event.get("messages");
//       if (newMessages) {
//         console.log(newMessages);
//       }
//     }
//   }
// }

// runUntilInterruption();

// // Now, we can directly apply a state update.

// // Remember, updates to the `messages` key will use the `add_messages` reducer:

// // * If we want to over-write the existing message, we can supply the message `id`.
// // * If we simply want to append to our list of messages, then we can pass a message without an `id` specified, as shown below.

// async function updateState() {
//   const events = await graph.stream(initialInput, threadConfig);
//   for await (const event of events) {
//     if (event.has("messages")) {
//       const newMessages = event.get("messages");
//       if (newMessages) {
//         const new_messages: any = newMessages;
//         const updatedMessages = [
//           ...new_messages,
//           new HumanMessage("No, actually multiply 3 and 3!"),
//         ];
//         const updatedState = { messages: updatedMessages };
//         const newEvents = await graph.stream(updatedState, threadConfig);
//         for await (const newEvent of newEvents) {
//           console.log(newEvent);
//         }
//       }
//     }
//   }
// }

// updateState();

// // Let's have a look.

// // We called `update_state` with a new message.

// // The `add_messages` reducer appends it to our state key, `messages`.
// //Managed in the previous function

// // Now, let's proceed with our agent, simply by passing `None` and allowing it proceed from the current state.

// // We emit the current and then proceed to execute the remaining nodes.
// //Managed in the previous function

// // Now, we're back at the `assistant`, which has our `breakpoint`.

// // We can again pass `None` to proceed.
// //Managed in the previous function

// // ### Editing graph state in Studio

// // --

// // **⚠️ DISCLAIMER**

// // *Running Studio currently requires a Mac. If you are not using a Mac, then skip this step.*

// // *Also, if you are running this notebook in CoLab, then skip this step.*

// // --

// // Let's load our `agent` in the Studio UI, which uses `module-3/studio/agent.py` set in `module-3/studio/langgraph.json`.

// // ### Editing graph state with LangGraph API

// // We can interact with our agent via the SDK.

// // ![Screenshot 2024-08-26 at 9.59.19 AM.png](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbaf2fbfb576f8e53ed930_edit-state-human-feedback1.png)

// // Let's get the URL for the local deployment from Studio.

// // The LangGraph API [supports editing graph state](https://langchain-ai.github.io/langgraph/cloud/how-tos/human_in_the_loop_edit_state/#initial-invocation).

// // Note: Skipping platform check as it's not relevant for TypeScript execution environment.

// const client = new LangGraphClient({
//   url: "http://localhost:8000", // Replace with your actual URL
// });

// // Our agent is defined in `assistant/agent.py`.

// // If you look at the code, you'll see that it *does not* have a breakpoint!

// // Of course, we can add it to `agent.py`, but one very nice feature of the API is that we can pass in a breakpoint!

// // Here, we pass a `interrupt_before=["assistant"]`.

// async function runWithInterruption() {
//   const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };
//   const thread: Thread = await client.threads.create();
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: initialInput,
//     stream_mode: "values",
//     interrupt_before: ["assistant"],
//   });

//   for await (const chunk of stream) {
//     console.log(`Receiving new event of type: ${chunk.event}...`);
//     const messages = chunk.data.messages || [];
//     if (messages.length > 0) {
//       console.log(messages[messages.length - 1]);
//     }
//     console.log("-".repeat(50));
//   }
// }

// runWithInterruption();

// // We can get the current state

// async function getCurrentState() {
//   const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };
//   const thread: Thread = await client.threads.create();
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: initialInput,
//     stream_mode: "values",
//     interrupt_before: ["assistant"],
//   });

//   for await (const chunk of stream) {
//     console.log(`Receiving new event of type: ${chunk.event}...`);
//     const messages = chunk.data.messages || [];
//     if (messages.length > 0) {
//       console.log(messages[messages.length - 1]);
//     }
//     console.log("-".repeat(50));
//     const currentState = await client.threads.get_state(thread.thread_id);
//     console.log(currentState);
//   }
// }

// getCurrentState();

// // We can look at the last message in state.

// async function getLastMessage() {
//   const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };
//   const thread: Thread = await client.threads.create();
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: initialInput,
//     stream_mode: "values",
//     interrupt_before: ["assistant"],
//   });

//   for await (const chunk of stream) {
//     console.log(`Receiving new event of type: ${chunk.event}...`);
//     const messages = chunk.data.messages || [];
//     if (messages.length > 0) {
//       console.log(messages[messages.length - 1]);
//     }
//     console.log("-".repeat(50));
//     const currentState = await client.threads.get_state(thread.thread_id);
//     const lastMessage = currentState.values.messages.slice(-1)[0];
//     console.log(lastMessage);
//   }
// }

// getLastMessage();

// // We can edit it!

// async function editLastMessage() {
//   const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };
//   const thread: Thread = await client.threads.create();
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: initialInput,
//     stream_mode: "values",
//     interrupt_before: ["assistant"],
//   });

//   for await (const chunk of stream) {
//     console.log(`Receiving new event of type: ${chunk.event}...`);
//     const messages = chunk.data.messages || [];
//     if (messages.length > 0) {
//       console.log(messages[messages.length - 1]);
//     }
//     console.log("-".repeat(50));
//     const currentState = await client.threads.get_state(thread.thread_id);
//     const lastMessage = currentState.values.messages.slice(-1)[0];
//     lastMessage.content = "No, actually multiply 3 and 3!";
//     console.log(lastMessage);
//   }
// }

// editLastMessage();

// // Remember, as we said before, updates to the `messages` key will use the same `add_messages` reducer.

// // If we want to over-write the existing message, then we can supply the message `id`.

// // Here, we did that. We only modified the message `content`, as shown above.

// async function updateStateAPI() {
//   const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };
//   const thread: Thread = await client.threads.create();
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: initialInput,
//     stream_mode: "values",
//     interrupt_before: ["assistant"],
//   });

//   for await (const chunk of stream) {
//     console.log(`Receiving new event of type: ${chunk.event}...`);
//     const messages = chunk.data.messages || [];
//     if (messages.length > 0) {
//       console.log(messages[messages.length - 1]);
//     }
//     console.log("-".repeat(50));
//     const currentState = await client.threads.get_state(thread.thread_id);
//     const lastMessage = currentState.values.messages.slice(-1)[0];
//     lastMessage.content = "No, actually multiply 3 and 3!";
//     await client.threads.patch_state(thread.thread_id, {
//       messages: [lastMessage],
//     });
//   }
// }

// updateStateAPI();

// // Now, we resume by passing `None`.

// async function resumeExecution() {
//   const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };
//   const thread: Thread = await client.threads.create();
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: initialInput,
//     stream_mode: "values",
//     interrupt_before: ["assistant"],
//   });

//   for await (const chunk of stream) {
//     console.log(`Receiving new event of type: ${chunk.event}...`);
//     const messages = chunk.data.messages || [];
//     if (messages.length > 0) {
//       console.log(messages[messages.length - 1]);
//     }
//     console.log("-".repeat(50));
//     const currentState = await client.threads.get_state(thread.thread_id);
//     const lastMessage = currentState.values.messages.slice(-1)[0];
//     lastMessage.content = "No, actually multiply 3 and 3!";
//     await client.threads.patch_state(thread.thread_id, {
//       messages: [lastMessage],
//     });
//     const newStream = await client.runs.stream(thread.thread_id, "agent", {
//       input: null,
//       stream_mode: "values",
//       interrupt_before: ["assistant"],
//     });
//     for await (const newChunk of newStream) {
//       console.log(`Receiving new event of type: ${newChunk.event}...`);
//       const newMessages = newChunk.data.messages || [];
//       if (newMessages.length > 0) {
//         console.log(newMessages[newMessages.length - 1]);
//       }
//       console.log("-".repeat(50));
//     }
//   }
// }

// resumeExecution();

// // We get the result of the tool call as `9`, as expected.
// //Managed in the previous function

// // ## Awaiting user input

// // So, it's clear that we can edit our agent state after a breakpoint.

// // Now, what if we want to allow for human feedback to perform this state update?

// // We'll add a node that [serves as a placeholder for human feedback](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/wait-user-input/#setup) within our agent.

// // This `human_feedback` node allow the user to add feedback directly to state.

// // We specify the breakpoint using `interrupt_before` our `human_feedback` node.

// // We set up a checkpointer to save the state of the graph up until this node.

// // no-op node that should be interrupted on
// function humanFeedback(state: ChatState): void {
//   // Placeholder for human feedback
// }

// // Assistant node
// async function assistantNode(
//   state: ChatState
// ): Promise<{ messages: AIMessage[] }> {
//   const response = await llm_with_tools.invoke([sysMsg, ...state.messages]);
//   return { messages: [response] };
// }

// // Graph
// const builder2 = new StateGraph({
//   channels: state,
// });

// // Define nodes: these do the work
// builder2.addNode("assistant", assistantNode);
// builder2.addNode("tools", toolNode);
// builder2.addNode("human_feedback", humanFeedback);

// // Define edges: these determine the control flow
// builder2.setEntryPoint("human_feedback");
// builder2.addEdge("human_feedback", "assistant");
// builder2.addConditionalEdges("assistant", tools_condition);
// builder2.addEdge("tools", "human_feedback");

// const graph2 = builder2.compile();

// // We will get feedback from the user.

// // We use `.update_state` to update the state of the graph with the human response we get, as before.

// // We use the `as_node="human_feedback"` parameter to apply this state update as the specified node, `human_feedback`.

// // Input
// const initialInput2 = { messages: [new HumanMessage("Multiply 2 and 3")] };

// // Thread
// const threadConfig2 = { configurable: { thread_id: "5" } };

// // Run the graph until the first interruption
// async function runWithHumanFeedback() {
//   const events = await graph2.stream(initialInput2, threadConfig2);

//   for await (const event of events) {
//     if (event.has("messages")) {
//       const newMessages = event.get("messages");
//       if (newMessages) {
//         console.log(newMessages);
//       }
//     }
//   }

//   // Simulate getting user input
//   const userInput = "No, actually multiply 3 and 3!";

//   // Update the state as if we are the human_feedback node
//   // This is a simulation; in a real application, you would likely need a more sophisticated state management approach

//   const updatedMessages = [
//     ...initialInput2.messages,
//     new HumanMessage(userInput),
//   ];
//   const updatedState = { messages: updatedMessages };

//   const newEvents = await graph2.stream(updatedState, threadConfig2);
//   for await (const newEvent of newEvents) {
//     console.log(newEvent);
//   }
// }

// runWithHumanFeedback();
