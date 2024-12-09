# # %% [markdown]
# # [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/langchain-ai/langchain-academy/blob/main/module-3/time-travel.ipynb) [![Open in LangChain Academy](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66e9eba12c7b7688aa3dbb5e_LCA-badge-green.svg)](https://academy.langchain.com/courses/take/intro-to-langgraph/lessons/58239536-lesson-5-time-travel)

# # %% [markdown]
# # # Time travel
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
# # We showed how breakpoints can stop the graph at specific nodes or allow the graph to dynamically interrupt itself.
# #
# # Then we showed how to proceed with human approval or directly edit the graph state with human feedback.
# #
# # ## Goals
# #
# # Now, let's show how LangGraph [supports debugging](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/time-travel/) by viewing, re-playing, and even forking from past states.
# #
# # We call this `time travel`.

# # %%
# %%capture --no-stderr
# %pip install --quiet -U langgraph langchain_openai langgraph_sdk

# # %%
# import os, getpass


# def _set_env(var: str):
#     if not os.environ.get(var):
#         os.environ[var] = getpass.getpass(f"{var}: ")


# _set_env("OPENAI_API_KEY")

# # %% [markdown]
# # Let's build our agent.

# # %%
# from langchain_openai import ChatOpenAI


# def multiply(a: int, b: int) -> int:
#     """Multiply a and b.

#     Args:
#         a: first int
#         b: second int
#     """
#     return a * b


# # This will be a tool
# def add(a: int, b: int) -> int:
#     """Adds a and b.

#     Args:
#         a: first int
#         b: second int
#     """
#     return a + b


# def divide(a: int, b: int) -> float:
#     """Adds a and b.

#     Args:
#         a: first int
#         b: second int
#     """
#     return a / b


# tools = [add, multiply, divide]
# llm = ChatOpenAI(model="gpt-4o-mini")
# llm_with_tools = llm.bind_tools(tools)

# # %%
# from IPython.display import Image, display

# from langgraph.checkpoint.memory import MemorySaver
# from langgraph.graph import MessagesState
# from langgraph.graph import START, END, StateGraph
# from langgraph.prebuilt import tools_condition, ToolNode

# from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

# # System message
# sys_msg = SystemMessage(
#     content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
# )


# # Node
# def assistant(state: MessagesState):
#     return {"messages": [llm_with_tools.invoke([sys_msg] + state["messages"])]}


# # Graph
# builder = StateGraph(MessagesState)

# # Define nodes: these do the work
# builder.add_node("assistant", assistant)
# builder.add_node("tools", ToolNode(tools))

# # Define edges: these determine the control flow
# builder.add_edge(START, "assistant")
# builder.add_conditional_edges(
#     "assistant",
#     # If the latest message (result) from assistant is a tool call -> tools_condition routes to tools
#     # If the latest message (result) from assistant is a not a tool call -> tools_condition routes to END
#     tools_condition,
# )
# builder.add_edge("tools", "assistant")

# memory = MemorySaver()
# graph = builder.compile(checkpointer=MemorySaver())

# # Show
# display(Image(graph.get_graph(xray=True).draw_mermaid_png()))

# # %% [markdown]
# # Let's run it, as before.

# # %%
# # Input
# initial_input = {"messages": HumanMessage(content="Multiply 2 and 3")}

# # Thread
# thread = {"configurable": {"thread_id": "1"}}

# # Run the graph until the first interruption
# for event in graph.stream(initial_input, thread, stream_mode="values"):
#     event["messages"][-1].pretty_print()

# # %% [markdown]
# # ## Browsing History
# #
# # We can use `get_state` to look at the **current** state of our graph, given the `thread_id`!

# # %%
# graph.get_state({"configurable": {"thread_id": "1"}})

# # %% [markdown]
# # We can also browse the state history of our agent.
# #
# # `get_state_history` lets us get the state at all prior steps.
# #

# # %%
# all_states = [s for s in graph.get_state_history(thread)]

# # %%
# len(all_states)

# # %% [markdown]
# # The first element is the current state, just as we got from `get_state`.

# # %%
# all_states[-2]

# # %% [markdown]
# # Everything above we can visualize here:
# #
# # ![fig1.jpg](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbb038211b544898570be3_time-travel1.png)

# # %% [markdown]
# # ## Replaying
# #
# # We can re-run our agent from any of the prior steps.
# #
# # ![fig2.jpg](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbb038a0bd34b541c78fb8_time-travel2.png)

