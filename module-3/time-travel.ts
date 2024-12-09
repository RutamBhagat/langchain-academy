// // time-travel.ts

// // # Time travel

// // ## Review

// // We discussed motivations for human-in-the-loop:

// // (1) `Approval` - We can interrupt our agent, surface state to a user, and allow the user to accept an action

// // (2) `Debugging` - We can rewind the graph to reproduce or avoid issues

// // (3) `Editing` - You can modify the state

// // We showed how breakpoints can stop the graph at specific nodes or allow the graph to dynamically interrupt itself.

// // Then we showed how to proceed with human approval or directly edit the graph state with human feedback.

// // ## Goals

// // Now, let's show how LangGraph [supports debugging](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/time-travel/) by viewing, re-playing, and even forking from past states.

// // We call this `time travel`.

// // In TypeScript, we typically use environment variables directly or a .env file with a library like dotenv.
// import "dotenv/config"; // If using dotenv for environment variables

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

// // Let's build our agent.
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
//   //same as before
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

// // Let's run it, as before.

// // Input
// const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };

// // Thread
// const threadConfig = { configurable: { thread_id: "1" } };

// async function runAgent() {
//   const events = await graph.stream(initialInput, threadConfig);
//   for await (const event of events) {
//     if (event.has("messages")) {
//       console.log(event.get("messages"));
//     }
//   }
// }

// runAgent();

// // ## Browsing History

// // We can use `get_state` to look at the **current** state of our graph, given the `thread_id`!

// async function getCurrentState() {
//   const events = await graph.stream(initialInput, threadConfig);
//   for await (const event of events) {
//     //ignore
//   }
//   console.log(graph.get_state(threadConfig));
// }

// getCurrentState();

// // We can also browse the state history of our agent.

// // `get_state_history` lets us get the state at all prior steps.

// async function getStateHistory() {
//   const events = await graph.stream(initialInput, threadConfig);
//   for await (const event of events) {
//     //ignore
//   }

//   console.log(graph.get_state_history(threadConfig));
// }

// getStateHistory();

// // The first element is the current state, just as we got from `get_state`.
// //Managed in the previous function

// // Everything above we can visualize here:

// // ![fig1.jpg](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbb038211b544898570be3_time-travel1.png)

// // ## Replaying

// // We can re-run our agent from any of the prior steps.

// // ![fig2.jpg](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbb038a0bd34b541c78fb8_time-travel2.png)

// // Let's look back at the step that recieved human input!

// async function replayFromStep() {
//   const events = await graph.stream(initialInput, threadConfig);
//   for await (const event of events) {
//     //ignore
//   }
//   const history = graph.get_state_history(threadConfig);
//   for await (const replayState of history) {
//     if (replayState.values && replayState.values.messages) {
//       //check the values are what we expect
//       console.log(replayState);
//       const newEvents = await graph.stream(null, replayState.config);
//       for await (const newEvent of newEvents) {
//         console.log(newEvent);
//       }
//       break; //only the first one that satisfies the condition
//     }
//   }
// }

// replayFromStep();

// // Now, we can see our current state after the agent re-ran.
// //Managed in the previous function

// // ## Forking

// // What if we want to run from that same step, but with a different input.

// // This is forking.

// // ![fig3.jpg](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbb038f89f2d847ee5c336_time-travel3.png)

// async function forkingFromStep() {
//   const events = await graph.stream(initialInput, threadConfig);
//   for await (const event of events) {
//     //ignore
//   }
//   const history = graph.get_state_history(threadConfig);
//   for await (const forkState of history) {
//     if (forkState.values && forkState.values.messages) {
//       //check the values are what we expect
//       console.log("Fork config:", forkState.config);
//       console.log("Fork state:", forkState.values);
//       const updatedMessage = new HumanMessage("Multiply 5 and 3");
//       updatedMessage.id = forkState.values.messages[0].id;
//       const forkConfig = graph.update_state(forkState.config, {
//         messages: [updatedMessage],
//       });
//       console.log("New fork config:", forkConfig);
//       const newEvents = await graph.stream(null, forkConfig);
//       for await (const newEvent of newEvents) {
//         console.log(newEvent);
//       }
//       break; //only the first one that satisfies the condition
//     }
//   }
// }

// forkingFromStep();

// // Now, we can see the current state is the end of our agent run.
// //Managed in the previous function

// // ### Time travel with LangGraph API

// // --

// // **⚠️ DISCLAIMER**

// // *Running Studio currently requires a Mac. If you are not using a Mac, then skip this step.*

// // *Also, if you are running this notebook in CoLab, then skip this step.*

// // --

// // Let's load our `agent` in the Studio UI, which uses `module-3/studio/agent.py` set in `module-3/studio/langgraph.json`.

// // ![Screenshot 2024-08-26 at 9.59.19 AM.png](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbb038211b544898570bec_time-travel4.png)

// // We connect to it via the SDK and show how the LangGraph API [supports time travel](https://langchain-ai.github.io/langgraph/cloud/how-tos/human_in_the_loop_time_travel/#initial-invocation).

// // Note: Skipping platform check as it's not relevant for TypeScript execution environment.
// const client = new LangGraphClient({
//   url: "http://localhost:8000", // Replace with your actual URL
// });

// // #### Re-playing

// // Let's run our agent streaming `updates` to the state of the graph after each node is called.

// async function replayWithAPI() {
//   const initialInput = { messages: [new HumanMessage("Multiply 2 and 3")] };
//   const thread: Thread = await client.threads.create();

