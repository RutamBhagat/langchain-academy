# # %% [markdown]
# # [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/langchain-ai/langchain-academy/blob/main/module-3/dynamic-breakpoints.ipynb) [![Open in LangChain Academy](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66e9eba12c7b7688aa3dbb5e_LCA-badge-green.svg)](https://academy.langchain.com/courses/take/intro-to-langgraph/lessons/58239526-lesson-4-dynamic-breakpoints)

# # %% [markdown]
# # # Dynamic breakpoints
# #
# # ## Review
# #
# # We discussed motivations for human-in-the-loop:
# #
# # (1) `Approval` - We can interrupt our agent, surface state to a user, and allow the user to accept an action
# #
# # (2) `Debugging` - We can rewind the graph to reproduce or avoid issues
# #
# # (3) `Editing` - You can modify the state
# #
# # We covered breakpoints as a general way to stop the graph at specific steps, which enables use-cases like `Approval`
# #
# # We also showed how to edit graph state, and introduce human feedback.
# #
# # ## Goals
# #
# # Breakpoints are set by the developer on a specific node during graph compilation.
# #
# # But, sometimes it is helpful to allow the graph **dynamically interrupt** itself!
# #
# # This is an internal breakpoint, and [can be achieved using `NodeInterrupt`](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/dynamic_breakpoints/#run-the-graph-with-dynamic-interrupt).
# #
# # This has a few specific benefits:
# #
# # (1) you can do it conditionally (from inside a node based on developer-defined logic).
# #
# # (2) you can communicate to the user why its interrupted (by passing whatever you want to the `NodeInterrupt`).
# #
# # Let's create a graph where a `NodeInterrupt` is thrown based upon length of the input.

# # %%
# %%capture --no-stderr
# %pip install --quiet -U langgraph langchain_openai langgraph_sdk

# # %%
# from IPython.display import Image, display

# from typing_extensions import TypedDict
# from langgraph.checkpoint.memory import MemorySaver
# from langgraph.errors import NodeInterrupt
# from langgraph.graph import START, END, StateGraph


# class State(TypedDict):
#     input: str


# def step_1(state: State) -> State:
#     print("---Step 1---")
#     return state


# def step_2(state: State) -> State:
#     # Let's optionally raise a NodeInterrupt if the length of the input is longer than 5 characters
#     if len(state["input"]) > 5:
#         raise NodeInterrupt(
#             f"Received input that is longer than 5 characters: {state['input']}"
#         )

#     print("---Step 2---")
#     return state


# def step_3(state: State) -> State:
#     print("---Step 3---")
#     return state


# builder = StateGraph(State)
# builder.add_node("step_1", step_1)
# builder.add_node("step_2", step_2)
# builder.add_node("step_3", step_3)
# builder.add_edge(START, "step_1")
# builder.add_edge("step_1", "step_2")
# builder.add_edge("step_2", "step_3")
# builder.add_edge("step_3", END)

# # Set up memory
# memory = MemorySaver()

# # Compile the graph with memory
# graph = builder.compile(checkpointer=memory)

# # View
# display(Image(graph.get_graph(xray=True).draw_mermaid_png()))

# # %% [markdown]
# # Let's run the graph with an input that's longer than 5 characters.

# # %%
# initial_input = {"input": "hello world"}
# thread_config = {"configurable": {"thread_id": "1"}}

# # Run the graph until the first interruption
# for event in graph.stream(initial_input, thread_config, stream_mode="values"):
#     print(event)

# # %% [markdown]
# # If we inspect the graph state at this point, we the node set to execute next (`step_2`).
# #

# # %%
# state = graph.get_state(thread_config)
# print(state.next)

# # %% [markdown]
# # We can see that the `Interrupt` is logged to state.

# # %%
# print(state.tasks)

# # %% [markdown]
# # We can try to resume the graph from the breakpoint.
# #
# # But, this just re-runs the same node!
# #
# # Unless state is changed we will be stuck here.

# # %%
# for event in graph.stream(None, thread_config, stream_mode="values"):
#     print(event)

# # %%
# state = graph.get_state(thread_config)
# print(state.next)

# # %% [markdown]
# # Now, we can update state.

# # %%
# graph.update_state(
#     thread_config,
#     {"input": "hi"},
# )

# # %%
# for event in graph.stream(None, thread_config, stream_mode="values"):
#     print(event)

# # %% [markdown]
# # ### Usage with LangGraph API
# #
# # --
# #
# # **⚠️ DISCLAIMER**
# #
# # *Running Studio currently requires a Mac. If you are not using a Mac, then skip this step.*
# #
# # *Also, if you are running this notebook in CoLab, then skip this step.*
# #
# # --
# #
# # We can run the above graph in Studio with `module-3/studio/dynamic_breakpoints.py`.
# #
# # ![Screenshot 2024-08-27 at 2.02.20 PM.png](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbaedf43c3d4df239c589e_dynamic-breakpoints1.png)

# # %%
# import platform

# if "google.colab" in str(get_ipython()) or platform.system() != "Darwin":
#     raise Exception(
#         "Unfortunately LangGraph Studio is currently not supported on Google Colab or requires a Mac"
#     )

# # %% [markdown]
# # We connect to it via the SDK.

# # %%
# from langgraph_sdk import get_client

# # Replace this with the URL of your own deployed graph
# URL = "http://localhost:62575"
# client = get_client(url=URL)

# # Search all hosted graphs
# assistants = await client.assistants.search()

# # %%
# thread = await client.threads.create()
# input_dict = {"input": "hello world"}

# async for chunk in client.runs.stream(
#     thread["thread_id"],
#     assistant_id="dynamic_breakpoints",
#     input=input_dict,
#     stream_mode="values",
# ):
#     print(f"Receiving new event of type: {chunk.event}...")
#     print(chunk.data)
#     print("\n\n")

# # %%
# current_state = await client.threads.get_state(thread["thread_id"])

# # %%
# current_state["next"]

# # %%
# await client.threads.update_state(thread["thread_id"], {"input": "hi!"})

# # %%
# async for chunk in client.runs.stream(
#     thread["thread_id"],
#     assistant_id="dynamic_breakpoints",
#     input=None,
#     stream_mode="values",
# ):
#     print(f"Receiving new event of type: {chunk.event}...")
#     print(chunk.data)
#     print("\n\n")

# # %%
# current_state = await client.threads.get_state(thread["thread_id"])
# current_state

# # %%