# # %% [markdown]
# # Let's look back at the step that recieved human input!

# # %%
# to_replay = all_states[-2]

# # %%
# to_replay

# # %% [markdown]
# # Look at the state.

# # %%
# to_replay.values

# # %% [markdown]
# # We can see the next node to call.

# # %%
# to_replay.next

# # %% [markdown]
# # We also get the config, which tells us the `checkpoint_id` as well as the `thread_id`.

# # %%
# to_replay.config

# # %% [markdown]
# # To replay from here, we simply pass the config back to the agent!
# #
# # The graph knows that this checkpoint has aleady been executed.
# #
# # It just re-plays from this checkpoint!

# # %%
# for event in graph.stream(None, to_replay.config, stream_mode="values"):
#     event["messages"][-1].pretty_print()

# # %% [markdown]
# # Now, we can see our current state after the agent re-ran.

# # %% [markdown]
# # ## Forking
# #
# # What if we want to run from that same step, but with a different input.
# #
# # This is forking.
# #
# # ![fig3.jpg](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbb038f89f2d847ee5c336_time-travel3.png)

# # %%
# to_fork = all_states[-2]
# to_fork.values["messages"]

# # %% [markdown]
# # Again, we have the config.

# # %%
# to_fork.config

# # %% [markdown]
# # Let's modify the state at this checkpoint.
# #
# # We can just run `update_state` with the `checkpoint_id` supplied.
# #
# # Remember how our reducer on `messages` works:
# #
# # * It will append, unless we supply a message ID.
# # * We supply the message ID to overwrite the message, rather than appending to state!
# #
# # So, to overwrite the the message, we just supply the message ID, which we have `to_fork.values["messages"].id`.

# # %%
# fork_config = graph.update_state(
#     to_fork.config,
#     {
#         "messages": [
#             HumanMessage(
#                 content="Multiply 5 and 3", id=to_fork.values["messages"][0].id
#             )
#         ]
#     },
# )

# # %%
# fork_config

# # %% [markdown]
# # This creates a new, forked checkpoint.
# #
# # But, the metadata - e.g., where to go next - is perserved!
# #
# # We can see the current state of our agent has been updated with our fork.

# # %%
# all_states = [state for state in graph.get_state_history(thread)]
# all_states[0].values["messages"]

# # %%
# graph.get_state({"configurable": {"thread_id": "1"}})

# # %% [markdown]
# # Now, when we stream, the graph knows this checkpoint has never been executed.
# #
# # So, the graph runs, rather than simply re-playing.

# # %%
# for event in graph.stream(None, fork_config, stream_mode="values"):
#     event["messages"][-1].pretty_print()

# # %% [markdown]
# # Now, we can see the current state is the end of our agent run.

# # %%
# graph.get_state({"configurable": {"thread_id": "1"}})

# # %% [markdown]
# # ### Time travel with LangGraph API
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
# # Let's load our `agent` in the Studio UI, which uses `module-3/studio/agent.py` set in `module-3/studio/langgraph.json`.
# #
# # ![Screenshot 2024-08-26 at 9.59.19 AM.png](https://cdn.prod.website-files.com/65b8cd72835ceeacd4449a53/66dbb038211b544898570bec_time-travel4.png)
# #
# # We connect to it via the SDK and show how the LangGraph API [supports time travel](https://langchain-ai.github.io/langgraph/cloud/how-tos/human_in_the_loop_time_travel/#initial-invocation).

# # %%
# import platform

# if "google.colab" in str(get_ipython()) or platform.system() != "Darwin":
#     raise Exception(
#         "Unfortunately LangGraph Studio is currently not supported on Google Colab or requires a Mac"
#     )

# # %%
# from langgraph_sdk import get_client

# client = get_client(url="http://localhost:62780")

# # %% [markdown]
# # #### Re-playing
# #
# # Let's run our agent streaming `updates` to the state of the graph after each node is called.

# # %%
# initial_input = {"messages": HumanMessage(content="Multiply 2 and 3")}
# thread = await client.threads.create()
# async for chunk in client.runs.stream(
#     thread["thread_id"],
#     assistant_id="agent",
#     input=initial_input,
#     stream_mode="updates",
# ):
#     if chunk.data:
#         assisant_node = chunk.data.get("assistant", {}).get("messages", [])
#         tool_node = chunk.data.get("tools", {}).get("messages", [])
#         if assisant_node:
#             print("-" * 20 + "Assistant Node" + "-" * 20)
#             print(assisant_node[-1])
#         elif tool_node:
#             print("-" * 20 + "Tools Node" + "-" * 20)
#             print(tool_node[-1])

