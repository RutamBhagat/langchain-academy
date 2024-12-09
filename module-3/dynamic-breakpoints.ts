// // dynamic-breakpoints.ts

// // # Dynamic breakpoints

// // ## Review

// // We discussed motivations for human-in-the-loop:

// // (1) `Approval` - We can interrupt our agent, surface state to a user, and allow the user to accept an action

// // (2) `Debugging` - We can rewind the graph to reproduce or avoid issues

// // (3) `Editing` - You can modify the state

// // We covered breakpoints as a general way to stop the graph at specific steps, which enables use-cases like `Approval`

// // We also showed how to edit graph state, and introduce human feedback.

// // ## Goals

// // Breakpoints are set by the developer on a specific node during graph compilation.

// // But, sometimes it is helpful to allow the graph **dynamically interrupt** itself!

// // This is an internal breakpoint, and [can be achieved using `NodeInterrupt`](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/dynamic_breakpoints/#run-the-graph-with-dynamic-interrupt).

// // This has a few specific benefits:

// // (1) you can do it conditionally (from inside a node based on developer-defined logic).

// // (2) you can communicate to the user why its interrupted (by passing whatever you want to the `NodeInterrupt`).

// // Let's create a graph where a `NodeInterrupt` is thrown based upon length of the input.

// import { StateGraph, END } from "@langchain/langgraph";
// import {
//   Client as LangGraphClient,
//   Thread,
//   ThreadState,
//   ThreadMessage,
//   Run,
//   StreamEvent,
// } from "@langchain/langgraph-sdk";

// // Define the State interface
// interface State {
//   input: string;
// }

// // Implement the step functions
// function step1(state: State): State {
//   console.log("---Step 1---");
//   return state;
// }

// function step2(state: State): State {
//   if (state.input.length > 5) {
//     throw new Error(
//       `Received input that is longer than 5 characters: ${state.input}`
//     ); // Simulate NodeInterrupt using Error
//   }
//   console.log("---Step 2---");
//   return state;
// }

// function step3(state: State): State {
//   console.log("---Step 3---");
//   return state;
// }

// // Create the graph
// const builder = new StateGraph<State>();

// // Add nodes
// builder.addNode("step_1", step1);
// builder.addNode("step_2", step2);
// builder.addNode("step_3", step3);

// // Add edges
// builder.setEntryPoint("step_1");
// builder.addEdge("step_1", "step_2");
// builder.addEdge("step_2", "step_3");
// builder.addEdge("step_3", END);

// // Compile the graph
// const graph = builder.compile();

// // Run the graph with an input longer than 5 characters
// const initialInput: State = { input: "hello world" };
// const threadConfig = { configurable: { thread_id: "1" } };

// async function runGraphWithLongInput() {
//   try {
//     const events = await graph.stream(initialInput, threadConfig);
//     for await (const event of events) {
//       console.log(event);
//     }
//   } catch (error) {
//     console.error("Error during graph execution:", error);
//   }
// }

// runGraphWithLongInput();

// async function checkGraphState() {
//   try {
//     const events = await graph.stream(initialInput, threadConfig);
//     for await (const event of events) {
//       //ignore
//     }
//   } catch (error) {
//     console.error("Error during graph execution:", error);
//   }
//   console.log(graph.next(threadConfig));
// }

// checkGraphState();

// // We can see that the `Interrupt` is logged to state. (Handled by the try-catch block above)

// //Now, we can update state.

// async function updateGraphState() {
//   try {
//     const events = await graph.stream(initialInput, threadConfig);
//     for await (const event of events) {
//       //ignore
//     }
//   } catch (error) {
//     console.error("Error during graph execution:", error);
//   }
//   // Update state to continue execution
//   const updatedInput = { input: "hi" };
//   try {
//     const newEvents = await graph.stream(updatedInput, threadConfig);
//     for await (const event of newEvents) {
//       console.log(event);
//     }
//   } catch (error) {
//     console.error("Error during graph execution:", error);
//   }
// }

// updateGraphState();

// // ### Usage with LangGraph API

