# %%

from random import random
from typing import Literal
from pydantic import BaseModel, Field

from langgraph.graph import END, START, StateGraph


# %%
class State(BaseModel):
    graph_state: str = Field("", description="The state of the graph")


# %%


def node_1(state: State):
    print("___Node 1___")
    return {"graph_state": state.graph_state + " I am"}


def node_2(state: State):
    print("___Node 2___")
    return {"graph_state": state.graph_state + " happy!"}


def node_3(state: State):
    print("___Node 3___")
    return {"graph_state": state.graph_state + " sad!!!"}


# %%


def decide_mood(state: State) -> Literal["node_2", "node_3"]:
    # we might do some logic based on the existing state like an llm call or something else
    # then based on that decide which node to visit next
    user_input = state.graph_state

    if random() < 0.5:
        return "node_2"
    return "node_3"


# %%

# Build Graph
builder = StateGraph(State)
builder.add_node("node_1", node_1)
builder.add_node("node_2", node_2)
builder.add_node("node_3", node_3)

# Logic
builder.add_edge(START, "node_1")
builder.add_conditional_edges(
    "node_1", decide_mood, path_map={"node_2": "node_2", "node_3": "node_3"}
)
builder.add_edge("node_2", END)
builder.add_edge("node_3", END)

# Add
graph = builder.compile()

# Get the graph in PNG format
graph_png = graph.get_graph().draw_mermaid_png()

# Save the PNG to a file in the current directory
with open("graph.png", "wb") as f:
    f.write(graph_png)
# %%
graph.invoke({"graph_state": "Hi, this is Rutam."})

# %%