# # %% [markdown]
# # Now, let's look at **replaying** from a specified checkpoint.
# #
# # We simply need to pass the `checkpoint_id`.

# # %%
# states = await client.threads.get_history(thread["thread_id"])
# to_replay = states[-2]
# to_replay

# # %% [markdown]
# # Let's stream with `stream_mode="values"` to see the full state at every node as we replay.

# # %%
# async for chunk in client.runs.stream(
#     thread["thread_id"],
#     assistant_id="agent",
#     input=None,
#     stream_mode="values",
#     checkpoint_id=to_replay["checkpoint_id"],
# ):
#     print(f"Receiving new event of type: {chunk.event}...")
#     print(chunk.data)
#     print("\n\n")

# # %% [markdown]
# # We can all view this as streaming only `updates` to state made by the nodes that we reply.

# # %%
# async for chunk in client.runs.stream(
#     thread["thread_id"],
#     assistant_id="agent",
#     input=None,
#     stream_mode="updates",
#     checkpoint_id=to_replay["checkpoint_id"],
# ):
#     if chunk.data:
#         assisant_node = chunk.data.get("assistant", {}).get("messages", [])
#         tool_node = chunk.data.get("tools", {}).get("messages", [])
#         if assisant_node:
#             print("-" * 20 + "Assistant Node" + "-" * 20)
#             print(assisant_node[-1])
#         elif tool_node:
#             print("-" * 20 + "Tools Node" + "-" * 20)
#             print(tool_node[-1])

# # %% [markdown]
# # #### Forking
# #
# # Now, let's look at forking.
# #
# # Let's get the same step as we worked with above, the human input.
# #
# # Let's create a new thread with our agent.

# # %%
# initial_input = {"messages": HumanMessage(content="Multiply 2 and 3")}
# thread = await client.threads.create()
# async for chunk in client.runs.stream(
#     thread["thread_id"],
#     assistant_id="agent",
#     input=initial_input,
#     stream_mode="updates",
# ):
#     if chunk.data:
#         assisant_node = chunk.data.get("assistant", {}).get("messages", [])
#         tool_node = chunk.data.get("tools", {}).get("messages", [])
#         if assisant_node:
#             print("-" * 20 + "Assistant Node" + "-" * 20)
#             print(assisant_node[-1])
#         elif tool_node:
#             print("-" * 20 + "Tools Node" + "-" * 20)
#             print(tool_node[-1])

# # %%
# states = await client.threads.get_history(thread["thread_id"])
# to_fork = states[-2]
# to_fork["values"]

# # %%
# to_fork["values"]["messages"][0]["id"]

# # %%
# to_fork["next"]

# # %%
# to_fork["checkpoint_id"]

# # %% [markdown]
# # Let's edit the state.
# #
# # Remember how our reducer on `messages` works:
# #
# # * It will append, unless we supply a message ID.
# # * We supply the message ID to overwrite the message, rather than appending to state!

# # %%
# forked_input = {
#     "messages": HumanMessage(
#         content="Multiply 3 and 3", id=to_fork["values"]["messages"][0]["id"]
#     )
# }

# forked_config = await client.threads.update_state(
#     thread["thread_id"], forked_input, checkpoint_id=to_fork["checkpoint_id"]
# )

# # %%
# forked_config

# # %%
# states = await client.threads.get_history(thread["thread_id"])
# states[0]

# # %% [markdown]
# # To rerun, we pass in the `checkpoint_id`.

# # %%
# async for chunk in client.runs.stream(
#     thread["thread_id"],
#     assistant_id="agent",
#     input=None,
#     stream_mode="updates",
#     checkpoint_id=forked_config["checkpoint_id"],
# ):
#     if chunk.data:
#         assisant_node = chunk.data.get("assistant", {}).get("messages", [])
#         tool_node = chunk.data.get("tools", {}).get("messages", [])
#         if assisant_node:
#             print("-" * 20 + "Assistant Node" + "-" * 20)
#             print(assisant_node[-1])
#         elif tool_node:
#             print("-" * 20 + "Tools Node" + "-" * 20)
#             print(tool_node[-1])

# # %% [markdown]
# # ### LangGraph Studio
# #
# # Let's look at forking in the Studio UI with our `agent`, which uses `module-1/studio/agent.py` set in `module-1/studio/langgraph.json`.