//   const stream = await client.runs.stream(thread.thread_id, "agent", {
//     //check agent id
//     input: initialInput,
//     stream_mode: "updates",
//   });

//   for await (const chunk of stream) {
//     if (chunk.data) {
//       const assistantNode = chunk.data.assistant?.messages || [];
//       const toolsNode = chunk.data.tools?.messages || [];
//       if (assistantNode.length > 0) {
//         console.log("-".repeat(20) + "Assistant Node" + "-".repeat(20));
//         console.log(assistantNode.slice(-1)[0]);
//       } else if (toolsNode.length > 0) {
//         console.log("-".repeat(20) + "Tools Node" + "-".repeat(20));
//         console.log(toolsNode.slice(-1)[0]);
//       }
//     }
//   }

//   // Now, let's look at **replaying** from a specified checkpoint.
//   // We simply need to pass the `checkpoint_id`.
//   const states = await client.threads.getHistory(thread.thread_id);
//   const toReplay = states.slice(-2)[0];
//   console.log("To replay:", toReplay);

//   // Let's stream with `stream_mode="values"` to see the full state at every node as we replay.
//   const replayStream = await client.runs.stream(thread.thread_id, "agent", {
//     //check agent id
//     input: null,
//     stream_mode: "values",
//     checkpoint_id: toReplay.checkpoint_id,
//   });
//   for await (const chunk of replayStream) {
//     console.log(`Receiving new event of type: ${chunk.event}...`);
//     console.log(chunk.data);
//     console.log("\n\n");
//   }

//   // We can all view this as streaming only `updates` to state made by the nodes that we reply.
//   const updatesStream = await client.runs.stream(thread.thread_id, "agent", {
//     //check agent id
//     input: null,
//     stream_mode: "updates",
//     checkpoint_id: toReplay.checkpoint_id,
//   });

//   for await (const chunk of updatesStream) {
//     if (chunk.data) {
//       const assistantNode = chunk.data.assistant?.messages || [];
//       const toolsNode = chunk.data.tools?.messages || [];
//       if (assistantNode.length > 0) {
//         console.log("-".repeat(20) + "Assistant Node" + "-".repeat(20));
//         console.log(assistantNode.slice(-1)[0]);
//       } else if (toolsNode.length > 0) {
//         console.log("-".repeat(20) + "Tools Node" + "-".repeat(20));
//         console.log(toolsNode.slice(-1)[0]);
//       }
//     }
//   }

//   // #### Forking
//   // Now, let's look at forking.
//   // Let's get the same step as we worked with above, the human input.
//   // Let's create a new thread with our agent.
//   const initialInputFork = { messages: [new HumanMessage("Multiply 2 and 3")] };
//   const threadFork: Thread = await client.threads.create();
//   const streamFork = await client.runs.stream(threadFork.thread_id, "agent", {
//     //check agent id
//     input: initialInputFork,
//     stream_mode: "updates",
//   });

//   for await (const chunk of streamFork) {
//     if (chunk.data) {
//       const assistantNode = chunk.data.assistant?.messages || [];
//       const toolsNode = chunk.data.tools?.messages || [];
//       if (assistantNode.length > 0) {
//         console.log("-".repeat(20) + "Assistant Node" + "-".repeat(20));
//         console.log(assistantNode.slice(-1)[0]);
//       } else if (toolsNode.length > 0) {
//         console.log("-".repeat(20) + "Tools Node" + "-".repeat(20));
//         console.log(toolsNode.slice(-1)[0]);
//       }
//     }
//   }

//   const statesFork = await client.threads.getHistory(threadFork.thread_id);
//   const toFork = statesFork.slice(-2)[0];
//   console.log("To Fork values:", toFork.values);

//   const forkedInput = {
//     messages: [
//       new HumanMessage({
//         content: "Multiply 3 and 3",
//         id: toFork["values"]["messages"][0]["id"], //using any to avoid type errors
//       }),
//     ],
//   };

//   const forkedConfig = await client.threads.update_state(
//     threadFork.thread_id,
//     forkedInput,
//     { checkpoint_id: toFork.checkpoint_id }
//   );

//   console.log("Forked config:", forkedConfig);
//   const statesForked = await client.threads.getHistory(threadFork.thread_id);
//   console.log("States forked:", statesForked[0]);

//   // To rerun, we pass in the `checkpoint_id`.
//   const rerunStream = await client.runs.stream(threadFork.thread_id, "agent", {
//     //check agent id
//     input: null,
//     stream_mode: "updates",
//     checkpoint_id: forkedConfig.checkpoint_id,
//   });

//   for await (const chunk of rerunStream) {
//     if (chunk.data) {
//       const assistantNode = chunk.data.assistant?.messages || [];
//       const toolsNode = chunk.data.tools?.messages || [];
//       if (assistantNode.length > 0) {
//         console.log("-".repeat(20) + "Assistant Node" + "-".repeat(20));
//         console.log(assistantNode.slice(-1)[0]);
//       } else if (toolsNode.length > 0) {
//         console.log("-".repeat(20) + "Tools Node" + "-".repeat(20));
//         console.log(toolsNode.slice(-1)[0]);
//       }
//     }
//   }
// }

// replayWithAPI();

// // ### LangGraph Studio

// // Let's look at forking in the Studio UI with our `agent`, which uses `module-1/studio/agent.py` set in `module-1/studio/langgraph.json`.
