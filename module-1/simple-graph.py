# %%
from random import random
from typing import Dict, Literal
from pydantic import BaseModel, Field
from langgraph.graph import END, START, StateGraph


# %%
class State(BaseModel):
    """Represents the state of the graph processing pipeline."""

    graph_state: str = Field("", description="The current state of the graph")


# %%
def node_1(state: State) -> Dict[str, str]:
    """First node that appends 'I am' to the graph state."""
    print("___Node 1___")
    return {"graph_state": f"{state.graph_state} I am"}


def node_2(state: State) -> Dict[str, str]:
    """Happy path node that appends positive sentiment."""
    print("___Node 2___")
    return {"graph_state": f"{state.graph_state} happy!"}


def node_3(state: State) -> Dict[str, str]:
    """Sad path node that appends negative sentiment."""
    print("___Node 3___")
    return {"graph_state": f"{state.graph_state} sad!!!"}


# %%
def decide_mood(state: State) -> Literal["node_2", "node_3"]:
    """
    Determines the next node based on random probability.

    Args:
        state: Current state of the graph

    Returns:
        Literal["node_2", "node_3"]: Next node to process
    """
    return "node_2" if random() < 0.5 else "node_3"


# %%
def build_and_save_graph() -> StateGraph:
    """
    Builds the graph and saves its visualization.

    Returns:
        StateGraph: Compiled graph instance
    """
    # Build Graph
    builder = StateGraph(State)

    # Add nodes
    builder.add_node("node_1", node_1)
    builder.add_node("node_2", node_2)
    builder.add_node("node_3", node_3)

    # Add edges
    builder.add_edge(START, "node_1")
    builder.add_conditional_edges(
        "node_1", decide_mood, path_map={"node_2": "node_2", "node_3": "node_3"}
    )
    builder.add_edge("node_2", END)
    builder.add_edge("node_3", END)

    # Compile graph
    graph = builder.compile()

    # Save visualization
    with open("graph.png", "wb") as f:
        f.write(graph.get_graph(xray=True).draw_mermaid_png())

    return graph


# %%
# Create and run graph
graph = build_and_save_graph()
graph.invoke({"graph_state": "Hi, this is Rutam."})

# %%
