// // breakpoints.ts

// // Markdown comments are not directly translated to TypeScript,
// // but we'll use regular comments to explain the code.

// // # Breakpoints

// // ## Review

// // For `human-in-the-loop`, we often want to see our graph outputs as its running.

// // We laid the foundations for this with streaming.

// // ## Goals

// // Now, let's talk about the motivations for `human-in-the-loop`:

// // (1) `Approval` - We can interrupt our agent, surface state to a user, and allow the user to accept an action

// // (2) `Debugging` - We can rewind the graph to reproduce or avoid issues

// // (3) `Editing` - You can modify the state

// // LangGraph offers several ways to get or update agent state to support various `human-in-the-loop` workflows.

// // First, we'll introduce [breakpoints](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/breakpoints/#simple-usage), which provide a simple way to stop the graph at specific steps.

// // We'll show how this enables user `approval`.

// // Note: Unlike Python's %pip, we'll assume necessary packages are installed via npm or yarn.
// // npm install @langchain/langgraph @langchain/openai @langchain/core @langchain/community

// // In TypeScript, we typically use environment variables directly or a .env file with a library like dotenv.
// import "dotenv/config"; // If using dotenv for environment variables

// import * as readline from "readline";

// import {
//   AIMessage,
//   FunctionMessage,
//   HumanMessage,
//   Schema,
//   SystemMessage,
//   ToolInvocationMessage,
// } from "@langchain/core/messages";
// import { END, StateGraph } from "@langchain/langgraph";
// import {
//   Client as LangGraphClient,
//   Run,
//   StreamEvent,
//   Thread,
//   ThreadMessage,
//   ThreadState,
// } from "@langchain/langgraph-sdk";
// import {
//   ToolExecutor,
//   formatToOpenAIFunction,
// } from "@langchain/core/utils/function_calling";
// import { stdin, stdout } from "process";

// import { ChatOpenAI } from "@langchain/openai";
// import { DynamicStructuredTool } from "@langchain/core/tools";
// import { RunnableConfig } from "@langchain/core/runnables";
// import { z } from "zod";

// function getEnvironmentVariable(varName: string): string {
//   const value = process.env[varName];
//   if (!value) {
//     throw new Error(`${varName} environment variable not set.`);
//   }
//   return value;
// }

// const OPENAI_API_KEY = getEnvironmentVariable("OPENAI_API_KEY");

// // ## Breakpoints for human approval

// // Let's re-consider the simple agent that we worked with in Module 1.

// // Let's assume that are concerned about tool use: we want to approve the agent to use any of its tools.

// // All we need to do is simply compile the graph with `interrupt_before=["tools"]` where `tools` is our tools node.

// // This means that the execution will be interrupted before the node `tools`, which executes the tool call.

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

// const graph = builder.compile({
//   interrupt_before: ["tools"],
// });

// // Input
// const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };

// // Thread
// const threadConfig = { configurable: { thread_id: "1" } };

// // Run the graph until the first interruption
// async function runUntilFirstInterruption() {
//   const events = await graph.stream(initialInput, threadConfig);
//   for await (const event of events) {
//     if (event.has("messages")) {
//       console.log(event.get("messages"));
//     }
//   }
// }

// runUntilFirstInterruption();

// // We can get the state and look at the next node to call.

// // This is a nice way to see that the graph has been interrupted.

// async function printNextNode() {
//   const events = await graph.stream(initialInput, threadConfig);
//   for await (const event of events) {
//     //ignore
//   }
//   const next = graph.next(threadConfig);
//   console.log(next);
// }

// printNextNode();

// // Now, we'll introduce a nice trick.

// // When we invoke the graph with `None`, it will just continue from the last state checkpoint!

// // ![breakpoints.jpg](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbae7985b747dfed67775d_breakpoints1.png)

// // For clarity, LangGraph will re-emit the current state, which contains the `AIMessage` with tool call.

// // And then it will proceed to execute the following steps in the graph, which start with the tool node.

// // We see that the tool node is run with this tool call, and it's passed back to the chat model for our final answer.