// // --

// // **⚠️ DISCLAIMER**

// // *Running Studio currently requires a Mac. If you are not using a Mac, then skip this step.*

// // *Also, if you are running this notebook in CoLab, then skip this step.*

// // --

// // We can run the above graph in Studio with `module-3/studio/dynamic_breakpoints.py`.

// // ![Screenshot 2024-08-27 at 2.02.20 PM.png](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbaedf43c3d4df239c589e_dynamic-breakpoints1.png)

// // Note: Skipping platform check as it's not relevant for TypeScript execution environment.

// // We connect to it via the SDK.
// const client = new LangGraphClient({
//   url: "http://localhost:8000", // Replace with your actual URL
// });

// async function runDynamicBreakpointsAPI() {
//   const thread: Thread = await client.threads.create();
//   const inputDict = { input: "hello world" };

//   try {
//     const stream = await client.runs.stream(
//       thread.thread_id,
//       "dynamic_breakpoints", // Replace with the correct assistant ID
//       {
//         input: inputDict,
//         stream_mode: "values",
//       }
//     );

//     for await (const chunk of stream) {
//       console.log(`Receiving new event of type: ${chunk.event}...`);
//       console.log(chunk.data);
//       console.log("\n\n");
//     }
//   } catch (error) {
//     console.error("Error during API stream:", error);
//   }
// }

// runDynamicBreakpointsAPI();

// async function getCurrentStateAPI() {
//   const thread: Thread = await client.threads.create();
//   const inputDict = { input: "hello world" };

//   try {
//     const stream = await client.runs.stream(
//       thread.thread_id,
//       "dynamic_breakpoints", // Replace with the correct assistant ID
//       {
//         input: inputDict,
//         stream_mode: "values",
//       }
//     );

//     for await (const chunk of stream) {
//       //ignore
//     }
//   } catch (error) {
//     console.error("Error during API stream:", error);
//   }
//   const currentState = await client.threads.get_state(thread.thread_id);
//   console.log(currentState.next);
// }

// getCurrentStateAPI();

// async function updateStateAndContinueAPI() {
//   const thread = await client.threads.create();
//   const inputDict = { input: "hello world" };

//   // Initial run (will likely interrupt)
//   try {
//     const stream = await client.runs.stream(
//       thread.thread_id,
//       "dynamic_breakpoints",
//       { input: inputDict, stream_mode: "values" }
//     );
//     for await (const chunk of stream) {
//       // Process initial chunks if needed
//     }
//   } catch (error) {
//     console.error("Error during initial run:", error);
//   }

//   // Update state
//   await client.threads.update_state(thread.thread_id, { input: "hi!" });

//   // Continue execution
//   const continuedStream = await client.runs.stream(
//     thread.thread_id,
//     "dynamic_breakpoints",
//     { input: null, stream_mode: "values" } // Input is null to resume
//   );

//   for await (const chunk of continuedStream) {
//     console.log(`Receiving new event of type: ${chunk.event}...`);
//     console.log(chunk.data);
//     console.log("\n\n");
//   }
// }

// updateStateAndContinueAPI();

// async function finalStateAPI() {
//   const thread = await client.threads.create();
//   const inputDict = { input: "hello world" };

//   try {
//     const stream = await client.runs.stream(
//       thread.thread_id,
//       "dynamic_breakpoints",
//       { input: inputDict, stream_mode: "values" }
//     );
//     for await (const chunk of stream) {
//       //ignore
//     }
//   } catch (error) {
//     console.error("Error during initial run:", error);
//   }

//   // Update state
//   await client.threads.update_state(thread.thread_id, { input: "hi!" });

//   // Continue execution
//   const continuedStream = await client.runs.stream(
//     thread.thread_id,
//     "dynamic_breakpoints",
//     { input: null, stream_mode: "values" } // Input is null to resume
//   );

//   for await (const chunk of continuedStream) {
//     //ignore
//   }

//   const currentState = await client.threads.get_state(thread.thread_id);
//   console.log(currentState);
// }

// finalStateAPI();