// async function continueFromLastCheckpoint() {
//   const events = await graph.stream(initialInput, threadConfig);
//   for await (const event of events) {
//     //ignore
//   }
//   const nextEvents = await graph.stream(null, threadConfig);
//   for await (const nextEvent of nextEvents) {
//     if (nextEvent.has("messages")) {
//       console.log(nextEvent.get("messages"));
//     }
//   }
// }

// continueFromLastCheckpoint();

// // Now, lets bring these together with a specific user approval step that accepts user input.

// function askUserApproval(): Promise<string> {
//   const rl = readline.createInterface({
//     input: stdin,
//     output: stdout,
//   });

//   return new Promise((resolve) => {
//     rl.question("Do you want to call the tool? (yes/no): ", (answer) => {
//       rl.close();
//       resolve(answer);
//     });
//   });
// }

// async function runWithUserApproval() {
//   // Run the graph until the first interruption
//   const events = await graph.stream(initialInput, {
//     configurable: { thread_id: "2" },
//   });
//   for await (const event of events) {
//     if (event.has("messages")) {
//       console.log(event.get("messages"));
//     }
//   }

//   // Get user feedback
//   const userApproval = await askUserApproval();

//   // Check approval
//   if (userApproval.toLowerCase() === "yes") {
//     // If approved, continue the graph execution
//     const newEvents = await graph.stream(null, {
//       configurable: { thread_id: "2" },
//     });
//     for await (const newEvent of newEvents) {
//       if (newEvent.has("messages")) {
//         console.log(newEvent.get("messages"));
//       }
//     }
//   } else {
//     console.log("Operation cancelled by user.");
//   }
// }

// runWithUserApproval();

// // ### Breakpoints with LangGraph API

// // --

// // **⚠️ DISCLAIMER**

// // *Running Studio currently requires a Mac. If you are not using a Mac, then skip this step.*

// // *Also, if you are running this notebook in CoLab, then skip this step.*

// // --

// // Let's load our `agent` in the Studio UI, which uses `module-3/studio/agent.py` set in `module-3/studio/langgraph.json`.

// // Let's get the URL for the local deployment from Studio.

// // ![Screenshot 2024-08-26 at 9.36.41 AM.png](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbae7989b1d60204c199dc_breakpoints2.png)

// // The LangGraph API [supports breakpoints](https://langchain-ai.github.io/langgraph/cloud/how-tos/human_in_the_loop_breakpoint/#sdk-initialization).

// // Note: Skipping platform check as it's not relevant for TypeScript execution environment.

// const client = new LangGraphClient({
//   url: "http://localhost:8000", // Replace with your actual URL
// });

// // As shown above, we can add `interrupt_before=["node"]` when compiling the graph that is running in Studio.

// // However, with the API, you can also pass `interrupt_before` to the stream method directly.

// async function runWithInterruptionAPI() {
//   const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };
//   const thread: Thread = await client.threads.create();
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: initialInput,
//     stream_mode: "values",
//     interrupt_before: ["tools"],
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

// runWithInterruptionAPI();

// // Now, we can proceed from the breakpoint just like we did before by passing the `thread_id` and `None` as the input!

// async function continueFromBreakpointAPI() {
//   const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };
//   const thread: Thread = await client.threads.create();
//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     input: initialInput,
//     stream_mode: "values",
//     interrupt_before: ["tools"],
//   });

//   for await (const chunk of stream) {
//     console.log(`Receiving new event of type: ${chunk.event}...`);
//     const messages = chunk.data.messages || [];
//     if (messages.length > 0) {
//       console.log(messages[messages.length - 1]);
//     }
//     console.log("-".repeat(50));
//   }
//   const newStream = await client.runs.stream(thread.thread_id, "agent", {
//     input: null,
//     stream_mode: "values",
//     interrupt_before: ["tools"],
//   });

//   for await (const newChunk of newStream) {
//     console.log(`Receiving new event of type: ${newChunk.event}...`);
//     const newMessages = newChunk.data.messages || [];
//     if (newMessages.length > 0) {
//       console.log(newMessages[newMessages.length - 1]);
//     }
//     console.log("-".repeat(50));
//   }
// }

// continueFromBreakpointAPI();
